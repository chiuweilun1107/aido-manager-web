import { SupabaseClient } from '@supabase/supabase-js'
import { CHAINS } from './chains'
import { MODULE_MAP } from './modules'

// ---------- helpers ----------
function genNo(prefix: string) { return `${prefix.toUpperCase().slice(0, 4)}-${Date.now().toString().slice(-9)}` }
function intFromOption(v: unknown): number {
  if (v == null) return 0; const m = String(v).match(/-?\d+/); return m ? parseInt(m[0], 10) : 0
}
function evalCond(cond: { field: string; op: string; value: number } | undefined, request: Record<string, unknown>, payload: Record<string, unknown>): boolean {
  if (!cond) return true
  let left: unknown
  if (cond.field === 'amount') left = request.amount || 0
  else if (cond.field === 'legal_required') left = intFromOption(payload.legal_required)
  else left = payload[cond.field]
  const right = cond.value
  const ln = typeof left === 'number' ? left : parseFloat(String(left))
  switch (cond.op) {
    case '>': return ln > right; case '>=': return ln >= right
    case '<': return ln < right; case '<=': return ln <= right
    case '=': return ln === right || left === right
    default: return true
  }
}

// aido schema accessor
const db = (client: SupabaseClient) => client.schema('aido')

async function getUser(client: SupabaseClient, id: number) {
  const { data } = await db(client).from('users').select('*').eq('id', id).single()
  return data
}
async function getReq(client: SupabaseClient, id: number) {
  const { data } = await db(client).from('requests').select('*').eq('id', id).single()
  return data
}
async function getRole(client: SupabaseClient, code: string) {
  const { data } = await db(client).from('roles').select('*').eq('code', code).single()
  return data
}
async function getRoleById(client: SupabaseClient, id: number) {
  const { data } = await db(client).from('roles').select('*').eq('id', id).single()
  return data
}
async function getDept(client: SupabaseClient, id: number) {
  const { data } = await db(client).from('departments').select('*').eq('id', id).single()
  return data
}

function assessRisk(moduleCode: string, payload: Record<string, unknown>): string {
  if (moduleCode === 'overtime') {
    const mins = Number(payload.minutes) || 0
    if (mins > 720) return 'high'
    if (payload.day_type && payload.day_type !== 'workday') return 'high'
    if (mins > 240) return 'medium'
  }
  return 'low'
}

async function resolveApprover(client: SupabaseClient, resolver: { resolver: string; role_code?: string; fallback?: { resolver: string } }, request: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const requester = await getUser(client, Number(request.requester_user_id))
  if (!requester) return null
  if (resolver.resolver === 'self') return { approver_user_id: requester.id, approver_type: 'user' }
  if (resolver.resolver === 'direct_manager') {
    if (requester.manager_user_id) return { approver_user_id: requester.manager_user_id, approver_type: 'manager' }
    if (resolver.fallback) return resolveApprover(client, resolver.fallback, request)
    return null
  }
  if (resolver.resolver === 'department_manager') {
    const dept = requester.department_id ? await getDept(client, requester.department_id) : null
    if (dept && dept.manager_user_id) return { approver_user_id: dept.manager_user_id, approver_type: 'department_manager' }
    if (resolver.fallback) return resolveApprover(client, resolver.fallback, request)
    return null
  }
  if (resolver.resolver === 'role') {
    const role = resolver.role_code ? await getRole(client, resolver.role_code) : null
    return role ? { approver_role_id: role.id, approver_type: 'role' } : null
  }
  return null
}

async function antiSelf(client: SupabaseClient, r: Record<string, unknown> | null, request: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  if (!r) return r
  const reqUser = await getUser(client, Number(request.requester_user_id))
  if (!reqUser) return r
  const toManager = (): Record<string, unknown> | null =>
    (reqUser.manager_user_id && reqUser.manager_user_id !== request.requester_user_id)
      ? { approver_user_id: reqUser.manager_user_id, approver_type: 'manager' } : null
  if (r.approver_user_id && r.approver_user_id === request.requester_user_id) return toManager()
  if (r.approver_role_id && reqUser.primary_role_id === r.approver_role_id) {
    const { count } = await db(client).from('users')
      .select('id', { count: 'exact', head: true })
      .eq('primary_role_id', r.approver_role_id as number)
      .eq('status', 'active')
      .neq('id', Number(request.requester_user_id))
    if ((count ?? 1) === 0) return toManager()
  }
  return r
}

