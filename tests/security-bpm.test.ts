import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { maskSensitivePayload, stripPayloadJson, SENSITIVE_VIEW_ROLES } from '../lib/self-service'
import { canAct, isAdminRole, employeeViewScope, canSeeField, maskNationalId, maskBank, ROLE_ACTIONS } from '../lib/rbac'
import { resolveApprover, antiSelf, buildTiers } from '../lib/bpm'

// ───────────────────────── 共用：輕量 fake Supabase client ─────────────────────────
// 只覆蓋 bpm 的 resolveApprover/antiSelf/buildTiers 用到的 query 形狀：
//   .schema('aido').from(t).select(...).eq(...).neq(...).single()/.maybeSingle()  → { data }
//   await <同一 builder>（count head 查詢）                                          → { count }
type Row = Record<string, unknown>
function makeClient(fixtures: { users?: Row[]; roles?: Row[]; departments?: Row[] }): SupabaseClient {
  const tables: Record<string, Row[]> = {
    users: fixtures.users ?? [], roles: fixtures.roles ?? [], departments: fixtures.departments ?? [],
  }
  function from(table: string) {
    const filters: { col: string; val: unknown; op: 'eq' | 'neq' }[] = []
    const match = () => (tables[table] ?? []).filter(row =>
      filters.every(f => (f.op === 'eq' ? row[f.col] === f.val : row[f.col] !== f.val)))
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (col: string, val: unknown) => { filters.push({ col, val, op: 'eq' }); return builder },
      neq: (col: string, val: unknown) => { filters.push({ col, val, op: 'neq' }); return builder },
      single: async () => ({ data: match()[0] ?? null }),
      maybeSingle: async () => ({ data: match()[0] ?? null }),
      // thenable：count head 查詢直接 await builder
      then: (resolve: (v: { data: Row[]; count: number }) => unknown) => resolve({ data: match(), count: match().length }),
    }
    return builder
  }
  return { schema: () => ({ from }) } as unknown as SupabaseClient
}

const ROLES: Row[] = [
  { id: 100, code: 'employee' }, { id: 101, code: 'manager' }, { id: 200, code: 'hr' }, { id: 300, code: 'finance' },
]

// ───────────────────────── 1. 敏感欄位遮罩共用函數 ─────────────────────────
describe('self-service: maskSensitivePayload', () => {
  const fields = [
    { key: 'new_salary', sensitive: true },
    { key: 'reason', sensitive: false },
    { key: 'national_id', sensitive: true },
  ]
  const payload = { new_salary: 90000, reason: '年度調整', national_id: 'A123456789' }

  it('非本人 + 非特權角色 → sensitive 欄位被遮罩，非 sensitive 不動', () => {
    const out = maskSensitivePayload(payload, fields, { isSelf: false, roleCode: 'manager' })
    expect(out.new_salary).toBe('※※※（受保護）')
    expect(out.national_id).toBe('※※※（受保護）')
    expect(out.reason).toBe('年度調整')
  })

  it('本人 → 全部原值（看自己的單不遮罩）', () => {
    const out = maskSensitivePayload(payload, fields, { isSelf: true, roleCode: 'employee' })
    expect(out.new_salary).toBe(90000)
    expect(out.national_id).toBe('A123456789')
  })

  it.each(SENSITIVE_VIEW_ROLES)('特權角色 %s → 原值（業務需要可看）', (role) => {
    const out = maskSensitivePayload(payload, fields, { isSelf: false, roleCode: role })
    expect(out.new_salary).toBe(90000)
  })

  it('不 mutate 傳入物件（回傳新副本）', () => {
    const src = { new_salary: 90000 }
    const out = maskSensitivePayload(src, fields, { isSelf: false, roleCode: 'manager' })
    expect(src.new_salary).toBe(90000)
    expect(out).not.toBe(src)
  })

  it('空值/未填的 sensitive 欄位不會被替換成保護字串', () => {
    const out = maskSensitivePayload({ new_salary: '', national_id: null }, fields, { isSelf: false, roleCode: 'manager' })
    expect(out.new_salary).toBe('')
    expect(out.national_id).toBe(null)
  })

  it('fields 為 undefined 不丟錯', () => {
    expect(() => maskSensitivePayload({ a: 1 }, undefined, { isSelf: false, roleCode: 'manager' })).not.toThrow()
  })
})

