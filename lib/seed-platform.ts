// 把 code 寫死的預設 (角色權限 / 簽核流程 / 表單欄位) 種進 DB (冪等 upsert)。
// 讓 admin UI 一開始就顯示「現狀」可編輯，而非空白；之後 admin 編輯覆寫 DB。
import { CHAINS } from './chains'
import { MODULES } from './modules'
import { ROLE_ACTIONS, ROLE_READ_SCOPE, FIELD_FULL_ACCESS } from './rbac'

type DB = { from: (t: string) => any }

export async function seedPlatformConfig(db: DB, companyId: number): Promise<string[]> {
  const results: string[] = []
  const allRoles = Object.keys(ROLE_ACTIONS) // 9 個系統角色

  // 0. menu_groups：5 大類預設 (sidebar 群組順序，可自訂)
  const GROUPS = [
    { code: 'workspace', name: '我的工作區', sort_order: 1 },
    { code: 'attendance', name: '差勤', sort_order: 2 },
    { code: 'admin_finance', name: '行政 / 財務', sort_order: 3 },
    { code: 'hr', name: '人資', sort_order: 4 },
    { code: 'governance', name: '治理 / 系統', sort_order: 5 },
  ]
  { const { error } = await db.from('menu_groups').upsert(GROUPS.map(g => ({ ...g, company_id: companyId, is_system: true })), { onConflict: 'company_id,code' }); if (error) throw new Error('menu_groups: ' + error.message) }
  results.push(`menu_groups: ${GROUPS.length}`)

  // 1. role_permissions：每 role × 每 module 一列 (visible 來自 module.roles_visible)
  const permRows: Record<string, unknown>[] = []
  for (const role of allRoles) {
    const visibleSet = new Set(
      MODULES.filter(m => m.roles_visible === '*' || (Array.isArray(m.roles_visible) && m.roles_visible.includes(role))).map(m => m.code)
    )
    for (const m of MODULES) {
      permRows.push({
        company_id: companyId, role_code: role, module_code: m.code,
        visible: visibleSet.has(m.code),
        actions: ROLE_ACTIONS[role] || ['read'],          // jsonb (傳 array)
        read_scope: ROLE_READ_SCOPE[role] || 'self',
      })
    }
  }
  { const { error } = await db.from('role_permissions').upsert(permRows, { onConflict: 'company_id,role_code,module_code' }); if (error) throw new Error('role_permissions: ' + error.message) }
  results.push(`role_permissions: ${permRows.length}`)

  // 2. role_field_access：敏感欄位 × 每 role
  const fieldRows: Record<string, unknown>[] = []
  for (const [field, roles] of Object.entries(FIELD_FULL_ACCESS)) {
    for (const role of allRoles) fieldRows.push({ company_id: companyId, role_code: role, field_key: field, allowed: roles.includes(role) })
  }
  { const { error } = await db.from('role_field_access').upsert(fieldRows, { onConflict: 'company_id,role_code,field_key' }); if (error) throw new Error('role_field_access: ' + error.message) }
  results.push(`role_field_access: ${fieldRows.length}`)

  // 3. approval_chain_templates：從 code CHAINS
  const chainRows = Object.values(CHAINS).map((c) => ({
    company_id: companyId, chain_code: c.chain_code, name: (c as { name?: string }).name || c.chain_code,
    module_code: null, amount_field: c.amount_field || 'amount',
    steps_json: c.steps,                                  // jsonb (傳 array)
    is_active: true,
  }))
  { const { error } = await db.from('approval_chain_templates').upsert(chainRows, { onConflict: 'company_id,chain_code' }); if (error) throw new Error('approval_chain_templates: ' + error.message) }
  results.push(`approval_chain_templates: ${chainRows.length}`)

  // 4. form_definitions：request 類模組的表單欄位
  const formRows = MODULES.filter(m => m.kind === 'request' && Array.isArray(m.fields)).map(m => ({
    company_id: companyId, module_code: m.code, form_code: m.code + '_request', name: m.name,
    version: 1, is_active: true,
    fields_json: m.fields,                                // jsonb
    columns_json: m.columns || [],                        // jsonb
    chain_code: m.chain || null, icon: m.icon || null, group_name: m.group || null,
  }))
  { const { error } = await db.from('form_definitions').upsert(formRows, { onConflict: 'company_id,module_code,form_code' }); if (error) throw new Error('form_definitions: ' + error.message) }
  results.push(`form_definitions: ${formRows.length}`)

  return results
}
