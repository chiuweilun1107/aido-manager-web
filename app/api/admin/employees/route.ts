import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/session'
import { ADMIN_ROLES, employeeViewScope } from '@/lib/api-guard'

const VALID_STATUSES = ['active', 'inactive', 'resigned']
function requireAdmin(roleCode: string) {
  return ADMIN_ROLES.includes(roleCode)
    ? null
    : NextResponse.json({ error: '無操作權限' }, { status: 403 })
}

// GET /api/admin/employees — 列出員工 + department/position/role 名
// 讀取分層（寫入仍 admin-only）：
//   admin 角色 + 稽核 → 全公司；主管 manager → 僅同部門；其餘 → 403。
export async function GET() {
  const user = await getSessionUser()
  const scope = employeeViewScope(user.roleCode)
  if (scope === 'none') return NextResponse.json({ error: '無操作權限' }, { status: 403 })
  const db = createServiceClient().schema('aido')

  let query = db
    .from('users')
    .select(`
      id, employee_no, email, display_name, status, auth_user_id,
      department_id, position_id, primary_role_id, manager_user_id,
      hired_at, resigned_at, created_at,
      departments:department_id(id, name),
      positions:position_id(id, title, grade),
      roles:primary_role_id(id, name, code)
    `)
    .eq('company_id', user.companyId)

  // 主管只看自己部門全體；若主管未設部門則退化成只看自己（避免 department_id IS NULL 誤撈他人）
  if (scope === 'department') {
    query = user.departmentId != null
      ? query.eq('department_id', user.departmentId)
      : query.eq('id', user.id)
  }

  const { data, error } = await query.order('employee_no', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 補主管姓名（必須鎖 company_id 防跨租戶洩漏）
  const managerIds = [...new Set((data ?? []).map(u => u.manager_user_id).filter(Boolean) as number[])]
  let managerMap: Record<number, string> = {}
  if (managerIds.length > 0) {
    const { data: managers } = await db
      .from('users')
      .select('id, display_name')
      .in('id', managerIds)
      .eq('company_id', user.companyId)
    for (const m of managers ?? []) {
      managerMap[m.id] = m.display_name
    }
  }

  const result = (data ?? []).map(u => ({
    ...u,
    manager_name: u.manager_user_id ? managerMap[u.manager_user_id] ?? null : null,
  }))

  return NextResponse.json({ employees: result })
}

// POST /api/admin/employees — 新增員工
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  const denied = requireAdmin(user.roleCode)
  if (denied) return denied
  const body = await req.json()
  const {
    email, display_name, employee_no, department_id, position_id,
    primary_role_id, manager_user_id, status, hired_at
  } = body

  if (!email) return NextResponse.json({ error: 'email 為必填' }, { status: 400 })
  if (!display_name) return NextResponse.json({ error: '姓名為必填' }, { status: 400 })
  const resolvedStatus = status ?? 'active'
  if (!VALID_STATUSES.includes(resolvedStatus)) {
    return NextResponse.json({ error: `status 必須是 ${VALID_STATUSES.join('/')}` }, { status: 400 })
  }

  const db = createServiceClient().schema('aido')
  const { data, error } = await db
    .from('users')
    .insert({
      company_id: user.companyId,
      email,
      display_name,
      employee_no: employee_no ?? null,
      department_id: department_id ?? null,
      position_id: position_id ?? null,
      primary_role_id: primary_role_id ?? null,
      manager_user_id: manager_user_id ?? null,
      status: resolvedStatus,
      hired_at: hired_at ?? null,
      auth_user_id: null,
      locale: 'zh-TW',
      timezone: 'Asia/Taipei',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ employee: data })
}

// PUT /api/admin/employees — 編輯員工（含 status='resigned' 離職）
export async function PUT(req: NextRequest) {
  const user = await getSessionUser()
  const denied = requireAdmin(user.roleCode)
  if (denied) return denied
  const body = await req.json()
  const {
    id, email, display_name, employee_no, department_id, position_id,
    primary_role_id, manager_user_id, status, hired_at, resigned_at
  } = body

  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status 必須是 ${VALID_STATUSES.join('/')}` }, { status: 400 })
  }

  const db = createServiceClient().schema('aido')

  const updatePayload: Record<string, unknown> = {}
  if (email !== undefined) updatePayload.email = email
  if (display_name !== undefined) updatePayload.display_name = display_name
  if (employee_no !== undefined) updatePayload.employee_no = employee_no
  if (department_id !== undefined) updatePayload.department_id = department_id ?? null
  if (position_id !== undefined) updatePayload.position_id = position_id ?? null
  if (primary_role_id !== undefined) updatePayload.primary_role_id = primary_role_id ?? null
  if (manager_user_id !== undefined) updatePayload.manager_user_id = manager_user_id ?? null
  if (status !== undefined) updatePayload.status = status
  if (hired_at !== undefined) updatePayload.hired_at = hired_at ?? null
  if (resigned_at !== undefined) updatePayload.resigned_at = resigned_at ?? null

  const { data, error } = await db
    .from('users')
    .update(updatePayload)
    .eq('id', id)
    .eq('company_id', user.companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ employee: data })
}
