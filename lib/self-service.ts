import type { SupabaseClient } from '@supabase/supabase-js'
import { getEffectiveModule } from '@/lib/platform-config'
import { toCsv } from '@/lib/export'

// 員工自助讀取邏輯的「單一真相」。後台(cookie route)與對外(/api/v1 Bearer route)共用同一份，
// 確保兩條入口永遠回傳一致結構、scope 不漂移。所有函式以 service client + 已解析的 aiDoUser 操作，
// 身分/scope 由各 route 的認證層先決定，這裡只負責「本人視角」的資料組裝。

type AnyRow = Record<string, unknown>
type DetailResult =
  | { ok: true; data: AnyRow }
  | { ok: false; error: 'notfound' | 'forbidden' }

const PRIVILEGED_ROLES = ['hr', 'executive', 'auditor', 'admin_officer']
const REPORT_STATUS_MAP: Record<string, string> = {
  draft: '草稿', in_review: '審核中', approved: '已核准', rejected: '已駁回', returned: '退回', cancelled: '已取消',
}

function roleArmOf(user: AnyRow): string {
  return user.primary_role_id ? `,approver_role_id.eq.${user.primary_role_id}` : ''
}

/** 單據詳情 + 簽核步驟 + 簽核軌跡 + 模組欄位定義（self / approver / 特權角色可看）。 */
export async function getRequestDetail(svc: SupabaseClient, aiDoUser: AnyRow, id: number): Promise<DetailResult> {
  const db = svc.schema('aido')
  const { data: request } = await db.from('requests')
    .select('*, users!requests_requester_user_id_fkey(id,display_name,email)')
    .eq('id', id).single()
  if (!request) return { ok: false, error: 'notfound' }

  const { data: aiDoRole } = await db.from('roles').select('code').eq('id', aiDoUser.primary_role_id as number).single()
  const roleCode = aiDoRole?.code ?? 'employee'

  if ((request as AnyRow).requester_user_id !== aiDoUser.id && !PRIVILEGED_ROLES.includes(roleCode)) {
    const { data: approverStep } = await db.from('approval_steps').select('id')
      .eq('request_id', id)
      .or(`approver_user_id.eq.${aiDoUser.id}${roleArmOf(aiDoUser)}`)
      .limit(1).maybeSingle()
    if (!approverStep) return { ok: false, error: 'forbidden' }
  }

  const [{ data: steps }, { data: actions }] = await Promise.all([
    db.from('approval_steps')
      .select('*, users!approval_steps_approver_user_id_fkey(id,display_name), roles!approval_steps_approver_role_id_fkey(name)')
      .eq('request_id', id).order('step_no'),
    db.from('approval_actions')
      .select('*, users!approval_actions_actor_user_id_fkey(id,display_name)')
      .eq('request_id', id).order('created_at'),
  ])

  const payloadRaw = (request as AnyRow).payload_json
  const payload = payloadRaw ? JSON.parse(String(payloadRaw)) : {}
  const mod = await getEffectiveModule((aiDoUser.company_id as number) ?? 1, String((request as AnyRow).module_code))
  const fields = mod?.fields ?? []
  // 敏感欄位伺服器端遮罩：非本人且角色不在 SENSITIVE_VIEW_ROLES 者，sensitive 欄位的值不送到 client（如調薪 new_salary）。
  const isSelf = (request as AnyRow).requester_user_id === aiDoUser.id
  const SENSITIVE_VIEW_ROLES = ['hr', 'finance', 'executive', 'auditor']
  if (!isSelf && !SENSITIVE_VIEW_ROLES.includes(roleCode)) {
    for (const f of fields) {
      if (f.sensitive && payload[f.key] != null && payload[f.key] !== '') payload[f.key] = '※※※（受保護）'
    }
  }
  // 移除原始 payload_json，避免被遮罩的敏感值仍以原文隨 ...request 送到 client（client 只用解析後的 payload）。
  const requestOut: AnyRow = { ...(request as AnyRow), payload }
  delete requestOut.payload_json
  return { ok: true, data: { request: requestOut, fields, steps: steps || [], actions: actions || [], currentUser: aiDoUser } }
}

/** 待我簽核（active 步驟指向我或我的角色）+ 我的申請（非草稿，近 30 筆）。 */
export async function listApprovals(svc: SupabaseClient, aiDoUser: AnyRow) {
  const db = svc.schema('aido')
  const [{ data: pendingSteps }, { data: myRequests }] = await Promise.all([
    db.from('approval_steps')
      .select('request_id, requests!inner(id, request_no, module_code, title, status, created_at, submitted_at, requester_user_id, users!requests_requester_user_id_fkey(display_name))')
      .eq('status', 'active')
      .or(`approver_user_id.eq.${aiDoUser.id}${roleArmOf(aiDoUser)}`),
    db.from('requests').select('id, request_no, module_code, title, status, created_at, submitted_at')
      .eq('requester_user_id', aiDoUser.id as number)
      .not('status', 'eq', 'draft')
      .order('created_at', { ascending: false })
      .limit(30),
  ])
  const uniquePending = Array.from(
    new Map((pendingSteps || []).map((s: AnyRow) => [s.request_id, s.requests])).values()
  ).filter(Boolean)
  return { pending: uniquePending, my_requests: myRequests || [] }
}