async function buildTiers(client: SupabaseClient, chain: typeof CHAINS[string], request: Record<string, unknown>, payload: Record<string, unknown>) {
  const tiers: Array<{ name: string; type: string; required: string; approvers: Record<string, unknown>[]; config: unknown }> = []
  for (const s of chain.steps) {
    if (!evalCond(s.condition, request, payload)) continue
    let approvers: Record<string, unknown>[] = []
    if (s.type === 'parallel') {
      for (const a of (s.approvers || [])) {
        const r = await antiSelf(client, await resolveApprover(client, a, request), request)
        if (r) approvers.push(r)
      }
    } else if (s.approver) {
      const r = await antiSelf(client, await resolveApprover(client, s.approver, request), request)
      if (r) approvers.push(r)
    }
    if (!approvers.length) continue
    tiers.push({ name: s.name, type: s.type || 'serial', required: s.required || 'all', approvers, config: s })
  }
  // 去重：相鄰單一簽核人相同 → 合併
  const final: typeof tiers = []
  for (const t of tiers) {
    const prev = final[final.length - 1]
    if (prev && t.approvers.length === 1 && prev.approvers.length === 1 &&
      t.approvers[0].approver_user_id && prev.approvers[0].approver_user_id === t.approvers[0].approver_user_id) continue
    final.push(t)
  }
  return final
}

async function expandSteps(client: SupabaseClient, request: Record<string, unknown>, payload: Record<string, unknown>) {
  const mod = MODULE_MAP[String(request.module_code)]
  const chain = mod && mod.chain ? CHAINS[mod.chain] : null
  if (!chain) {
    const hr = await getRole(client, 'hr')
    await db(client).from('approval_steps').insert({
      request_id: request.id, step_no: 10, step_type: 'serial', name: 'HR 備查',
      approver_type: 'role', approver_role_id: hr?.id ?? null, required_mode: 'any', status: 'active', started_at: new Date().toISOString()
    })
    return
  }
  const tiers = await buildTiers(client, chain, request, payload)
  if (!tiers.length) {
    await db(client).from('requests').update({ status: 'approved', completed_at: new Date().toISOString(), current_step_no: 0 }).eq('id', request.id as number)
    await runPostHooks(client, await getReq(client, Number(request.id)))
    return
  }
  const rows = []
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i]
    const stepNo = (i + 1) * 10
    const active = i === 0
    for (const a of t.approvers) {
      rows.push({
        request_id: request.id, step_no: stepNo, step_type: t.type, name: t.name,
        approver_type: a.approver_type, approver_user_id: a.approver_user_id || null,
        approver_role_id: a.approver_role_id || null, required_mode: t.required,
        status: active ? 'active' : 'pending',
        started_at: active ? new Date().toISOString() : null,
        config_json: JSON.stringify(t.config)
      })
    }
  }
  await db(client).from('approval_steps').insert(rows)
}

async function syncCurrentStep(client: SupabaseClient, requestId: number) {
  const { data } = await db(client).from('approval_steps')
    .select('step_no').eq('request_id', requestId).eq('status', 'active').order('step_no').limit(1)
  if (data && data.length > 0) {
    await db(client).from('requests').update({ current_step_no: data[0].step_no }).eq('id', requestId)
  }
}

