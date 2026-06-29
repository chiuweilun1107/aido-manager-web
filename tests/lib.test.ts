import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, last4 } from '../lib/crypto'
import { toCsv } from '../lib/export'
import { getCompanyId, withCompany, DEFAULT_COMPANY_ID } from '../lib/company'
import { t } from '../lib/i18n'
import { formatInTimezone } from '../lib/timezone'
import { MODULES, MODULE_MAP, withCommonFields } from '../lib/modules'
import { CHAINS } from '../lib/chains'

describe('crypto', () => {
  it('encrypt/decrypt round-trip 還原原文', () => {
    const plain = 'A123456789'
    const enc = encrypt(plain)
    expect(enc).not.toBe(plain)
    expect(decrypt(enc)).toBe(plain)
  })
  it('每次加密 IV 不同 (ciphertext 不重複)', () => {
    expect(encrypt('same')).not.toBe(encrypt('same'))
  })
  it('竄改密文會 throw (GCM auth tag)', () => {
    const enc = encrypt('secret')
    const tampered = enc.slice(0, -4) + (enc.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA')
    expect(() => decrypt(tampered)).toThrow()
  })
  it('last4 取末四碼', () => {
    expect(last4('A123456789')).toBe('6789')
    expect(last4('abc')).toBe('abc')
  })
})

describe('export.toCsv', () => {
  it('產生含 BOM 的 CSV header+rows', () => {
    const csv = toCsv([{ a: 1, b: 'x' }], [{ key: 'a', label: '數' }, { key: 'b', label: '字' }])
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    expect(csv).toContain('數,字')
    expect(csv).toContain('1,x')
  })
  it('含逗號/引號的值會被正確 escape', () => {
    const csv = toCsv([{ a: 'x,y', b: 'has"quote' }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }])
    expect(csv).toContain('"x,y"')
    expect(csv).toContain('"has""quote"')
  })
})

describe('company', () => {
  it('getCompanyId 回傳 user.companyId', () => {
    expect(getCompanyId({ companyId: 7 })).toBe(7)
  })
  it('getCompanyId fallback 預設公司', () => {
    expect(getCompanyId({ companyId: undefined as unknown as number })).toBe(DEFAULT_COMPANY_ID)
  })
  it('withCompany 補 company_id', () => {
    expect(withCompany({ x: 1 }, 3)).toEqual({ x: 1, company_id: 3 })
  })
})

describe('i18n', () => {
  it('t 取對應語系', () => {
    expect(t('status.approved', 'zh-TW')).toBe('已核准')
    expect(t('status.approved', 'en')).toBe('Approved')
  })
  it('t 未知 key 回 key 本身', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key')
  })
})

describe('timezone', () => {
  it('formatInTimezone 不丟錯且含日期', () => {
    const s = formatInTimezone('2026-06-22T10:00:00Z', 'Asia/Taipei')
    expect(s).toContain('2026')
  })
  it('無效日期回 dash', () => {
    expect(formatInTimezone('not-a-date')).toBe('—')
  })
})

describe('withCommonFields（共用層注入）', () => {
  const keys = (fs: { key: string }[]) => fs.map(f => f.key)
  it('空欄位 → 注入 priority(首) + applicant_note + attachments', () => {
    const r = withCommonFields([])
    expect(keys(r)).toEqual(['priority', 'applicant_note', 'attachments'])
  })
  it('已含 attachments(如 expense) → 不重複注入 attachments', () => {
    const r = withCommonFields([{ key: 'amount', label: '金額', type: 'money' }, { key: 'attachments', label: '憑證', type: 'file', multiple: true }])
    expect(keys(r).filter(k => k === 'attachments')).toHaveLength(1)
    expect(keys(r)[0]).toBe('priority')
    expect(keys(r)).toContain('applicant_note')
  })
  it('已含 priority → 不重複、不再 prepend', () => {
    const r = withCommonFields([{ key: 'priority', label: '緊急', type: 'select' }, { key: 'x', label: 'X' }])
    expect(keys(r).filter(k => k === 'priority')).toHaveLength(1)
  })
  it('idempotent：重複套用結果不變', () => {
    const once = withCommonFields([{ key: 'a', label: 'A' }])
    const twice = withCommonFields(once)
    expect(keys(twice)).toEqual(keys(once))
  })
})

describe('MODULES / CHAINS 完整性', () => {
  const NEW_CODES = ['official_outing', 'leave_cancel', 'trip_cancel', 'overtime_cancel', 'trip_expense_report', 'entertainment', 'payment', 'equipment_borrow', 'memo', 'doc_inbound', 'doc_outbound', 'headcount_request', 'business_card', 'employment_cert', 'unpaid_leave', 'training_request']
  it('14+ 張新表單模組皆存在', () => {
    for (const c of NEW_CODES) expect(MODULE_MAP[c], `缺模組 ${c}`).toBeTruthy()
  })
  it('每個 request 模組綁定的 chain 都存在於 CHAINS（不會落 fallback HR 備查）', () => {
    for (const m of MODULES) {
      if (m.kind === 'request' && m.chain) expect(CHAINS[m.chain], `${m.code} 的 chain ${m.chain} 不存在`).toBeTruthy()
    }
  })
  it('新增兩條通用 chain 存在且有 steps', () => {
    for (const c of ['manager_hr_default', 'manager_admin_default']) {
      expect(CHAINS[c]).toBeTruthy()
      expect(CHAINS[c].steps.length).toBeGreaterThan(0)
    }
  })
  it('每張 request 表單都自動帶共用欄位 priority/applicant_note/attachments', () => {
    for (const m of MODULES) {
      if (m.kind !== 'request') continue
      const ks = (m.fields || []).map(f => f.key)
      expect(ks, `${m.code} 缺 priority`).toContain('priority')
      expect(ks, `${m.code} 缺 applicant_note`).toContain('applicant_note')
      expect(ks, `${m.code} 缺 attachments`).toContain('attachments')
    }
  })
})

describe('lineitem 明細欄位', () => {
  it('公出單 itinerary 為 lineitem 且有行程子欄', () => {
    const f = MODULE_MAP['official_outing'].fields!.find(x => x.key === 'itinerary')!
    expect(f.type).toBe('lineitem')
    expect((f.itemColumns || []).map(c => c.key)).toEqual(expect.arrayContaining(['depart_date', 'from_place', 'to_place']))
  })
  it('出差旅費結報 items 有可加總(sum)費用子欄', () => {
    const f = MODULE_MAP['trip_expense_report'].fields!.find(x => x.key === 'items')!
    expect(f.type).toBe('lineitem')
    expect((f.itemColumns || []).some(c => c.sum)).toBe(true)
  })
})
