// 平台化配置解析層：DB 優先 (admin UI 編輯結果) → fallback code 預設 (seed 前/查詢失敗不破壞)
// 讓 簽核流程設計器 / 表單設計器 / 權限管理 的編輯實際生效，同時保證 DB 空或出錯時系統仍可運作。
import { createServiceClient } from './supabase/server'
import { CHAINS } from './chains'
import type { Chain } from './chains'
import { MODULE_MAP, MODULES, withCommonFields } from './modules'
import type { ModuleField, ModuleColumn, Module } from './modules'
import { ROLE_ACTIONS, ROLE_READ_SCOPE, FIELD_FULL_ACCESS, type Action } from './rbac'
import { visibleModules } from './modules'

function svc() { return createServiceClient().schema('aido') }

// ---- 簽核流程：DB approval_chain_templates → fallback code CHAINS ----
export async function resolveChain(companyId: number, chainCode: string): Promise<Chain | null> {
  try {
    const { data } = await svc().from('approval_chain_templates')
      .select('chain_code, amount_field, steps_json, is_active')
      .eq('company_id', companyId).eq('chain_code', chainCode).eq('is_active', true).maybeSingle()
    if (data && Array.isArray(data.steps_json) && data.steps_json.length > 0) {
      return { chain_code: data.chain_code, amount_field: data.amount_field || 'amount', steps: data.steps_json }
    }
  } catch { /* fall through to code default */ }
  return CHAINS[chainCode] || null
}

// ---- 表單欄位：DB form_definitions.fields_json → fallback module.fields ----
export interface ResolvedForm { fields: ModuleField[]; columns?: ModuleColumn[]; chainCode?: string }
export async function resolveFormFields(companyId: number, moduleCode: string): Promise<ResolvedForm | null> {
  try {
    const { data } = await svc().from('form_definitions')
      .select('fields_json, columns_json, chain_code, is_active, version')
      .eq('company_id', companyId).eq('module_code', moduleCode).eq('is_active', true)
      .order('version', { ascending: false }).limit(1).maybeSingle()
    if (data && Array.isArray(data.fields_json) && data.fields_json.length > 0) {
      return {
        fields: withCommonFields(data.fields_json as ModuleField[]),
        columns: Array.isArray(data.columns_json) && data.columns_json.length ? (data.columns_json as ModuleColumn[]) : undefined,
        chainCode: data.chain_code || undefined,
      }
    }
  } catch { /* fall through */ }
  const mod = MODULE_MAP[moduleCode]
  return mod?.fields ? { fields: mod.fields, columns: mod.columns, chainCode: mod.chain } : null
}

// ---- 角色權限：DB role_permissions / role_field_access → fallback code rbac.ts ----
export interface ResolvedPerms {
  visibleModuleCodes: string[]      // sidebar 可見的 module code
  actions: Action[]                 // 操作級權限
  readScope: 'self' | 'team' | 'all'
  fieldAccess: string[]             // 可看的敏感欄位 key
}
export async function resolveRolePermissions(companyId: number, roleCode: string): Promise<ResolvedPerms> {
  // code 預設 (fallback)
  const codeVisible = visibleModules(roleCode).map(m => m.code)
  const codeActions = (ROLE_ACTIONS[roleCode] || ['read']) as Action[]
  const codeScope = (ROLE_READ_SCOPE[roleCode] || 'self') as 'self' | 'team' | 'all'
  const codeFields = Object.entries(FIELD_FULL_ACCESS).filter(([, roles]) => roles.includes(roleCode)).map(([f]) => f)
  try {
    const [permRes, fieldRes] = await Promise.all([
      svc().from('role_permissions').select('module_code, visible, actions, read_scope').eq('company_id', companyId).eq('role_code', roleCode),
      svc().from('role_field_access').select('field_key, allowed').eq('company_id', companyId).eq('role_code', roleCode),
    ])
    const perms = permRes.data
    if (perms && perms.length > 0) {
      // per-module fallback：DB role_permissions 只覆蓋「有列的 module」；對「完全沒列的 module」
      // (未 seed / 部分 seed) 回退 code 預設可見性。避免 all-or-nothing 脆弱——否則只要 DB 寫了
      // 任一 module 的權限(如設計器編輯一張表單)，其餘沒列的內建 module 會全部從 sidebar 消失。
      const dbModules = new Set(perms.map(p => p.module_code))
      const dbVisible = perms.filter(p => p.visible).map(p => p.module_code)
      const codeOnlyVisible = codeVisible.filter(c => !dbModules.has(c))
      const visibleModuleCodes = Array.from(new Set([...dbVisible, ...codeOnlyVisible]))
      // actions/read_scope 取所有 module 權限的聯集 (代表此角色整體能力)；UI 設定為 per-module，整體能力取最大集
      const actSet = new Set<Action>()
      let scope: 'self' | 'team' | 'all' = 'self'
      for (const p of perms) {
        for (const a of (Array.isArray(p.actions) ? p.actions : [])) actSet.add(a as Action)
        if (p.read_scope === 'all') scope = 'all'
        else if (p.read_scope === 'team' && scope !== 'all') scope = 'team'
      }
      const fieldAccess = (fieldRes.data || []).filter(f => f.allowed).map(f => f.field_key)
      return {
        visibleModuleCodes: visibleModuleCodes.length ? visibleModuleCodes : codeVisible,
        actions: actSet.size ? Array.from(actSet) : codeActions,
        readScope: scope,
        fieldAccess: fieldRes.data && fieldRes.data.length ? fieldAccess : codeFields,
      }
    }
  } catch { /* fall through to code defaults */ }
  return { visibleModuleCodes: codeVisible, actions: codeActions, readScope: codeScope, fieldAccess: codeFields }
}

