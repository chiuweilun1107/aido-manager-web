import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/api-guard'
import type { ModuleField, ModuleColumn } from '@/lib/modules'
import { MODULE_MAP, MODULES } from '@/lib/modules'
import { reseedModulePermissions } from '@/lib/seed-platform'

// GET /api/admin/forms — 列出該 company 的「所有系統表單」= 內建 MODULES + DB 覆寫合併。
// 設計器需要看到全部內建表單(請假/報銷…)才能編輯;內建是 code 常數不在 DB,故在此合成。
// DB form_definitions row 覆寫同 module_code 的內建(resolveFormFields 也是 DB-first,行為一致)。
// 內建未被覆寫者給 synthetic 負數 id(sentinel):前端據此走 POST(override) 建覆寫而非 PUT。
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

  const dbRows = (data ?? []).map(r => ({ ...r, is_builtin: !!MODULE_MAP[r.module_code], customized: true }))
  const overridden = new Set(dbRows.map(r => r.module_code))

  // 撈該公司 role_permissions → 算每個 module 真實可見角色集(DB-first,與 sidebar/resolveRolePermissions 同源)。
  // 合成內建表單的 visible_roles 必須反映真實限制(如調薪只 HR 可見),否則設計器顯示「空＝全可見」會誤導,
  // 且使用者再次編輯(PUT)時會把受限內建放寬給所有角色 → 敏感表單外洩。
  const { data: permData } = await db
    .from('role_permissions')
    .select('module_code, role_code, visible')
    .eq('company_id', user.companyId)
  const visibleByModule = new Map<string, Set<string>>()
  const modulesWithPerm = new Set<string>()
  for (const p of permData ?? []) {
    modulesWithPerm.add(p.module_code as string)
    if (p.visible) {
      const s = visibleByModule.get(p.module_code as string) ?? new Set<string>()
      s.add(p.role_code as string)
      visibleByModule.set(p.module_code as string, s)
    }
  }
  // 回傳該內建模組真實可見角色：DB role_permissions 優先 → 否則 code roles_visible；全部可見回 null
  const builtinVisibleRoles = (m: typeof MODULES[number]): string[] | null => {
    if (modulesWithPerm.has(m.code)) {
      const s = visibleByModule.get(m.code) ?? new Set<string>()
      return s.size >= ALL_ROLES.length ? null : Array.from(s)
    }
    const rv = m.roles_visible
    if (rv === '*' || !Array.isArray(rv)) return null
    return rv.length >= ALL_ROLES.length ? null : rv
  }

  // 內建 request 模組中「尚無 DB 覆寫」者 → 合成唯讀基底(可編輯,存檔時建覆寫)
  const builtinRows = MODULES
    .filter(m => m.kind === 'request' && !overridden.has(m.code))
    .map((m, i) => ({
      id: -(i + 1),
      company_id: user.companyId,
      module_code: m.code,
      form_code: m.code + '_request',
      name: m.name,
      version: 0,
      is_active: true,
      fields_json: m.fields ?? [],
      columns_json: m.columns ?? [],
      chain_code: m.chain ?? null,
      icon: m.icon ?? null,
      group_name: m.group ?? null,
      group_code: null,
      visible_roles: builtinVisibleRoles(m),
      sort_order: 0,
      created_at: '',
      updated_at: '',
      is_builtin: true,
      customized: false,
    }))

  return NextResponse.json({ forms: [...builtinRows, ...dbRows] })
}

// 9 個固定角色
const ALL_ROLES = ['employee', 'manager', 'hr', 'it', 'finance', 'executive', 'admin_officer', 'legal', 'auditor'] as const
type RoleCode = typeof ALL_ROLES[number]

// 自由文字欄位長度上限（防止超長字串寫入）
const MAX_TEXT = 200
function tooLong(v: unknown): boolean {
  return typeof v === 'string' && v.length > MAX_TEXT
}

// 清洗前端傳來的 fields_json：必為陣列、每欄至少有非空 key/label，過濾無效項
function sanitizeFields(raw: unknown): ModuleField[] {
  if (!Array.isArray(raw)) return []
  return (raw as ModuleField[]).filter(
    f => f && typeof f.key === 'string' && f.key.trim() !== '' && typeof f.label === 'string' && f.label.trim() !== ''
  )
}

// POST /api/admin/forms — 新增表單
export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr
  const body = await req.json()
  const { module_code, name, icon, group_name, group_code, visible_roles, chain_code, sort_order } = body
  // form_code 對開單邏輯無作用（requests.form_code 由 bpm 另行硬寫），
  // 但 form_definitions.form_code 為 NOT NULL + UNIQUE(company,module,form)，故缺省自動帶 module_code。
  const form_code = body.form_code || module_code

  if (!module_code) return NextResponse.json({ error: '表單代碼為必填' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '表單名稱為必填' }, { status: 400 })
  // module_code 是 sidebar 導航 / 開單的 key，且會進 URL，限定安全字元
  if (!/^[A-Za-z0-9_-]+$/.test(String(module_code))) {
    return NextResponse.json({ error: '表單代碼只能用英文、數字、底線或減號' }, { status: 400 })
  }
  // 不可佔用內建模組代碼（否則 resolveFormFields 會覆寫內建表單）——
  // 除非明確是「編輯內建表單→建立覆寫」(override=true)：此時就是要讓 DB row 覆寫內建,屬設計器正常用途。
  const isOverride = body.override === true && !!MODULE_MAP[module_code]
  if (MODULE_MAP[module_code] && !isOverride) {
    return NextResponse.json({ error: `表單代碼「${module_code}」已被系統內建模組使用，請換一個` }, { status: 400 })
  }
  // icon 排除長度檢查：可能是使用者上傳圖示的 data URL（遠長於一般文字）
  if ([module_code, form_code, name, group_name, group_code].some(tooLong)) {
    return NextResponse.json({ error: `欄位長度不可超過 ${MAX_TEXT} 字元` }, { status: 400 })
  }
  const fields_json = sanitizeFields(body.fields_json)
  const columns_json = Array.isArray(body.columns_json) ? (body.columns_json as ModuleColumn[]) : ([] as ModuleColumn[])

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
      fields_json,
      columns_json,
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

  // 自動建 role_permissions：讓新表單出現在 sidebar。
  // 但「編輯內建表單建立覆寫」且未明確指定 visible_roles 時 → 不動權限,
  // 保留內建原可見性(否則會把原本受限的內建表單放寬給所有角色)。新自訂表單仍照建。
  const explicitRoles = Array.isArray(visible_roles) && visible_roles.length > 0
  const skipPerms = isOverride && !explicitRoles
  if (!skipPerms) {
    const rolesArr: string[] = explicitRoles ? visible_roles : []
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
  // icon 排除長度檢查：可能是使用者上傳圖示的 data URL
  if ([name, group_name, group_code].some(tooLong)) {
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
  if (fields_json !== undefined) patch.fields_json = sanitizeFields(fields_json)
  if (columns_json !== undefined) patch.columns_json = Array.isArray(columns_json) ? columns_json : []
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
    .select('id, module_code')
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

  // 刪內建覆寫＝「還原內建」：把該 module 的 role_permissions 重新種成 code 預設(re-seed,非 delete)。
  // 不可 delete——resolveRolePermissions 無 per-module fallback,刪列會讓該內建表單從所有角色消失=
  // 全公司隱藏+開單頁 404。re-seed 才真正還原成系統內建的可見性/權限現狀。
  if (MODULE_MAP[existing.module_code as string]) {
    await reseedModulePermissions(db, user.companyId, existing.module_code as string)
  }

  return NextResponse.json({ ok: true })
}