describe('self-service: stripPayloadJson', () => {
  it('移除 payload_json 原文，保留其他欄位', () => {
    const out = stripPayloadJson({ id: 1, title: 'x', payload_json: '{"new_salary":90000}', payload: { new_salary: '※※※（受保護）' } })
    expect(out).not.toHaveProperty('payload_json')
    expect(out.id).toBe(1)
    expect(out.payload).toEqual({ new_salary: '※※※（受保護）' })
  })
  it('沒有 payload_json 時也安全', () => {
    const out = stripPayloadJson({ id: 2 })
    expect(out).toEqual({ id: 2 })
  })
})

// ───────────────────────── 2. RBAC 權限檢查 ─────────────────────────
describe('rbac: canAct（操作級權限）', () => {
  it('employee 可 create/read 不可 approve/manage/delete', () => {
    expect(canAct('employee', 'create')).toBe(true)
    expect(canAct('employee', 'read')).toBe(true)
    expect(canAct('employee', 'approve')).toBe(false)
    expect(canAct('employee', 'delete')).toBe(false)
  })
  it('manager 可 approve 但不可 manage/delete', () => {
    expect(canAct('manager', 'approve')).toBe(true)
    expect(canAct('manager', 'manage')).toBe(false)
  })
  it('auditor 只讀（不可 approve/manage/delete）', () => {
    expect(canAct('auditor', 'read')).toBe(true)
    for (const a of ['create', 'approve', 'manage', 'delete'] as const) expect(canAct('auditor', a)).toBe(false)
  })
  it('只有 executive 可 delete', () => {
    const canDelete = Object.keys(ROLE_ACTIONS).filter(r => canAct(r, 'delete'))
    expect(canDelete).toEqual(['executive'])
  })
  it('未知角色退化為只讀', () => {
    expect(canAct('ghost', 'read')).toBe(true)
    expect(canAct('ghost', 'approve')).toBe(false)
  })
})

describe('rbac: isAdminRole / employeeViewScope', () => {
  it('admin 角色 = hr/it/executive/admin_officer', () => {
    for (const r of ['hr', 'it', 'executive', 'admin_officer']) expect(isAdminRole(r)).toBe(true)
    for (const r of ['employee', 'manager', 'finance', 'auditor', 'legal']) expect(isAdminRole(r)).toBe(false)
  })
  it('viewScope：admin/auditor=all、manager=department、其餘=none', () => {
    expect(employeeViewScope('hr')).toBe('all')
    expect(employeeViewScope('auditor')).toBe('all')
    expect(employeeViewScope('manager')).toBe('department')
    expect(employeeViewScope('employee')).toBe('none')
    expect(employeeViewScope('finance')).toBe('none')
  })
})

describe('rbac: canSeeField（敏感欄位存取）', () => {
  it('本人永遠可看自己欄位', () => {
    expect(canSeeField('salary', 'employee', true)).toBe(true)
  })
  it('salary 僅 hr/finance/executive 可看', () => {
    expect(canSeeField('salary', 'hr', false)).toBe(true)
    expect(canSeeField('salary', 'finance', false)).toBe(true)
    expect(canSeeField('salary', 'manager', false)).toBe(false)
  })
  it('national_id 僅 hr 可看', () => {
    expect(canSeeField('national_id', 'hr', false)).toBe(true)
    expect(canSeeField('national_id', 'finance', false)).toBe(false)
  })
  it('未列管欄位 → 預設可看', () => {
    expect(canSeeField('display_name', 'employee', false)).toBe(true)
  })
  it('mask helper 末碼遮罩正確', () => {
    expect(maskNationalId('A123456789')).toBe('A123****89')
    expect(maskBank('1234567890')).toBe('****7890')
    expect(maskNationalId('')).toBe('')
  })
})

