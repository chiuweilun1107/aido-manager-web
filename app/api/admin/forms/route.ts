import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/api-guard'
import type { ModuleField, ModuleColumn } from '@/lib/modules'

// GET /api/admin/forms — 列出該 company 所有 form_definitions
export async function GET() {
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr
  const db = createServiceClient().schema('aido')

  const { data, error } = await db
    .from('form_definitions')
    .select('id, company_id, module_code, form_code, name, version, is_active, fields_json, columns_json, chain_code, icon, group_name, group_code, visible_roles, sort_order, created_at, updated_at')
    .eq('company_id', user.companyId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ forms: data ?? [] })
}

// 9 個固定角色
const ALL_ROLES = ['employee', 'manager', 'hr', 'it', 'finance', 'executive', 'admin_officer', 'legal', 'auditor'] as const
type RoleCode = typeof ALL_ROLES[number]

// 自由文字欄位長度上限（防止超長字串寫入）
const MAX_TEXT = 200
function tooLong(v: unknown): boolean {
  return typeof v === 'string' && v.length > MAX_TEXT
}

// POST /api/admin/forms — 新增表單
export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr
  const body = await req.json()
  const { module_code, form_code, name, icon, group_name, group_code, visible_roles, chain_code, sort_order } = body

  if (!module_code) return NextResponse.json({ error: 'module_code 為必填' }, { status: 400 })
  if (!form_code) return NextResponse.json({ error: 'form_code 為必填' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '表單名稱為必填' }, { status: 400 })
  if ([module_code, form_code, name, icon, group_name, group_code].some(tooLong)) {
    return NextResponse.json({ error: `欄位長度不可超過 ${MAX_TEXT} 字元` }, { status: 400 })
  }

  const db = createServiceClient().schema('aido')
  const { data, error } = await db
    .from('form_definitions')
    .insert({
      company_id: user.companyId,
      module_code,
      form_code,
      name,
      version: 1,
      is_active: true,
      fields_json: [] as ModuleField[],
      columns_json: [] as ModuleColumn[],
      chain_code: chain_code ?? null,
      icon: icon ?? null,
      group_name: group_name ?? null,
      group_code: group_code ?? null,
      visible_roles: visible_roles ?? null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 自動建 role_permissions：讓新表單出現在 sidebar
  const rolesArr: string[] = Array.isArray(visible_roles) && visible_roles.length > 0 ? visible_roles : []
  const permRows = ALL_ROLES.map((role: RoleCode) => ({
    company_id: user.companyId,
    role_code: role,
    module_code,
    visible: rolesArr.length === 0 || rolesArr.includes(role),
    actions: ['create', 'read'],
    read_scope: 'self',
  }))

  const { error: permErr } = await db
    .from('role_permissions')
    .upsert(permRows, { onConflict: 'company_id,role_code,module_code' })

  // 表單已建立成功；權限若失敗回 200 但附 warning，讓前端可提示「請到權限管理檢查」
  if (permErr) {
    return NextResponse.json({ form: data, warning: `表單已建立，但權限設定失敗：${permErr.message}` })
  }

  return NextResponse.json({ form: data })
}

// PUT /api/admin/forms — 編輯表單（主要存 fields_json/columns_json/name/chain_code/is_active）
export async function PUT(req: NextRequest) {
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr
  const body = await req.json()
  const { id, name, icon, group_name, group_code, visible_roles, chain_code, is_active, fields_json, columns_json, sort_order } = body

  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  if ([name, icon, group_name, group_code].some(tooLong)) {
    return NextResponse.json({ error: `欄位長度不可超過 ${MAX_TEXT} 字元` }, { status: 400 })
  }

  const db = createServiceClient().schema('aido')

  // 確認此表單屬於當前公司
  const { data: existing } = await db
    .from('form_definitions')
    .select('id, module_code')
    .eq('id', id)
    .eq('company_id', user.companyId)
    .single()
  if (!existing) return NextResponse.json({ error: '找不到表單' }, { status: 404 })

  const patch: Record<string, unknown> = {}
  if (name !== undefined) patch.name = name
  if (icon !== undefined) patch.icon = icon
  if (group_name !== undefined) patch.group_name = group_name
  if (group_code !== undefined) patch.group_code = group_code
  if (visible_roles !== undefined) patch.visible_roles = visible_roles
  if (chain_code !== undefined) patch.chain_code = chain_code
  if (is_active !== undefined) patch.is_active = is_active
  if (fields_json !== undefined) patch.fields_json = fields_json
  if (columns_json !== undefined) patch.columns_json = columns_json
  if (sort_order !== undefined) patch.sort_order = sort_order

  const { data, error } = await db
    .from('form_definitions')
    .update(patch)
    .eq('id', id)
    .eq('company_id', user.companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 若 visible_roles 有傳入，同步更新 role_permissions
  if (visible_roles !== undefined) {
    const rolesArr: string[] = Array.isArray(visible_roles) && visible_roles.length > 0 ? visible_roles : []
    const permRows = ALL_ROLES.map((role: RoleCode) => ({
      company_id: user.companyId,
      role_code: role,
      module_code: existing.module_code,
      visible: rolesArr.length === 0 || rolesArr.includes(role),
      actions: ['create', 'read'],
      read_scope: 'self',
    }))

    const { error: permErr } = await db
      .from('role_permissions')
      .upsert(permRows, { onConflict: 'company_id,role_code,module_code' })

    if (permErr) {
      return NextResponse.json({ form: data, warning: `表單已更新，但權限同步失敗：${permErr.message}` })
    }
  }

  return NextResponse.json({ form: data })
}

// DELETE /api/admin/forms?id= — 刪除表單
export async function DELETE(req: NextRequest) {
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr
  const { searchParams } = new URL(req.url)
  const id = Number(searchParams.get('id'))
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const db = createServiceClient().schema('aido')

  const { data: existing } = await db
    .from('form_definitions')
    .select('id')
    .eq('id', id)
    .eq('company_id', user.companyId)
    .single()
  if (!existing) return NextResponse.json({ error: '找不到表單' }, { status: 404 })

  const { error } = await db
    .from('form_definitions')
    .delete()
    .eq('id', id)
    .eq('company_id', user.companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
