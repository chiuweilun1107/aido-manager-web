import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/session'
import { ADMIN_ROLES, employeeViewScope } from '@/lib/api-guard'

function requireAdmin(roleCode: string) {
  return ADMIN_ROLES.includes(roleCode)
    ? null
    : NextResponse.json({ error: '無操作權限' }, { status: 403 })
}

// GET /api/admin/positions — 列出全部職位
// 職位為公司層參考資料（非個人敏感）：開放給可進員工管理頁的角色讀取
// （admin/稽核/主管），不做個人 scoping。寫入仍 admin-only。
export async function GET() {
  const user = await getSessionUser()
  if (employeeViewScope(user.roleCode) === 'none') {
    return NextResponse.json({ error: '無操作權限' }, { status: 403 })
  }
  const db = createServiceClient().schema('aido')

  const { data, error } = await db
    .from('positions')
    .select('id, code, title, grade, job_family, is_manager, status, created_at')
    .eq('company_id', user.companyId)
    .order('grade', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ positions: data ?? [] })
}

// POST /api/admin/positions — 新增職位
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  const denied = requireAdmin(user.roleCode)
  if (denied) return denied
  const body = await req.json()
  const { code, title, grade, job_family, is_manager, status } = body

  if (!title) return NextResponse.json({ error: '職位名稱為必填' }, { status: 400 })

  const db = createServiceClient().schema('aido')
  const { data, error } = await db
    .from('positions')
    .insert({
      company_id: user.companyId,
      code: code ?? null,
      title,
      grade: grade ?? null,
      job_family: job_family ?? null,
      is_manager: is_manager ?? false,
      status: status ?? 'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ position: data })
}

// PUT /api/admin/positions — 編輯職位
export async function PUT(req: NextRequest) {
  const user = await getSessionUser()
  const denied = requireAdmin(user.roleCode)
  if (denied) return denied
  const body = await req.json()
  const { id, code, title, grade, job_family, is_manager, status } = body

  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  if (!title) return NextResponse.json({ error: '職位名稱為必填' }, { status: 400 })

  const db = createServiceClient().schema('aido')
  const { data, error } = await db
    .from('positions')
    .update({
      code: code ?? null,
      title,
      grade: grade ?? null,
      job_family: job_family ?? null,
      is_manager: is_manager ?? false,
      status: status ?? 'active',
    })
    .eq('id', id)
    .eq('company_id', user.companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ position: data })
}