// ───────────────────────── 3. BPM 簽核核心 ─────────────────────────
describe('bpm: resolveApprover', () => {
  const fixtures = {
    users: [
      { id: 1, manager_user_id: 2, department_id: 10, primary_role_id: 100, status: 'active' }, // requester(employee)
      { id: 2, manager_user_id: 3, department_id: 10, primary_role_id: 101, status: 'active' }, // manager
      { id: 4, manager_user_id: null, department_id: 10, primary_role_id: 100, status: 'active' }, // no direct manager
    ],
    roles: ROLES,
    departments: [{ id: 10, manager_user_id: 2 }],
  }

  it('self → 指向申請人本人', async () => {
    const r = await resolveApprover(makeClient(fixtures), { resolver: 'self' }, { requester_user_id: 1 })
    expect(r).toEqual({ approver_user_id: 1, approver_type: 'user' })
  })
  it('direct_manager → 指向直屬主管', async () => {
    const r = await resolveApprover(makeClient(fixtures), { resolver: 'direct_manager' }, { requester_user_id: 1 })
    expect(r).toEqual({ approver_user_id: 2, approver_type: 'manager' })
  })
  it('direct_manager 無主管 + fallback department_manager → 退到部門主管', async () => {
    const r = await resolveApprover(makeClient(fixtures),
      { resolver: 'direct_manager', fallback: { resolver: 'department_manager' } }, { requester_user_id: 4 })
    expect(r).toEqual({ approver_user_id: 2, approver_type: 'department_manager' })
  })
  it('direct_manager 無主管且無 fallback → null', async () => {
    const r = await resolveApprover(makeClient(fixtures), { resolver: 'direct_manager' }, { requester_user_id: 4 })
    expect(r).toBeNull()
  })
  it('role → 指向角色', async () => {
    const r = await resolveApprover(makeClient(fixtures), { resolver: 'role', role_code: 'hr' }, { requester_user_id: 1 })
    expect(r).toEqual({ approver_role_id: 200, approver_type: 'role' })
  })
  it('未知 resolver → null', async () => {
    const r = await resolveApprover(makeClient(fixtures), { resolver: 'nope' }, { requester_user_id: 1 })
    expect(r).toBeNull()
  })
})

describe('bpm: antiSelf（禁自簽）', () => {
  it('簽核人 = 申請人 → 改派直屬主管', async () => {
    const c = makeClient({ users: [{ id: 1, manager_user_id: 2, status: 'active' }] })
    const r = await antiSelf(c, { approver_user_id: 1, approver_type: 'user' }, { requester_user_id: 1 })
    expect(r).toEqual({ approver_user_id: 2, approver_type: 'manager' })
  })
  it('簽核人 = 申請人但無主管 → null（無法改派）', async () => {
    const c = makeClient({ users: [{ id: 1, manager_user_id: null, status: 'active' }] })
    const r = await antiSelf(c, { approver_user_id: 1 }, { requester_user_id: 1 })
    expect(r).toBeNull()
  })
  it('角色簽核且申請人是該角色唯一在職者 → 改派主管', async () => {
    const c = makeClient({ users: [{ id: 1, manager_user_id: 2, primary_role_id: 100, status: 'active' }] })
    const r = await antiSelf(c, { approver_role_id: 100, approver_type: 'role' }, { requester_user_id: 1 })
    expect(r).toEqual({ approver_user_id: 2, approver_type: 'manager' })
  })
  it('角色簽核但有其他在職同角色 → 維持角色簽核', async () => {
    const c = makeClient({ users: [
      { id: 1, manager_user_id: 2, primary_role_id: 100, status: 'active' },
      { id: 9, primary_role_id: 100, status: 'active' },
    ] })
    const r = await antiSelf(c, { approver_role_id: 100 }, { requester_user_id: 1 })
    expect(r).toEqual({ approver_role_id: 100 })
  })
  it('一般非自簽 → 原樣返回', async () => {
    const c = makeClient({ users: [{ id: 1, manager_user_id: 2, status: 'active' }] })
    const r = await antiSelf(c, { approver_user_id: 9, approver_type: 'user' }, { requester_user_id: 1 })
    expect(r).toEqual({ approver_user_id: 9, approver_type: 'user' })
  })
  it('r 為 null → 直接回 null', async () => {
    const c = makeClient({ users: [{ id: 1, status: 'active' }] })
    expect(await antiSelf(c, null, { requester_user_id: 1 })).toBeNull()
  })
})

