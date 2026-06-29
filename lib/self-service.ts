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

// ---- 敏感欄位遮罩：單一真相 ----
// detail（getRequestDetail）與簽核動作回傳（maskRequestForViewer）等所有「可能被非本人看到」的
// 路徑共用同一份遮罩規則，避免邏輯在多處複製貼上而漂移（例如某處改了 SENSITIVE_VIEW_ROLES 另一處沒跟上）。
export const SENSITIVE_VIEW_ROLES = ['hr', 'finance', 'executive', 'auditor']

type ModuleFieldLike = { key: string; sensitive?: boolean }

/** 依角色/本人與否，回傳「遮罩後的 payload 副本」（不 mutate 傳入物件）。
 *  本人或角色在 SENSITIVE_VIEW_ROLES → 原值；其餘 → sensitive 欄位值換成保護字串（如調薪 new_salary）。 */
export function maskSensitivePayload(
  payload: Record<string, unknown>,
  fields: ModuleFieldLike[] | undefined,
  opts: { isSelf: boolean; roleCode: string },
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload }
  if (opts.isSelf || SENSITIVE_VIEW_ROLES.includes(opts.roleCode)) return out
  for (const f of fields || []) {
    if (f.sensitive && out[f.key] != null && out[f.key] !== '') out[f.key] = '※※※（受保護）'
  }
  return out
}

/** 回傳移除 payload_json 原文的 row 副本：避免被遮罩的敏感值仍以原文隨 ...request 送到 client。 */
export function stripPayloadJson<T extends AnyRow>(row: T): T {
  const out: AnyRow = { ...row }
  delete out.payload_json
  return out as T
}

/** 解出本人視角的角色碼（aiDoUser 可能帶 roles join，或只有 primary_role_id）。 */
async function resolveRoleCode(svc: SupabaseClient, aiDoUser: AnyRow): Promise<string> {
  const joined = (aiDoUser.roles as { code?: string } | null | undefined)?.code
  if (joined) return joined
  if (aiDoUser.primary_role_id == null) return 'employee'
  const { data } = await svc.schema('aido').from('roles').select('code').eq('id', aiDoUser.primary_role_id as number).single()
  return data?.code ?? 'employee'
}

/** 把「簽核動作後回傳的 request 原始 row」轉成可安全送到 client 的版本：
 *  依檢視者角色遮罩 sensitive 欄位 + 移除 payload_json 原文。簽核動作（act/addStep/resubmit）的回傳
 *  可能被「非申請人的簽核人」看到（如 manager 批調薪單），故與 getRequestDetail 共用同一遮罩規則。 */
export async function maskRequestForViewer(svc: SupabaseClient, aiDoUser: AnyRow, row: AnyRow | null): Promise<AnyRow | null> {
  if (!row) return row
  const roleCode = await resolveRoleCode(svc, aiDoUser)
  const isSelf = row.requester_user_id === aiDoUser.id
  const mod = await getEffectiveModule((row.company_id as number) ?? (aiDoUser.company_id as number) ?? 1, String(row.module_code))
  const payload = row.payload_json ? JSON.parse(String(row.payload_json)) : {}
  const masked = maskSensitivePayload(payload, mod?.fields ?? [], { isSelf, roleCode })
  return stripPayloadJson({ ...row, payload: masked })
}

/** 單據詳情 + 簽核步驟 + 簽核軌跡 + 模組欄位定義（self / approver / 特權角色可看）。 */
export async function getRequestDetail(svc: SupabaseClient, aiDoUser: AnyRow, id: number): Promise<DetailResult> {
  const db = svc.schema('aido')
  const { data: request } = await db.from('requests')
    .select('*, users!requests_requester_user_id_fkey(id,display_name,email)')
    .eq('id', id)
    .eq('company_id', (aiDoUser.company_id as number) ?? 1) // 跨租戶隔離：只讓檢視者讀自己 company 的單
    .single()
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
  const rawPayload = payloadRaw ? JSON.parse(String(payloadRaw)) : {}
  const mod = await getEffectiveModule((aiDoUser.company_id as number) ?? 1, String((request as AnyRow).module_code))
  const fields = mod?.fields ?? []
  // 敏感欄位伺服器端遮罩 + 移除 payload_json 原文：共用 maskSensitivePayload / stripPayloadJson，
  // 與簽核動作回傳路徑（maskRequestForViewer）同一份規則，杜絕多處複製貼上而漂移。
  const isSelf = (request as AnyRow).requester_user_id === aiDoUser.id
  const payload = maskSensitivePayload(rawPayload, fields, { isSelf, roleCode })
  const requestOut = stripPayloadJson({ ...(request as AnyRow), payload })
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