async function notifyActiveApprovers(client: SupabaseClient, requestId: number, title: string) {
  const { data: steps } = await db(client).from('approval_steps').select('*').eq('request_id', requestId).eq('status', 'active')
  if (!steps) return
  const sent = new Set<number>()
  const notifications = []
  for (const st of steps) {
    let recipients: number[] = []
    if (st.approver_user_id) { recipients = [st.approver_user_id] }
    else if (st.approver_role_id) {
      const { data: users } = await db(client).from('users').select('id').eq('primary_role_id', st.approver_role_id).eq('status', 'active')
      recipients = (users || []).map((u: { id: number }) => u.id)
    }
    for (const uid of recipients) {
      if (sent.has(uid)) continue; sent.add(uid)
      notifications.push({ user_id: uid, channel: 'in_app', title: '待簽核', body: `請簽核：${title}`, link_url: '/approvals', related_entity_type: 'requests', related_entity_id: requestId, status: 'sent' })
    }
  }
  if (notifications.length) await db(client).from('notifications').insert(notifications)
}

async function notifyRequester(client: SupabaseClient, request: Record<string, unknown>, title: string, body: string) {
  await db(client).from('notifications').insert({
    user_id: request.requester_user_id, channel: 'in_app', title, body,
    link_url: '/approvals', related_entity_type: 'requests', related_entity_id: request.id, status: 'sent'
  })
}

async function createDetail(client: SupabaseClient, moduleCode: string, request: Record<string, unknown>, payload: Record<string, unknown>) {
  switch (moduleCode) {
    case 'expense':
      await db(client).from('expense_claims').insert({ request_id: request.id, user_id: request.requester_user_id, expense_date: payload.expense_date, category: payload.category, amount: request.amount, tax_id: payload.tax_id || null, payment_status: 'unpaid' }); break
    case 'procurement':
      await db(client).from('purchase_orders').insert({ request_id: request.id, requester_user_id: request.requester_user_id, vendor: payload.vendor || null, category: payload.category || null, amount: request.amount, budget_code: payload.budget_code || null, status: 'requested' }); break
    case 'seal':
      await db(client).from('seal_requests').insert({ request_id: request.id, requester_user_id: request.requester_user_id, seal_type: payload.seal_type, document_title: payload.document_title, purpose: payload.purpose || null, counterparty: payload.counterparty || null, legal_required: intFromOption(payload.legal_required) === 1 }); break
    case 'overtime':
      await db(client).from('overtime_records').insert({ request_id: request.id, user_id: request.requester_user_id, work_date: payload.work_date, start_at: payload.start_at, end_at: payload.end_at, minutes: Number(payload.minutes) || 0, day_type: payload.day_type || 'workday', status: 'pending' }); break
    case 'attendance_correction':
      await db(client).from('attendance_corrections').insert({ request_id: request.id, correction_type: payload.correction_type, proposed_clock_in_at: payload.proposed_time, reason: payload.reason || null }); break
    case 'benefit':
      await db(client).from('benefit_claims').insert({ request_id: request.id, user_id: request.requester_user_id, benefit_type: payload.benefit_type, amount: request.amount, status: 'submitted' }); break
    case 'compensation':
      await db(client).from('compensation_changes').insert({ request_id: request.id, user_id: intFromOption(payload.target_user_id) || request.requester_user_id, effective_date: payload.effective_date, change_percent: Number(payload.change_percent) || null, reason: payload.reason || null, initiated_by_user_id: request.requester_user_id }); break
    case 'personnel':
      await db(client).from('personnel_changes').insert({ request_id: request.id, user_id: intFromOption(payload.target_user_id) || request.requester_user_id, change_type: payload.change_type, effective_date: payload.effective_date, reason: payload.reason || null }); break
    default: break
  }
}

async function runPostHooks(client: SupabaseClient, request: Record<string, unknown>) {
  const mod = MODULE_MAP[String(request.module_code)]
  const chain = mod && mod.chain ? CHAINS[mod.chain] : null
  const hooks = (chain?.post_approve_hooks) || []
  const payload = request.payload_json ? JSON.parse(String(request.payload_json)) : {}
  for (const h of hooks) {
    try { await applyHook(client, h, request, payload) } catch { /* don't block main flow */ }
  }
}