// ---- 選單群組 + 完整 module 清單 (code 預設 MODULES + DB 自訂表單合併) ----
export interface MenuGroup { code: string; name: string; sortOrder: number }
const DEFAULT_GROUP_ORDER = ['我的工作區', '差勤', '行政 / 財務', '人資', '治理 / 系統']

// sidebar 群組順序：DB menu_groups 優先 → fallback code 預設 5 大類
export async function getMenuGroups(companyId: number): Promise<string[]> {
  try {
    const { data } = await svc().from('menu_groups').select('name, sort_order').eq('company_id', companyId).order('sort_order', { ascending: true })
    if (data && data.length > 0) return data.map(g => g.name)
  } catch { /* fall through */ }
  return DEFAULT_GROUP_ORDER
}

// 完整 module 清單：code 預設 MODULES + DB form_definitions 自訂表單 (不在 MODULES code 的)
export async function getEffectiveModules(companyId: number): Promise<Module[]> {
  try {
    const [formRes, grpRes] = await Promise.all([
      svc().from('form_definitions')
        .select('module_code, name, icon, group_code, group_name, chain_code, fields_json, columns_json, is_active')
        .eq('company_id', companyId).eq('is_active', true),
      svc().from('menu_groups').select('code, name').eq('company_id', companyId),
    ])
    const groupNameByCode: Record<string, string> = {}
    for (const g of (grpRes.data || [])) groupNameByCode[g.code] = g.name
    const custom: Module[] = []
    for (const f of (formRes.data || [])) {
      if (MODULE_MAP[f.module_code]) continue // 既有 module 不重複 (DB 只覆寫欄位由 resolveFormFields 處理)
      custom.push({
        code: f.module_code,
        name: f.name,
        icon: f.icon || 'document-text',
        group: (f.group_code && groupNameByCode[f.group_code]) || f.group_name || '其他',
        kind: 'request',
        chain: f.chain_code || undefined,
        fields: withCommonFields(Array.isArray(f.fields_json) ? (f.fields_json as ModuleField[]) : []),
        columns: Array.isArray(f.columns_json) && f.columns_json.length ? (f.columns_json as ModuleColumn[]) : undefined,
        roles_visible: '*', // 實際可見性由 role_permissions 控 (resolveRolePermissions)
      } as Module)
    }
    return [...MODULES, ...custom]
  } catch {
    return MODULES // DB 出錯不破壞：fallback code 預設
  }
}

// 單一 module 解析：code 預設 MODULE_MAP → fallback DB 自訂表單。
// 給 /api/modules/[code] 與 bpm.createAndSubmit 用 (取代寫死 MODULE_MAP，讓自訂表單也能列表/開單)
export async function getEffectiveModule(companyId: number, code: string): Promise<Module | null> {
  if (MODULE_MAP[code]) return MODULE_MAP[code]
  try {
    const { data } = await svc().from('form_definitions')
      .select('module_code, name, icon, group_code, group_name, chain_code, fields_json, columns_json, is_active, version')
      .eq('company_id', companyId).eq('module_code', code).eq('is_active', true)
      .order('version', { ascending: false }).limit(1).maybeSingle()
    if (data) {
      const fields = withCommonFields(Array.isArray(data.fields_json) ? (data.fields_json as ModuleField[]) : [])
      const amountField = fields.find(f => f.type === 'money' || f.type === 'number')?.key
      return {
        code: data.module_code, name: data.name, icon: data.icon || 'document-text',
        group: data.group_name || '其他', kind: 'request', chain: data.chain_code || undefined,
        amountField,
        fields,
        columns: Array.isArray(data.columns_json) && data.columns_json.length ? (data.columns_json as ModuleColumn[]) : undefined,
        roles_visible: '*',
      } as Module
    }
  } catch { /* fall through */ }
  return null
}
