import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const SEED_SECRET = process.env.SEED_SECRET || 'aido-dev-seed-2026'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Seed not available in production' }, { status: 403 })
  }
  const secret = req.headers.get('x-seed-secret')
  if (secret !== SEED_SECRET) {
    return NextResponse.json({ error: 'Invalid seed secret' }, { status: 403 })
  }

  const svc = createServiceClient()
  const db = svc.schema('aido')
  const auth = svc.auth

  const results: string[] = []

  // 1. Seed roles
  const ROLES = [
    { code: 'employee', name: '員工', dashboard_route: '/dashboard', level: 1 },
    { code: 'manager', name: '主管', dashboard_route: '/dashboard', level: 2 },
    { code: 'hr', name: 'HR 人資', dashboard_route: '/dashboard', level: 3 },
    { code: 'it', name: 'IT 資訊', dashboard_route: '/dashboard', level: 2 },
    { code: 'finance', name: '財務', dashboard_route: '/dashboard', level: 3 },
    { code: 'executive', name: '經營者', dashboard_route: '/dashboard', level: 5 },
    { code: 'admin_officer', name: '行政', dashboard_route: '/dashboard', level: 2 },
    { code: 'legal', name: '法務', dashboard_route: '/dashboard', level: 3 },
    { code: 'auditor', name: '稽核', dashboard_route: '/dashboard', level: 4 },
  ]
  await db.from('roles').upsert(ROLES, { onConflict: 'code' })
  results.push(`roles: ${ROLES.length}`)

  // 2. Seed departments
  const DEPARTMENTS = [
    { code: 'MGMT', name: '管理部', sort_order: 1 },
    { code: 'HR', name: '人資部', sort_order: 2 },
    { code: 'IT', name: '資訊部', sort_order: 3 },
    { code: 'FIN', name: '財務部', sort_order: 4 },
    { code: 'LEGAL', name: '法務部', sort_order: 5 },
    { code: 'OPS', name: '營運部', sort_order: 6 },
  ]
  await db.from('departments').upsert(DEPARTMENTS, { onConflict: 'code' })
  results.push(`departments: ${DEPARTMENTS.length}`)

  // 3. Get role/dept IDs
  const { data: roles } = await db.from('roles').select('id,code')
  const { data: depts } = await db.from('departments').select('id,code')
  const roleMap = Object.fromEntries((roles || []).map(r => [r.code, r.id]))
  const deptMap = Object.fromEntries((depts || []).map(d => [d.code, d.id]))

  // 4. Seed leave types
  const LEAVE_TYPES = [
    { code: 'annual', name: '特休假', unit: 'hour', paid_type: 'paid' },
    { code: 'sick', name: '病假', unit: 'hour', paid_type: 'half' },
    { code: 'personal', name: '事假', unit: 'hour', paid_type: 'unpaid' },
    { code: 'marriage', name: '婚假', unit: 'day', paid_type: 'paid' },
    { code: 'bereavement', name: '喪假', unit: 'day', paid_type: 'paid' },
    { code: 'maternity', name: '產假', unit: 'day', paid_type: 'paid' },
    { code: 'paternity', name: '陪產假', unit: 'day', paid_type: 'paid' },
  ]
  await db.from('leave_types').upsert(LEAVE_TYPES, { onConflict: 'code' })
  results.push(`leave_types: ${LEAVE_TYPES.length}`)

  // 5. Seed 12 users (via Supabase Auth + aido.users)
  const USERS = [
    { email: 'chen.zhiming@aido.demo', name: '陳志明', roleCode: 'employee', deptCode: 'OPS', empNo: 'E001' },
    { email: 'lin.meihua@aido.demo', name: '林美華', roleCode: 'manager', deptCode: 'OPS', empNo: 'E002' },
    { email: 'zhang.huifang@aido.demo', name: '張惠芳', roleCode: 'hr', deptCode: 'HR', empNo: 'E003' },
    { email: 'huang.jianhong@aido.demo', name: '黃建宏', roleCode: 'it', deptCode: 'IT', empNo: 'E004' },
    { email: 'liu.fangyi@aido.demo', name: '劉芳儀', roleCode: 'finance', deptCode: 'FIN', empNo: 'E005' },
    { email: 'wang.daming@aido.demo', name: '王大明', roleCode: 'executive', deptCode: 'MGMT', empNo: 'E006' },
    { email: 'wu.xiulan@aido.demo', name: '吳秀蘭', roleCode: 'admin_officer', deptCode: 'MGMT', empNo: 'E007' },
    { email: 'zhao.wenjie@aido.demo', name: '趙文傑', roleCode: 'legal', deptCode: 'LEGAL', empNo: 'E008' },
    { email: 'yang.shufen@aido.demo', name: '楊淑芬', roleCode: 'auditor', deptCode: 'MGMT', empNo: 'E009' },
    { email: 'xu.jianguo@aido.demo', name: '許建國', roleCode: 'employee', deptCode: 'OPS', empNo: 'E010' },
    { email: 'zheng.shujuan@aido.demo', name: '鄭淑娟', roleCode: 'employee', deptCode: 'HR', empNo: 'E011' },
    { email: 'cai.mingzhe@aido.demo', name: '蔡明哲', roleCode: 'manager', deptCode: 'IT', empNo: 'E012' },
  ]

  let userCount = 0
  const createdUsers: { id: number; auth_user_id: string; roleCode: string; deptCode: string }[] = []

  for (const u of USERS) {
    let authUserId: string | null = null
    const { data: existing } = await db.from('users').select('id,auth_user_id').eq('email', u.email).single()

    if (!existing) {
      const { data: authUser, error: authErr } = await auth.admin.createUser({
        email: u.email, password: 'Aido@2026!', email_confirm: true
      })
      if (authErr) { results.push(`WARN: auth create failed for ${u.email}: ${authErr.message}`); continue }
      authUserId = authUser.user.id

      const { data: inserted } = await db.from('users').insert({
        auth_user_id: authUserId,
        email: u.email,
        display_name: u.name,
        employee_no: u.empNo,
        primary_role_id: roleMap[u.roleCode],
        department_id: deptMap[u.deptCode],
        status: 'active',
        hired_at: '2024-01-01T00:00:00Z'
      }).select('id,auth_user_id').single()
      if (inserted) { createdUsers.push({ ...inserted, roleCode: u.roleCode, deptCode: u.deptCode }); userCount++ }
    } else {
      createdUsers.push({ id: existing.id, auth_user_id: existing.auth_user_id, roleCode: u.roleCode, deptCode: u.deptCode })
    }
  }
  results.push(`users created: ${userCount}`)

  // 6. Set manager links: OPS employees → lin.meihua (manager)
  const managerUser = createdUsers.find(u => u.roleCode === 'manager' && u.deptCode === 'OPS')
  if (managerUser) {
    const empIds = createdUsers.filter(u => u.roleCode === 'employee' && u.deptCode === 'OPS').map(u => u.id)
    if (empIds.length) await db.from('users').update({ manager_user_id: managerUser.id }).in('id', empIds)
    results.push(`manager links: ${empIds.length}`)
  }

  // 7. Seed leave balances for all users
  const { data: leaveTypes } = await db.from('leave_types').select('id,code')
  const year = new Date().getFullYear()
  const balanceRows = []
  for (const u of createdUsers) {
    for (const lt of (leaveTypes || [])) {
      balanceRows.push({ user_id: u.id, leave_type_id: lt.id, period_year: year, granted_hours: lt.code === 'annual' ? 80 : 0, used_hours: 0 })
    }
  }
  if (balanceRows.length) {
    await db.from('leave_balances').upsert(balanceRows, { onConflict: 'user_id,leave_type_id,period_year' })
    results.push(`leave_balances: ${balanceRows.length}`)
  }

  // 8. Seed announcement
  const exec = createdUsers.find(u => u.roleCode === 'executive')
  if (exec) {
    await db.from('announcements').upsert([{
      title: '歡迎使用 AiDo 智行企業管理平台',
      body: '本平台整合假勤、薪資、簽核、採購等企業行政功能，請各單位依角色使用對應功能。',
      status: 'published',
      created_by_user_id: exec.id,
      publish_at: new Date().toISOString()
    }], { onConflict: 'title' })
    results.push('announcement: 1')
  }

  return NextResponse.json({ ok: true, results })
}