async function applyHook(client: SupabaseClient, hook: string, request: Record<string, unknown>, payload: Record<string, unknown>) {
  const year = new Date().getFullYear()
  switch (hook) {
    case 'deduct_leave_balance': {
      const { data: lt } = await db(client).from('leave_types').select('*').eq('name', payload.leave_type).single()
      if (!lt) break
      const hours = Number(payload.hours) || 0
      const { data: bal } = await db(client).from('leave_balances').select('*').eq('user_id', request.requester_user_id as number).eq('leave_type_id', lt.id).eq('period_year', year).single()
      if (bal) { await db(client).from('leave_balances').update({ used_hours: (bal.used_hours || 0) + hours, version: (bal.version || 1) + 1 }).eq('id', bal.id) }
      else { await db(client).from('leave_balances').insert({ user_id: request.requester_user_id, leave_type_id: lt.id, period_year: year, granted_hours: 0, used_hours: hours }) }
      break
    }
    case 'apply_attendance_correction':
      await db(client).from('attendance_corrections').update({ approved_by_user_id: request.requester_user_id, applied_at: new Date().toISOString() }).eq('request_id', request.id as number)
      break
    case 'mark_expense_scheduled': await db(client).from('expense_claims').update({ payment_status: 'scheduled' }).eq('request_id', request.id as number); break
    case 'mark_po_approved': await db(client).from('purchase_orders').update({ status: 'approved' }).eq('request_id', request.id as number); break
    case 'mark_seal_ready': await db(client).from('seal_requests').update({ sealed_at: new Date().toISOString(), sealed_by_user_id: request.requester_user_id }).eq('request_id', request.id as number); break
    case 'apply_compensation_change': await db(client).from('compensation_changes').update({ applied_at: new Date().toISOString() }).eq('request_id', request.id as number); break
    case 'apply_personnel_change': await db(client).from('personnel_changes').update({ applied_at: new Date().toISOString() }).eq('request_id', request.id as number); break
    default: break
  }
}

async function recordAction(client: SupabaseClient, requestId: number, stepId: number | null, actorId: number, action: string, from: string, to: string, comment: string | null, ctx: { ip?: string; ua?: string } = {}) {
  await db(client).from('approval_actions').insert({
    request_id: requestId, approval_step_id: stepId, actor_user_id: actorId,
    action, from_status: from, to_status: to, comment: comment || null,
    ip_address: ctx.ip || null, user_agent: ctx.ua || null
  })
}

export async function userCanActOnStep(client: SupabaseClient, user: Record<string, unknown>, step: Record<string, unknown>): Promise<boolean> {
  if (step.status !== 'active') return false
  const req = await getReq(client, Number(step.request_id))
  if (req && req.requester_user_id === user.id) return false // 禁自簽
  if (step.approver_user_id && step.approver_user_id === user.id) return true
  if (step.delegated_to_user_id && step.delegated_to_user_id === user.id) return true
  if (step.approver_role_id && user.primary_role_id === step.approver_role_id) return true
  if (step.approver_user_id) {
    const { data: del } = await db(client).from('user_delegates')
      .select('id').eq('delegate_user_id', user.id as number).eq('user_id', step.approver_user_id as number).eq('status', 'active').single()
    if (del) return true
  }
  return false
}

export async function getActiveStepFor(client: SupabaseClient, user: Record<string, unknown>, requestId: number) {
  const { data: steps } = await db(client).from('approval_steps').select('*').eq('request_id', requestId).eq('status', 'active').order('step_no')
  if (!steps) return null
  for (const s of steps) { if (await userCanActOnStep(client, user, s)) return s }
  return null
}

