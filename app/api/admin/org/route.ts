import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/session'
import { ADMIN_ROLES } from '@/lib/api-guard'

function requireAdmin(roleCode: string) {
  return ADMIN_ROLES.includes(roleCode)
    ? null
    : NextResponse.json({ error: '無操作權限' }, { status: 403 })
}

// GET /api/admin/org — 列出全部部門 + 各部門成員數
// 唯讀：組織架構對全公司開放檢視（org module 對所有角色 visible），
// 故不擋讀，僅以 company_id 鎖租戶。寫入(POST/PUT/DELETE)仍需 admin。
export async function GET() {
  const user = await getSessionUser()
  const db = createServiceClient().schema('aido')

  const { data: depts, error } = await db
    .from('departments')
    .select('id, code, name, parent_id, manager_user_id, sort_order, status, cost_center, created_at')
    .eq('company_id', user.companyId)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 計算各部門成員數
  const { data: memberCounts } = await db
    .from('users')
    .select('department_id')
    .eq('company_id', user.companyId)
    .neq('status', 'resigned')

  const countMap: Record<number, number> = {}
  for (const m of memberCounts ?? []) {
    if (m.department_id != null) {
      countMap[m.department_id] = (countMap[m.department_id] ?? 0) + 1
    }
  }

  // 取主管姓名（必須鎖 company_id 防跨租戶洩漏）
  const managerIds = [...new Set((depts ?? []).map(d => d.manager_user_id).filter(Boolean) as number[])]
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

  const result = (depts ?? []).map(d => ({
    ...d,
    member_count: countMap[d.id] ?? 0,
    manager_name: d.manager_user_id ? managerMap[d.manager_user_id] ?? null : null,
  }))

  return NextResponse.json({ departments: result })
}

// POST /api/admin/org — 新增部門
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  const denied = requireAdmin(user.roleCode)
  if (denied) return denied
  const body = await req.json()
  const { name, code, parent_id, manager_user_id, sort_order, cost_center } = body

  if (!name) return NextResponse.json({ error: '部門名稱為必填' }, { status: 400 })

  const db = createServiceClient().schema('aido')
  const { data, error } = await db
    .from('departments')
    .insert({
      company_id: user.companyId,
      name,
      code: code ?? null,
      parent_id: parent_id ?? null,
      manager_user_id: manager_user_id ?? null,
      sort_order: sort_order ?? 0,
      cost_center: cost_center ?? null,
      status: 'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ department: data })
}

// PUT /api/admin/org — 編輯部門
export async function PUT(req: NextRequest) {
  const user = await getSessionUser()
  const denied = requireAdmin(user.roleCode)
  if (denied) return denied
  const body = await req.json()
  const { id, name, code, parent_id, manager_user_id, sort_order, cost_center } = body

  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '部門名稱為必填' }, { status: 400 })
  // 防止自我參照循環（自己設自己為上層）
  if (parent_id != null && Number(parent_id) === Number(id)) {
    return NextResponse.json({ error: '上層部門不能設為自身' }, { status: 400 })
  }

  const db = createServiceClient().schema('aido')
  const { data, error } = await db
    .from('departments')
    .update({
      name,
      code: code ?? null,
      parent_id: parent_id ?? null,
      manager_user_id: manager_user_id ?? null,
      sort_order: sort_order ?? 0,
      cost_center: cost_center ?? null,
    })
    .eq('id', id)
    .eq('company_id', user.companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ department: data })
}

// DELETE /api/admin/org?id= — 刪除部門（有子部門或成員則擋）
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser()
  const denied = requireAdmin(user.roleCode)
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const id = Number(searchParams.get('id'))
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const db = createServiceClient().schema('aido')

  // 確認同公司
  const { data: dept } = await db
    .from('departments')
    .select('id')
    .eq('id', id)
    .eq('company_id', user.companyId)
    .single()
  if (!dept) return NextResponse.json({ error: '找不到部門' }, { status: 404 })

  // 有子部門則擋
  const { count: childCount } = await db
    .from('departments')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', id)
    .eq('company_id', user.companyId)
  if ((childCount ?? 0) > 0) return NextResponse.json({ error: '此部門下有子部門，無法刪除' }, { status: 409 })

  // 有成員則擋
  const { count: memberCount } = await db
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('department_id', id)
    .eq('company_id', user.companyId)
    .neq('status', 'resigned')
  if ((memberCount ?? 0) > 0) return NextResponse.json({ error: '此部門下有成員，無法刪除' }, { status: 409 })

  const { error } = await db
    .from('departments')
    .delete()
    .eq('id', id)
    .eq('company_id', user.companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
