import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authBearerUser, companyOf, jsonCors, preflight } from '@/lib/agent-auth'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

// GET /api/v1/directory — Bearer JWT 版同公司在職成員清單（id + display_name + 部門）。
// 供 agent app 對 user 類欄位(如職務代理人)填正確 user id（非人名字串）。
// 鏡像 cookie 版 /api/directory，唯身分改 authBearerUser；service client 僅在驗身分後做同公司 scope 查詢。
export async function GET(req: NextRequest) {
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })

  const companyId = companyOf(user)
  const db = createServiceClient().schema('aido')
  const { data, error } = await db
    .from('users')
    .select('id, employee_no, display_name, department_id, departments:department_id(id, name)')
    .eq('company_id', companyId)
    .neq('status', 'resigned')
    .order('employee_no', { ascending: true })

  if (error) return jsonCors(req, { error: error.message }, { status: 500 })

  const pick = <T,>(rel: T | T[] | null): T | null => (Array.isArray(rel) ? rel[0] ?? null : rel)
  const members = (data ?? []).map(u => {
    const dept = pick(u.departments) as { name?: string } | null
    return {
      id: u.id,
      employee_no: u.employee_no,
      display_name: u.display_name,
      department_name: dept?.name ?? null,
    }
  })
  return jsonCors(req, { members })
}