// ---------- 建單並送出 ----------
export async function createAndSubmit(client: SupabaseClient, user: Record<string, unknown>, moduleCode: string, payload: Record<string, unknown>, ctx: { source?: string; ip?: string; ua?: string } = {}) {
  const mod = MODULE_MAP[moduleCode]
  if (!mod || mod.kind !== 'request') throw new Error('模組不可開單: ' + moduleCode)
  const amount = mod.amountField ? Number(payload[mod.amountField]) || 0 : null
  const title = `${mod.name} · ${user.display_name}`
  const risk = assessRisk(moduleCode, payload)
  const no = genNo(moduleCode)
  const now = new Date().toISOString()

  const { data: requestData, error } = await db(client).from('requests').insert({
    request_no: no, module_code: moduleCode, form_code: moduleCode + '_request',
    requester_user_id: user.id, requester_department_id: user.department_id || null,
    title, status: 'in_review', amount, payload_json: JSON.stringify(payload),
    risk_level: risk, source: ctx.source || 'manual', submitted_at: now
  }).select().single()
  if (error) throw new Error('建單失敗: ' + error.message)

  // Compensation: mark as 'error' if any subsequent step fails (Supabase has no multi-step transactions)
  try {
    await createDetail(client, moduleCode, requestData, payload)
    await expandSteps(client, requestData, payload)
    await syncCurrentStep(client, requestData.id)
    await recordAction(client, requestData.id, null, Number(user.id), 'submit', 'draft', 'in_review', null, ctx)
    await notifyActiveApprovers(client, requestData.id, title)
  } catch (e) {
    void Promise.resolve(db(client).from('requests').update({ status: 'error' }).eq('id', requestData.id))
    throw e
  }
  return await getReq(client, requestData.id)
}

// ---------- 簽核動作 ----------
export async function act(client: SupabaseClient, user: Record<string, unknown>, requestId: number, action: string, comment: string | null, ctx: { ip?: string; ua?: string } = {}) {
  const request = await getReq(client, requestId)
  if (!request) throw new Error('單據不存在')
  if (request.status !== 'in_review' && action !== 'cancel') throw new Error('此單目前狀態不可簽核：' + request.status)
  const now = new Date().toISOString()

  if (action === 'cancel') {
    if (request.requester_user_id !== user.id) throw new Error('只有申請人可取消')
    await db(client).from('requests').update({ status: 'cancelled', cancelled_at: now }).eq('id', requestId)
    await recordAction(client, requestId, null, Number(user.id), 'cancel', request.status, 'cancelled', comment, ctx)
    return await getReq(client, requestId)
  }

  const step = await getActiveStepFor(client, user, requestId)
  if (!step) throw new Error('你不是這張單目前的簽核人')
  const tierNo = step.step_no

  if (action === 'approve') {
    await db(client).from('approval_steps').update({ status: 'approved', completed_at: now }).eq('id', step.id)
    await recordAction(client, requestId, step.id, Number(user.id), 'approve', 'in_review', 'in_review', comment, ctx)
    let tierDone = false
    if ((step.required_mode || 'all') === 'any') {
      await db(client).from('approval_steps').update({ status: 'skipped', completed_at: now }).eq('request_id', requestId).eq('step_no', tierNo).eq('status', 'active')
      tierDone = true
    } else {
      const { count } = await db(client).from('approval_steps').select('id', { count: 'exact', head: true }).eq('request_id', requestId).eq('step_no', tierNo).eq('status', 'active')
      tierDone = (count ?? 1) === 0
    }
    if (tierDone) {
      const { data: nextSteps } = await db(client).from('approval_steps').select('step_no').eq('request_id', requestId).eq('status', 'pending').order('step_no').limit(1)
      if (nextSteps && nextSteps.length > 0) {
        const next = nextSteps[0].step_no
        await db(client).from('approval_steps').update({ status: 'active', started_at: now }).eq('request_id', requestId).eq('step_no', next).eq('status', 'pending')
        await db(client).from('requests').update({ current_step_no: next }).eq('id', requestId)
        await notifyActiveApprovers(client, requestId, request.title)
      } else {
        await db(client).from('requests').update({ status: 'approved', completed_at: now }).eq('id', requestId)
        await recordAction(client, requestId, null, Number(user.id), 'system_approve', 'in_review', 'approved', '全部關卡完成', ctx)
        await runPostHooks(client, await getReq(client, requestId))
        await notifyRequester(client, request, '您的單已核准', `${request.title} 已完成簽核`)
      }
    }
  } else if (action === 'reject') {
    await db(client).from('approval_steps').update({ status: 'rejected', completed_at: now }).eq('id', step.id)
    await db(client).from('requests').update({ status: 'rejected', completed_at: now }).eq('id', requestId)
    await recordAction(client, requestId, step.id, Number(user.id), 'reject', 'in_review', 'rejected', comment, ctx)
    await notifyRequester(client, request, '您的單被退回（駁回）', `${request.title} 被駁回：${comment || ''}`)
  } else if (action === 'return') {
    await db(client).from('approval_steps').update({ status: 'returned', completed_at: now }).eq('id', step.id)
    await db(client).from('requests').update({ status: 'returned' }).eq('id', requestId)
    await recordAction(client, requestId, step.id, Number(user.id), 'return', 'in_review', 'returned', comment, ctx)
    await notifyRequester(client, request, '您的單需補件', `${request.title} 被退回修改：${comment || ''}`)
  } else { throw new Error('未知動作：' + action) }

  return await getReq(client, requestId)
}