/** 本人通知清單（近 50 筆）。 */
export async function listNotifications(svc: SupabaseClient, aiDoUser: AnyRow) {
  const { data } = await svc.schema('aido').from('notifications')
    .select('*').eq('user_id', aiDoUser.id as number).order('created_at', { ascending: false }).limit(50)
  return data || []
}

/** 標記通知已讀。ids 指定則只標那些，否則全部未讀標已讀。 */
export async function markNotificationsRead(svc: SupabaseClient, aiDoUser: AnyRow, ids?: number[]) {
  const db = svc.schema('aido')
  const now = new Date().toISOString()
  if (ids && Array.isArray(ids)) {
    await db.from('notifications').update({ read_at: now }).in('id', ids).eq('user_id', aiDoUser.id as number)
  } else {
    await db.from('notifications').update({ read_at: now }).eq('user_id', aiDoUser.id as number).is('read_at', null)
  }
}

/** 本人未讀通知數。 */
export async function countUnreadNotifications(svc: SupabaseClient, aiDoUser: AnyRow): Promise<number> {
  const { count } = await svc.schema('aido').from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', aiDoUser.id as number)
    .is('read_at', null)
  return count || 0
}

/** 個人儀表板：我的近 5 單、待簽數、公告、假期餘額、今日打卡。 */
export async function getDashboard(svc: SupabaseClient, aiDoUser: AnyRow) {
  const db = svc.schema('aido')
  const userId = aiDoUser.id as number
  const roleCode = (aiDoUser.roles as { code?: string } | null)?.code ?? 'employee'
  const today = new Date().toISOString().slice(0, 10)

  const [
    { data: myRequests },
    { count: pendingCount },
    { data: announcements },
    { data: leaveBalances },
    { data: attendance },
  ] = await Promise.all([
    db.from('requests').select('id,request_no,module_code,title,status,created_at').eq('requester_user_id', userId).order('created_at', { ascending: false }).limit(5),
    db.from('approval_steps').select('id', { count: 'exact', head: true }).eq('status', 'active').or(`approver_user_id.eq.${userId}${roleArmOf(aiDoUser)}`),
    db.from('announcements').select('id,title,created_at').eq('status', 'published').order('created_at', { ascending: false }).limit(3),
    db.from('leave_balances').select('*, leave_types(name)').eq('user_id', userId),
    db.from('attendance_records').select('clock_in_at,clock_out_at').eq('user_id', userId).eq('work_date', today).maybeSingle(),
  ])

  return {
    roleCode, userId,
    my_requests: myRequests || [],
    pending_approvals_count: pendingCount || 0,
    announcements: announcements || [],
    leave_balances: leaveBalances || [],
    today_attendance: attendance,
  }
}

/** 公司級申請單統計（byStatus / byModule / byMonth / 金額 + 明細）。company-scoped。 */
export async function getReport(svc: SupabaseClient, aiDoUser: AnyRow) {
  const companyId = (aiDoUser.company_id as number) ?? 1
  const { data: requests } = await svc.schema('aido').from('requests')
    .select('status, module_code, amount, created_at, requester_user_id')
    .eq('company_id', companyId).order('created_at', { ascending: false }).limit(2000)

  const byStatus: Record<string, number> = {}
  const byModule: Record<string, number> = {}
  const byMonth: Record<string, number> = {}
  let totalAmount = 0
  for (const r of (requests || []) as AnyRow[]) {
    byStatus[String(r.status)] = (byStatus[String(r.status)] || 0) + 1
    byModule[String(r.module_code)] = (byModule[String(r.module_code)] || 0) + 1
    const m = String(r.created_at).slice(0, 7)
    byMonth[m] = (byMonth[m] || 0) + 1
    totalAmount += Number(r.amount) || 0
  }
  return { total: requests?.length || 0, byStatus, byModule, byMonth, totalAmount, rows: requests || [] }
}

/** 公司級申請單匯出 CSV（民國日期 + 中文狀態）。company-scoped。 */
export async function getReportCsv(svc: SupabaseClient, aiDoUser: AnyRow): Promise<string> {
  const companyId = (aiDoUser.company_id as number) ?? 1
  const { data: rows } = await svc.schema('aido').from('requests')
    .select('request_no, module_code, title, status, amount, created_at')
    .eq('company_id', companyId).order('created_at', { ascending: false }).limit(5000)

  const mapped = ((rows || []) as AnyRow[]).map(r => ({
    ...r,
    status: REPORT_STATUS_MAP[String(r.status)] || r.status,
    created_at: r.created_at ? new Date(String(r.created_at)).toLocaleDateString('zh-TW') : '',
  }))
  return toCsv(mapped, [
    { key: 'request_no', label: '單號' }, { key: 'module_code', label: '類別' },
    { key: 'title', label: '標題' }, { key: 'status', label: '狀態' },
    { key: 'amount', label: '金額' }, { key: 'created_at', label: '申請日' },
  ])
}