describe('bpm: buildTiers', () => {
  const fixtures = {
    users: [
      { id: 1, manager_user_id: 2, department_id: 10, primary_role_id: 100, status: 'active' },
      { id: 2, manager_user_id: 3, department_id: 10, primary_role_id: 101, status: 'active' },
    ],
    roles: ROLES,
    departments: [{ id: 10, manager_user_id: 2 }],
  }
  const mkChain = (steps: unknown[]) => ({ chain_code: 't', steps } as unknown as Parameters<typeof buildTiers>[1])

  it('condition 不符的關卡被略過（amount 門檻）', async () => {
    const chain = mkChain([
      { step_no: 10, name: 'HR', type: 'serial', approver: { resolver: 'role', role_code: 'hr' }, required: 'any' },
      { step_no: 20, name: '財務高額', type: 'serial', condition: { field: 'amount', op: '>', value: 5000 }, approver: { resolver: 'role', role_code: 'finance' }, required: 'any' },
    ])
    const low = await buildTiers(makeClient(fixtures), chain, { requester_user_id: 1, amount: 1000 }, {})
    expect(low.tiers).toHaveLength(1)
    expect(low.tiers[0].approvers).toEqual([{ approver_role_id: 200, approver_type: 'role' }])

    const high = await buildTiers(makeClient(fixtures), chain, { requester_user_id: 1, amount: 10000 }, {})
    expect(high.tiers).toHaveLength(2)
  })

  it('相鄰且同一簽核人的單人關卡會被合併去重', async () => {
    const chain = mkChain([
      { step_no: 10, name: '直屬主管', type: 'serial', approver: { resolver: 'direct_manager' }, required: 'all' },
      { step_no: 20, name: '部門主管', type: 'serial', approver: { resolver: 'department_manager' }, required: 'all' },
    ])
    // 直屬主管(2) 與 部門主管(2) 同一人 → 合併成 1 關
    const tiers = await buildTiers(makeClient(fixtures), chain, { requester_user_id: 1, amount: 0 }, {})
    expect(tiers.tiers).toHaveLength(1)
    expect(tiers.tiers[0].approvers).toEqual([{ approver_user_id: 2, approver_type: 'manager' }])
  })

  it('解不到簽核人的關卡被略過', async () => {
    const chain = mkChain([
      { step_no: 10, name: '未知角色', type: 'serial', approver: { resolver: 'role', role_code: 'ghost' }, required: 'any' },
      { step_no: 20, name: 'HR', type: 'serial', approver: { resolver: 'role', role_code: 'hr' }, required: 'any' },
    ])
    const tiers = await buildTiers(makeClient(fixtures), chain, { requester_user_id: 1, amount: 0 }, {})
    expect(tiers.tiers).toHaveLength(1)
    expect(tiers.tiers[0].name).toBe('HR')
    expect(tiers.unresolvedApplicable).toBe(1) // 未知角色關卡解析失敗被計數
  })
})