// ---------- 加簽 ----------
export async function addStep(client: SupabaseClient, user: Record<string, unknown>, requestId: number, opts: { user_id?: number; role_code?: string; name?: string }, ctx: { ip?: string; ua?: string } = {}) {
  const request = await getReq(client, requestId)
  if (!request || request.status !== 'in_review') throw new Error('此單不可加簽')
  const cur = await getActiveStepFor(client, user, requestId)
  if (!cur) throw new Error('只有目前簽核人可加簽')
  let approver: Record<string, unknown> | null = null
  if (opts.user_id) {
    const { data: targetUser } = await db(client).from('users').select('id').eq('id', opts.user_id).eq('status', 'active').single()
    if (!targetUser) throw new Error('加簽對象不存在或已停用')
    approver = { approver_user_id: opts.user_id, approver_type: 'user' }
  } else if (opts.role_code) { const r = await getRole(client, opts.role_code); if (r) approver = { approver_role_id: r.id, approver_type: 'role' } }
  if (!approver) throw new Error('請指定加簽對象')
  const { data: existing } = await db(client).from('approval_steps').select('step_no').eq('request_id', requestId)
  const used = new Set((existing || []).map((r: { step_no: number }) => r.step_no))
  let insertNo = cur.step_no + 1
  while (used.has(insertNo)) insertNo++
  await db(client).from('approval_steps').insert({
    request_id: requestId, step_no: insertNo, step_type: 'serial', name: opts.name || '加簽關卡',
    approver_type: approver.approver_type, approver_user_id: approver.approver_user_id || null,
    approver_role_id: approver.approver_role_id || null, required_mode: 'all', status: 'pending'
  })
  await recordAction(client, requestId, cur.id, Number(user.id), 'add_step', 'in_review', 'in_review', opts.name || '加簽', ctx)
  return await getReq(client, requestId)
}

// ---------- 重送 ----------
export async function resubmit(client: SupabaseClient, user: Record<string, unknown>, requestId: number, payload: Record<string, unknown>, ctx: { ip?: string; ua?: string } = {}) {
  const request = await getReq(client, requestId)
  if (!request || request.requester_user_id !== user.id) throw new Error('無權重送')
  if (request.status !== 'returned') throw new Error('僅退回的單可重送')
  if (payload) await db(client).from('requests').update({ payload_json: JSON.stringify(payload) }).eq('id', requestId)
  // Soft-archive old steps to preserve approval_actions FK audit trail (never hard-DELETE)
  await db(client).from('approval_steps').update({ status: 'archived' }).eq('request_id', requestId).neq('status', 'archived')
  await db(client).from('requests').update({ status: 'in_review', submitted_at: new Date().toISOString() }).eq('id', requestId)
  const fresh = await getReq(client, requestId)
  await expandSteps(client, fresh, payload || JSON.parse(fresh.payload_json || '{}'))
  await syncCurrentStep(client, requestId)
  await recordAction(client, requestId, null, Number(user.id), 'resubmit', 'returned', 'in_review', null, ctx)
  await notifyActiveApprovers(client, requestId, request.title)
  return await getReq(client, requestId)
}
