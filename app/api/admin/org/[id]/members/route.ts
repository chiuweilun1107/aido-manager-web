import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/session'

// GET /api/admin/org/[id]/members — 列出某部門的在職成員（含職稱、是否為部門主管）
// 唯讀：與 /api/admin/org GET 一致，組織架構對全公司開放檢視，僅以 company_id 鎖租戶。
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()

  const { id } = await params
  const deptId = Number(id)
  if (!deptId) return NextResponse.json({ error: '缺少部門 id' }, { status: 400 })

  const db = createServiceClient().schema('aido')

  // 確認部門屬於同公司（防跨租戶查詢），並取主管 id 用於標記
  const { data: dept } = await db
    .from('departments')
    .select('id, manager_user_id')
    .eq('id', deptId)
    .eq('company_id', user.companyId)
    .single()
  if (!dept) return NextResponse.json({ error: '找不到部門' }, { status: 404 })

  const { data, error } = await db
    .from('users')
    .select(`
      id, employee_no, display_name, status,
      position_id,
      positions:position_id(id, title, grade)
    `)
    .eq('company_id', user.companyId)
    .eq('department_id', deptId)
    .neq('status', 'resigned')
    .order('employee_no', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const members = (data ?? []).map(u => {
    const pos = Array.isArray(u.positions) ? u.positions[0] : u.positions
    return {
      id: u.id,
      employee_no: u.employee_no,
      display_name: u.display_name,
      status: u.status,
      position_title: (pos as { title?: string } | null)?.title ?? null,
      is_manager: dept.manager_user_id != null && u.id === dept.manager_user_id,
    }
  })

  return NextResponse.json({ members })
}
