import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getEffectiveModule, resolveRolePermissions } from '@/lib/platform-config'
import { createAndSubmit, createDraft, updateDraft, submitDraft } from '@/lib/bpm'

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const db = svc.schema('aido')
  const { data: aiDoUser } = await db.from('users').select('*, roles!users_primary_role_id_fkey(code)').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const roleCode = aiDoUser.roles?.code ?? 'employee'
  const companyId = aiDoUser.company_id ?? 1
  const mod = await getEffectiveModule(companyId, code)   // 含自訂表單
  if (!mod) return NextResponse.json({ error: 'Module not found' }, { status: 404 })
  const perms = await resolveRolePermissions(companyId, roleCode)
  if (!perms.visibleModuleCodes.includes(code)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (mod.kind === 'request') {
    // ?status=approved,in_review → 過濾單據狀態（relation 下拉用，如只列已核准的出差單）
    const statusParam = req.nextUrl.searchParams.get('status')
    const statusFilter = statusParam ? statusParam.split(',').map(s => s.trim()).filter(Boolean) : []
    let q = db.from('requests').select('*').eq('module_code', code).eq('requester_user_id', aiDoUser.id)
    if (statusFilter.length > 0) q = q.in('status', statusFilter)
    const { data } = await q.order('created_at', { ascending: false }).limit(50)
    // 解開 payload_json：附 payload 物件 + 攤平 payload.xxx（讓 columns 的 payload.destination 等取得到值）
    const items = (data || []).map(r => {
      let payload: Record<string, unknown> = {}
      try { payload = r.payload_json ? JSON.parse(r.payload_json) : {} } catch { payload = {} }
      const flat: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(payload)) flat[`payload.${k}`] = v
      return { ...r, payload, ...flat }
    })
    return NextResponse.json({ items, mod })
  }

  if (mod.kind === 'record' && mod.table) {
    const query = db.from(mod.table).select('*').eq('company_id', aiDoUser.company_id ?? 1).order('created_at' as string, { ascending: false }).limit(50)
    const scopedRoles = ['employee', 'manager']
    const { data } = scopedRoles.includes(roleCode)
      ? await query.eq('user_id' as string, aiDoUser.id)
      : await query
    return NextResponse.json({ items: data || [], mod })
  }

  return NextResponse.json({ items: [], mod })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const db = svc.schema('aido')
  const { data: aiDoUser } = await db.from('users').select('*').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const mod = await getEffectiveModule(aiDoUser.company_id ?? 1, code)   // 含自訂表單
  if (!mod) return NextResponse.json({ error: 'Module not found' }, { status: 404 })

  const payload = await req.json()
  const ip = req.headers.get('x-forwarded-for') || undefined
  const ua = req.headers.get('user-agent') || undefined

  if (mod.kind === 'request') {
    // mode=draft → 存/更新草稿；mode=submit(預設)；?id=<draftId> 代表由既有草稿更新或送出
    const mode = req.nextUrl.searchParams.get('mode')
    const draftId = req.nextUrl.searchParams.get('id')
    try {
      let result
      if (mode === 'draft' && draftId) result = await updateDraft(svc, aiDoUser, Number(draftId), payload)
      else if (mode === 'draft') result = await createDraft(svc, aiDoUser, code, payload, {})
      else if (draftId) result = await submitDraft(svc, aiDoUser, Number(draftId), payload, { ip, ua })
      else result = await createAndSubmit(svc, aiDoUser, code, payload, { ip, ua })
      return NextResponse.json({ ok: true, request: result })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '送出失敗'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  }

  if (mod.kind === 'record' && mod.table) {
    const { data, error } = await db.from(mod.table).insert({ ...payload, created_by_user_id: aiDoUser.id, company_id: aiDoUser.company_id ?? 1 }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, record: data })
  }

  return NextResponse.json({ error: 'Cannot create for this module type' }, { status: 400 })
}
