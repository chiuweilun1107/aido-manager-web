'use client'
import { useEffect, useState, useCallback } from 'react'
import type { SessionUser } from '@/lib/types'
import type { ModuleField, ModuleColumn, FieldType, LineItemColumn } from '@/lib/modules'
import { CHAINS } from '@/lib/chains'
import { MODULES } from '@/lib/modules'
import Icon, { ICON_NAMES, isImageIcon } from '@/components/Icon'

// ──────────────────────────────────────────────
// 型別
// ──────────────────────────────────────────────
interface FormDef {
  id: number            // 正數=DB row;負數=尚無 DB 覆寫的內建表單(synthetic sentinel)
  company_id: number
  module_code: string
  form_code: string
  name: string
  version: number
  is_active: boolean
  fields_json: ModuleField[]
  columns_json: ModuleColumn[]
  chain_code: string | null
  icon: string | null
  group_name: string | null
  group_code: string | null
  visible_roles: string[] | null
  sort_order: number
  created_at: string
  updated_at: string
  is_builtin?: boolean  // module_code 命中系統內建 MODULES
  customized?: boolean  // 有對應 DB form_definitions row(內建被覆寫 or 純自訂)
}

interface MenuGroup {
  code: string
  name: string
}

interface NewFormDraft {
  module_code: string
  form_code: string
  name: string
  icon: string
  group_code: string
  group_name: string
  chain_code: string
  visible_roles: string[]
}

// ──────────────────────────────────────────────
// 常數
// ──────────────────────────────────────────────
const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: '單行文字' },
  { value: 'textarea', label: '多行文字' },
  { value: 'number', label: '數字' },
  { value: 'money', label: '金額' },
  { value: 'date', label: '日期' },
  { value: 'datetime', label: '日期時間' },
  { value: 'time', label: '時間' },
  { value: 'select', label: '下拉選單' },
  { value: 'user', label: '人員' },
  { value: 'file', label: '檔案' },
  { value: 'relation', label: '關聯表單' },
  { value: 'lineitem', label: '明細表（多列）' },
]

// lineitem 子欄可用型別
const LINEITEM_COL_TYPES: { value: NonNullable<LineItemColumn['type']>; label: string }[] = [
  { value: 'text', label: '文字' }, { value: 'date', label: '日期' }, { value: 'time', label: '時間' },
  { value: 'datetime', label: '日期時間' }, { value: 'number', label: '數字' }, { value: 'money', label: '金額' }, { value: 'select', label: '下拉' },
]

// relation 來源模組可選清單（內建 request 模組，自訂表單於元件內補上）
const BUILTIN_REQUEST_MODULES = MODULES.filter(m => m.kind === 'request').map(m => ({ code: m.code, name: m.name }))

const CHAIN_OPTIONS = Object.keys(CHAINS)

const EMPTY_FIELD = (): ModuleField => ({ key: '', label: '', type: 'text', required: false })

// 9 個固定角色
const ROLE_OPTIONS: { code: string; label: string }[] = [
  { code: 'employee',      label: '一般職員' },
  { code: 'manager',       label: '主管' },
  { code: 'hr',            label: 'HR' },
  { code: 'it',            label: 'IT' },
  { code: 'finance',       label: '財務' },
  { code: 'executive',     label: '經營者' },
  { code: 'admin_officer', label: '行政' },
  { code: 'legal',         label: '法務' },
  { code: 'auditor',       label: '稽核' },
]

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '8px 12px',
  color: 'var(--text)',
  fontSize: '13px',
  width: '100%',
  boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--text-muted)',
  marginBottom: '4px',
}
const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
}
const primaryBtn = (disabled?: boolean): React.CSSProperties => ({
  background: disabled ? 'var(--border-strong)' : 'var(--primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius)',
  padding: '8px 18px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
})
const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '6px 14px',
  fontSize: '13px',
  color: 'var(--text-muted)',
  cursor: 'pointer',
}
const dangerBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '4px 10px',
  fontSize: '12px',
  color: '#e54d4d',
  cursor: 'pointer',
}

// ──────────────────────────────────────────────
// 自動產生表單代碼（使用者不必懂「代碼」概念）— 時間戳+亂數確保唯一
// ──────────────────────────────────────────────
function genModuleCode(): string {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 5)
  return `form_${t}${r}`
}

// 把上傳圖片縮放成 max px 的正方內、輸出 data URL（避免大圖塞爆 DB）
function downscaleImage(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read fail'))
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = () => reject(new Error('img fail'))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('ctx fail'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

// ──────────────────────────────────────────────
// 子元件：Icon 選擇器（下拉內建 + 即時預覽 + 上傳自訂）
// ──────────────────────────────────────────────
function IconSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [uploadErr, setUploadErr] = useState('')
  const uploaded = isImageIcon(value)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 允許重選同一檔
    if (!file) return
    if (!file.type.startsWith('image/')) { setUploadErr('請選擇圖片檔'); return }
    if (file.size > 2 * 1024 * 1024) { setUploadErr('圖片請小於 2MB'); return }
    setUploadErr('')
    try {
      onChange(await downscaleImage(file, 64))
    } catch {
      setUploadErr('圖片處理失敗')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ width: 38, height: 38, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'var(--bg)' }}>
          {value ? <Icon name={value} size={22} /> : <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>無</span>}
        </div>
        <select
          style={{ ...inputStyle, flex: 1 }}
          value={uploaded ? '__uploaded__' : value}
          onChange={e => { if (e.target.value !== '__uploaded__') onChange(e.target.value) }}
        >
          <option value="">（不設定）</option>
          {uploaded && <option value="__uploaded__">自訂上傳圖示</option>}
          {ICON_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <label style={{ ...ghostBtn, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          上傳
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
        </label>
      </div>
      {uploaded && (
        <button type="button" onClick={() => onChange('')} style={{ ...dangerBtn, marginTop: 6, fontSize: 11 }}>移除上傳圖示</button>
      )}
      {uploadErr && <div style={{ marginTop: 4, fontSize: 11, color: '#e54d4d' }}>{uploadErr}</div>}
    </div>
  )
}

// ──────────────────────────────────────────────
// 子元件：單一欄位編輯列
// ──────────────────────────────────────────────
function FieldRow({
  field,
  index,
  total,
  onChange,
  onDelete,
  onMove,
  moduleOptions,
  allFields,
}: {
  field: ModuleField
  index: number
  total: number
  onChange: (patch: Partial<ModuleField>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  moduleOptions: { code: string; name: string }[]
  allFields: ModuleField[]
}) {
  const [optionInput, setOptionInput] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(
    !!(field.showIf || field.validate),
  )

  // showIf 可引用的其他欄位（排除自己 + 無 key 的）
  const otherFields = allFields.filter(f => f.key && f.key !== field.key)
  const SHOWIF_OPS: { value: NonNullable<ModuleField['showIf']>['op']; label: string }[] = [
    { value: '=', label: '等於' }, { value: '!=', label: '不等於' },
    { value: '>', label: '大於' }, { value: '>=', label: '≥' },
    { value: '<', label: '小於' }, { value: '<=', label: '≤' },
  ]

  function addOption() {
    const v = optionInput.trim()
    if (!v) return
    onChange({ options: [...(field.options ?? []), v] })
    setOptionInput('')
  }

  function removeOption(i: number) {
    const next = [...(field.options ?? [])]
    next.splice(i, 1)
    onChange({ options: next })
  }

  // lineitem 子欄編輯
  function addColumn() { onChange({ itemColumns: [...(field.itemColumns ?? []), { key: '', label: '', type: 'text' }] }) }
  function updateColumn(i: number, patch: Partial<LineItemColumn>) {
    const next = [...(field.itemColumns ?? [])]; next[i] = { ...next[i], ...patch }; onChange({ itemColumns: next })
  }
  function removeColumn(i: number) {
    const next = [...(field.itemColumns ?? [])]; next.splice(i, 1); onChange({ itemColumns: next })
  }

  return (
    <div style={{ ...card, padding: '14px 16px', marginBottom: '10px' }}>
      {/* 頂列：key / label / type / required / 操作 */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 130px', minWidth: 0 }}>
          <label style={labelStyle}>欄位 key</label>
          <input
            style={inputStyle}
            value={field.key}
            placeholder="e.g. amount"
            onChange={e => onChange({ key: e.target.value })}
          />
        </div>
        <div style={{ flex: '1 1 130px', minWidth: 0 }}>
          <label style={labelStyle}>顯示名稱</label>
          <input
            style={inputStyle}
            value={field.label}
            placeholder="e.g. 金額"
            onChange={e => onChange({ label: e.target.value })}
          />
        </div>
        <div style={{ flex: '0 0 130px' }}>
          <label style={labelStyle}>型別</label>
          <select
            style={inputStyle}
            value={field.type ?? 'text'}
            onChange={e => onChange({ type: e.target.value as FieldType })}
          >
            {FIELD_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '2px' }}>
          <input
            type="checkbox"
            id={`req-${index}`}
            checked={!!field.required}
            onChange={e => onChange({ required: e.target.checked })}
          />
          <label htmlFor={`req-${index}`} style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer' }}>必填</label>
        </div>
        {/* 排序 + 刪除 */}
        <div style={{ display: 'flex', gap: '6px', paddingBottom: '2px' }}>
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title="上移"
            style={{ ...ghostBtn, padding: '4px 8px', opacity: index === 0 ? 0.4 : 1 }}
          >↑</button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title="下移"
            style={{ ...ghostBtn, padding: '4px 8px', opacity: index === total - 1 ? 0.4 : 1 }}
          >↓</button>
          <button type="button" onClick={onDelete} style={dangerBtn}>刪除</button>
        </div>
      </div>

      {/* select 型別時顯示選項編輯 */}
      {(field.type === 'select') && (
        <div style={{ marginTop: '10px' }}>
          <label style={labelStyle}>選項清單</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {(field.options ?? []).map((opt, i) => (
              <span
                key={i}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '2px 10px',
                  fontSize: '12px',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {opt}
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e54d4d', fontSize: '14px', lineHeight: 1, padding: 0 }}
                >×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              style={{ ...inputStyle, width: 'auto', flex: 1 }}
              value={optionInput}
              placeholder="新增選項值"
              onChange={e => setOptionInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
            />
            <button type="button" onClick={addOption} style={{ ...ghostBtn }}>新增</button>
          </div>
        </div>
      )}

      {/* lineitem 型別時編輯子欄（明細表欄位） */}
      {(field.type === 'lineitem') && (
        <div style={{ marginTop: '10px' }}>
          <label style={labelStyle}>明細子欄</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
            {(field.itemColumns ?? []).map((col, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input style={{ ...inputStyle, width: 'auto', flex: '1 1 110px' }} value={col.key} placeholder="子欄 key" onChange={e => updateColumn(i, { key: e.target.value })} />
                <input style={{ ...inputStyle, width: 'auto', flex: '1 1 110px' }} value={col.label} placeholder="顯示名稱" onChange={e => updateColumn(i, { label: e.target.value })} />
                <select style={{ ...inputStyle, width: 'auto', flex: '0 0 100px' }} value={col.type ?? 'text'} onChange={e => updateColumn(i, { type: e.target.value as LineItemColumn['type'] })}>
                  {LINEITEM_COL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {(col.type === 'money' || col.type === 'number') && (
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input type="checkbox" checked={!!col.sum} onChange={e => updateColumn(i, { sum: e.target.checked })} />加總
                  </label>
                )}
                <button type="button" onClick={() => removeColumn(i)} style={dangerBtn}>刪</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addColumn} style={{ ...ghostBtn }}>+ 新增子欄</button>
        </div>
      )}

      {/* relation 型別時設定來源模組 + 狀態過濾 */}
      {(field.type === 'relation') && (
        <div style={{ marginTop: '10px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <label style={labelStyle}>關聯來源表單</label>
            <select
              style={inputStyle}
              value={field.relation?.sourceModule ?? ''}
              onChange={e => onChange({ relation: { ...field.relation, sourceModule: e.target.value, valueKey: field.relation?.valueKey ?? 'request_no' } })}
            >
              <option value="">請選擇來源表單</option>
              {moduleOptions.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '8px' }}>
            <input
              type="checkbox"
              id={`rel-approved-${index}`}
              checked={(field.relation?.status ?? []).includes('approved')}
              onChange={e => onChange({ relation: { ...(field.relation ?? { sourceModule: '' }), status: e.target.checked ? ['approved'] : [] } })}
            />
            <label htmlFor={`rel-approved-${index}`} style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer' }}>僅可選「已核准」的單據</label>
          </div>
        </div>
      )}

      {/* file 型別時可設定是否多檔 */}
      {(field.type === 'file') && (
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="checkbox"
            id={`file-multi-${index}`}
            checked={!!field.multiple}
            onChange={e => onChange({ multiple: e.target.checked })}
          />
          <label htmlFor={`file-multi-${index}`} style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer' }}>可一次上傳多個檔案</label>
        </div>
      )}

      {/* ── 進階：條件顯示 (showIf) + 驗證規則 (validate) ── */}
      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border)' }}>
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          style={{ ...ghostBtn, fontSize: '12px', padding: '4px 10px' }}
        >
          {showAdvanced ? '▾ 進階（條件顯示 / 驗證規則）' : '▸ 進階（條件顯示 / 驗證規則）'}
          {(field.showIf || field.validate) && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--primary)' }}>●已設定</span>}
        </button>

        {showAdvanced && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* 條件顯示 showIf */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', marginBottom: '6px' }}>
                <input
                  type="checkbox"
                  checked={!!field.showIf}
                  onChange={e => {
                    if (e.target.checked) {
                      const first = otherFields[0]?.key ?? ''
                      onChange({ showIf: { field: first, op: '=', value: '' } })
                    } else {
                      onChange({ showIf: undefined })
                    }
                  }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>條件顯示（其他欄位符合條件時才顯示此欄）</span>
              </label>
              {field.showIf && (
                otherFields.length === 0 ? (
                  <div style={{ fontSize: '11px', color: '#e54d4d' }}>需先有其他「有 key」的欄位才能設條件</div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>當</span>
                    <select
                      style={{ ...inputStyle, width: 'auto', flex: '1 1 130px' }}
                      value={field.showIf.field}
                      onChange={e => onChange({ showIf: { ...field.showIf!, field: e.target.value } })}
                    >
                      {otherFields.map(f => <option key={f.key} value={f.key}>{f.label || f.key}</option>)}
                    </select>
                    <select
                      style={{ ...inputStyle, width: 'auto', flex: '0 0 90px' }}
                      value={field.showIf.op}
                      onChange={e => onChange({ showIf: { ...field.showIf!, op: e.target.value as NonNullable<ModuleField['showIf']>['op'] } })}
                    >
                      {SHOWIF_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input
                      style={{ ...inputStyle, width: 'auto', flex: '1 1 120px' }}
                      value={String(field.showIf.value)}
                      placeholder="比較值"
                      onChange={e => onChange({ showIf: { ...field.showIf!, value: e.target.value } })}
                    />
                  </div>
                )
              )}
            </div>

            {/* 驗證規則 validate */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', marginBottom: '6px' }}>
                <input
                  type="checkbox"
                  checked={!!field.validate}
                  onChange={e => onChange({ validate: e.target.checked ? {} : undefined })}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>驗證規則</span>
                <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>（前端驗證，送出前擋）</span>
              </label>
              {field.validate && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(field.type === 'number' || field.type === 'money') && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={labelStyle}>最小值</label>
                        <input style={inputStyle} type="number" value={field.validate.min ?? ''} placeholder="不限"
                          onChange={e => onChange({ validate: { ...field.validate, min: e.target.value === '' ? undefined : Number(e.target.value) } })} />
                      </div>
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={labelStyle}>最大值</label>
                        <input style={inputStyle} type="number" value={field.validate.max ?? ''} placeholder="不限"
                          onChange={e => onChange({ validate: { ...field.validate, max: e.target.value === '' ? undefined : Number(e.target.value) } })} />
                      </div>
                    </div>
                  )}
                  {(field.type === 'text' || field.type === 'textarea') && (
                    <div>
                      <label style={labelStyle}>格式 (正規表示式 pattern)</label>
                      <input style={inputStyle} value={field.validate.pattern ?? ''} placeholder="例：^09\\d{8}$ (手機)"
                        onChange={e => onChange({ validate: { ...field.validate, pattern: e.target.value || undefined } })} />
                    </div>
                  )}
                  <div>
                    <label style={labelStyle}>驗證失敗提示訊息</label>
                    <input style={inputStyle} value={field.validate.message ?? ''} placeholder="例：請輸入正確的手機號碼"
                      onChange={e => onChange({ validate: { ...field.validate, message: e.target.value || undefined } })} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// 子元件：即時預覽
// ──────────────────────────────────────────────
function FormPreview({ fields }: { fields: ModuleField[] }) {
  if (fields.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-faint)' }}>
        尚未新增欄位
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
      {fields.map((f, i) => (
        <div key={i}>
          <label style={{ ...labelStyle, marginBottom: '6px' }}>
            {f.label || f.key || `欄位 ${i + 1}`}
            {f.required && <span style={{ color: '#e54d4d', marginLeft: '2px' }}>*</span>}
          </label>
          {f.type === 'textarea' ? (
            <textarea
              rows={2}
              disabled
              placeholder={f.placeholder ?? ''}
              style={{ ...inputStyle, resize: 'none' }}
            />
          ) : f.type === 'select' ? (
            <select disabled style={inputStyle}>
              <option>請選擇</option>
              {(f.options ?? []).map(o => <option key={o}>{o}</option>)}
            </select>
          ) : f.type === 'relation' ? (
            <select disabled style={inputStyle}>
              <option>請選擇{f.relation?.sourceModule ? `（來源：${f.relation.sourceModule}）` : '關聯單據'}</option>
            </select>
          ) : (
            <input
              type={
                f.type === 'number' || f.type === 'money' ? 'number' :
                f.type === 'date' ? 'date' :
                f.type === 'datetime' ? 'datetime-local' :
                'text'
              }
              disabled
              placeholder={f.placeholder ?? (f.type === 'file' ? '選擇檔案' : '')}
              style={inputStyle}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────
// 主元件
// ──────────────────────────────────────────────
export default function FormBuilderView({ user: _user }: { user: SessionUser }) {
  const [forms, setForms] = useState<FormDef[]>([])
  const [menuGroups, setMenuGroups] = useState<MenuGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editFields, setEditFields] = useState<ModuleField[]>([])
  const [editMeta, setEditMeta] = useState<Partial<FormDef>>({})
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newDraft, setNewDraft] = useState<NewFormDraft>({
    module_code: '', form_code: '', name: '', icon: '', group_code: '', group_name: '', chain_code: '', visible_roles: [],
  })
  const [newFields, setNewFields] = useState<ModuleField[]>([])
  const [showNewAdvanced, setShowNewAdvanced] = useState(false)
  const [showNewPreview, setShowNewPreview] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // 開/關「新增表單」面板：開啟時自動產生代碼並清空欄位草稿
  function toggleNewForm() {
    setErrMsg('')
    setShowNewForm(prev => {
      if (!prev) {
        setNewDraft({ module_code: genModuleCode(), form_code: '', name: '', icon: '', group_code: '', group_name: '', chain_code: '', visible_roles: [] })
        setNewFields([])
        setShowNewAdvanced(false)
        setShowNewPreview(false)
      }
      return !prev
    })
  }

  // ── 新增表單的欄位操作 ──
  function addNewField() { setNewFields(prev => [...prev, EMPTY_FIELD()]) }
  function updateNewField(index: number, patch: Partial<ModuleField>) {
    setNewFields(prev => prev.map((f, i) => i === index ? { ...f, ...patch } : f))
  }
  function deleteNewField(index: number) {
    setNewFields(prev => prev.filter((_, i) => i !== index))
  }
  function moveNewField(index: number, dir: -1 | 1) {
    setNewFields(prev => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  // ── 讀取表單清單 ──
  const loadForms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/forms')
      const data = await res.json()
      setForms(data.forms ?? [])
    } catch {
      setErrMsg('載入失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── 讀取 menu_groups ──
  const loadMenuGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/menu-groups')
      const data = await res.json()
      setMenuGroups(data.groups ?? [])
    } catch (e) {
      // 群組下拉顯示空清單；記錄 console 方便排查（不阻斷 UI）
      console.error('載入群組失敗', e)
    }
  }, [])

  useEffect(() => { loadForms(); loadMenuGroups() }, [loadForms, loadMenuGroups])

  // ── 選中表單 ──
  function selectForm(f: FormDef) {
    setSelectedId(f.id)
    setEditFields(f.fields_json ? [...f.fields_json] : [])
    setEditMeta({
      name: f.name,
      icon: f.icon ?? '',
      group_name: f.group_name ?? '',
      group_code: f.group_code ?? '',
      visible_roles: f.visible_roles ?? [],
      chain_code: f.chain_code ?? '',
      is_active: f.is_active,
      module_code: f.module_code,
      form_code: f.form_code,
    })
    setErrMsg('')
    setSuccessMsg('')
    setShowPreview(false)
  }

  // ── 欄位操作 ──
  function addField() {
    setEditFields(prev => [...prev, EMPTY_FIELD()])
  }

  function updateField(index: number, patch: Partial<ModuleField>) {
    setEditFields(prev => prev.map((f, i) => i === index ? { ...f, ...patch } : f))
  }

  function deleteField(index: number) {
    setEditFields(prev => prev.filter((_, i) => i !== index))
  }

  function moveField(index: number, dir: -1 | 1) {
    setEditFields(prev => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  // ── 儲存 ──
  async function handleSave() {
    if (selectedId == null || !selected) return
    const badField = editFields.find(f => !f.key.trim() || !f.label.trim())
    if (badField) { setErrMsg('每個欄位都要填「欄位 key」與「顯示名稱」'); return }
    setErrMsg(''); setSuccessMsg(''); setSaving(true)
    try {
      // group_code 變動時同步 group_name
      const selectedGroup = menuGroups.find(g => g.code === (editMeta.group_code ?? ''))
      const meta = {
        name: editMeta.name,
        icon: editMeta.icon || null,
        group_code: editMeta.group_code || null,
        group_name: selectedGroup ? selectedGroup.name : (editMeta.group_name || null),
        visible_roles: (editMeta.visible_roles && editMeta.visible_roles.length > 0) ? editMeta.visible_roles : null,
        chain_code: editMeta.chain_code || null,
        is_active: editMeta.is_active,
        fields_json: editFields,
      }
      // 內建表單(id<0,尚無 DB 覆寫) → POST override 建立覆寫 row;既有 DB row → PUT 更新
      const isBuiltinNew = selected.id < 0
      const res = isBuiltinNew
        ? await fetch('/api/admin/forms', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ override: true, module_code: selected.module_code, form_code: selected.form_code, columns_json: selected.columns_json ?? [], ...meta }),
          })
        : await fetch('/api/admin/forms', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: selectedId, ...meta }),
          })
      const data = await res.json()
      if (!res.ok) { setErrMsg(data.error || '儲存失敗'); return }
      if (data.warning) { setErrMsg(data.warning) } else { setSuccessMsg(isBuiltinNew ? '已建立覆寫並儲存' : '已儲存') }
      await loadForms()
      // 內建存完後 id 由負轉正 → 用回傳的新 row 重新選取,避免 selectedId 停在失效的負數
      if (isBuiltinNew && data.form) selectForm(data.form)
      setTimeout(() => setSuccessMsg(''), 2500)
    } catch {
      setErrMsg('儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  // ── 新增表單 ──
  async function handleCreate() {
    if (!newDraft.name.trim()) {
      setErrMsg('請填寫表單名稱')
      return
    }
    // 代碼一律自動生成；若使用者在「進階」清空了，補一個
    const moduleCode = (newDraft.module_code || genModuleCode()).trim()
    // 欄位 key 不可空（fields_json 以 key 為資料鍵）
    const badField = newFields.find(f => !f.key.trim() || !f.label.trim())
    if (badField) { setErrMsg('每個欄位都要填「欄位 key」與「顯示名稱」'); return }
    setSaving(true); setErrMsg('')
    try {
      const selectedGroup = menuGroups.find(g => g.code === newDraft.group_code)
      const res = await fetch('/api/admin/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_code: moduleCode,
          form_code: newDraft.form_code || moduleCode,
          name: newDraft.name.trim(),
          icon: newDraft.icon || null,
          group_code: newDraft.group_code || null,
          group_name: selectedGroup ? selectedGroup.name : (newDraft.group_name || null),
          visible_roles: newDraft.visible_roles.length > 0 ? newDraft.visible_roles : null,
          chain_code: newDraft.chain_code || null,
          fields_json: newFields,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErrMsg(data.error || '新增失敗'); return }
      setShowNewForm(false)
      setNewDraft({ module_code: '', form_code: '', name: '', icon: '', group_code: '', group_name: '', chain_code: '', visible_roles: [] })
      setNewFields([])
      await loadForms()
      if (data.form) selectForm(data.form)
      if (data.warning) setErrMsg(data.warning)
    } catch {
      setErrMsg('新增失敗')
    } finally {
      setSaving(false)
    }
  }

  // ── 刪除表單 ──
  async function handleDelete(id: number) {
    if (!confirm('確定刪除此表單？')) return
    try {
      const res = await fetch(`/api/admin/forms?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setErrMsg(data.error || '刪除失敗'); return }
      if (selectedId === id) { setSelectedId(null); setEditFields([]) }
      await loadForms()
    } catch {
      setErrMsg('刪除失敗')
    }
  }

  const selected = forms.find(f => f.id === selectedId) ?? null

  // relation 欄位可關聯的來源表單：內建 request 模組 + 自訂表單（同 code 以自訂為準）
  const moduleOptions = (() => {
    const map = new Map<string, { code: string; name: string }>()
    for (const m of BUILTIN_REQUEST_MODULES) map.set(m.code, m)
    for (const f of forms) map.set(f.module_code, { code: f.module_code, name: f.name })
    return Array.from(map.values())
  })()

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      <style>{`
        .fb-layout { display: grid; grid-template-columns: 280px 1fr; gap: 20px; }
        @media (max-width: 768px) { .fb-layout { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>表單設計器</h1>
          <div className="label-mono" style={{ marginTop: '4px' }}>Form Builder</div>
        </div>
        <button
          onClick={toggleNewForm}
          style={primaryBtn()}
        >
          {showNewForm ? '取消' : '+ 新增表單'}
        </button>
      </div>

      {/* ── 新增表單 Panel（與編輯同功：基本資訊 + 欄位設計 + 簽核 + 預覽）── */}
      {showNewForm && (
        <div style={{ ...card, padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>建立新表單</h2>

          {/* 基本資訊 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
            <div>
              <label style={labelStyle}>表單名稱 *</label>
              <input style={inputStyle} value={newDraft.name} placeholder="例：請假申請"
                onChange={e => setNewDraft(d => ({ ...d, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>圖示</label>
              <IconSelector value={newDraft.icon} onChange={v => setNewDraft(d => ({ ...d, icon: v }))} />
            </div>
            <div>
              <label style={labelStyle}>群組 / 分類</label>
              <select style={inputStyle} value={newDraft.group_code}
                onChange={e => setNewDraft(d => ({ ...d, group_code: e.target.value }))}>
                <option value="">不分類</option>
                {menuGroups.map(g => <option key={g.code} value={g.code}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>綁定簽核流程</label>
              <select style={inputStyle} value={newDraft.chain_code}
                onChange={e => setNewDraft(d => ({ ...d, chain_code: e.target.value }))}>
                <option value="">不綁定</option>
                {CHAIN_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* 可見角色 */}
          <div style={{ marginTop: '14px' }}>
            <label style={labelStyle}>可見角色（空 = 全部可見）</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', marginTop: '6px' }}>
              {ROLE_OPTIONS.map(r => (
                <label key={r.code} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newDraft.visible_roles.includes(r.code)}
                    onChange={e => {
                      setNewDraft(d => ({
                        ...d,
                        visible_roles: e.target.checked
                          ? [...d.visible_roles, r.code]
                          : d.visible_roles.filter(rc => rc !== r.code),
                      }))
                    }}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          {/* 進階：表單代碼（系統自動產生，一般不需更動） */}
          <div style={{ marginTop: '12px' }}>
            <button type="button" onClick={() => setShowNewAdvanced(v => !v)}
              style={{ ...ghostBtn, fontSize: '12px', padding: '4px 10px' }}>
              {showNewAdvanced ? '▾ 進階設定' : '▸ 進階設定'}
            </button>
            {showNewAdvanced && (
              <div style={{ marginTop: '10px', maxWidth: '320px' }}>
                <label style={labelStyle}>表單代碼 <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>（系統自動產生，可改成易記英文）</span></label>
                <input style={inputStyle} value={newDraft.module_code}
                  onChange={e => setNewDraft(d => ({ ...d, module_code: e.target.value }))} />
              </div>
            )}
          </div>

          {/* 欄位設計 */}
          <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>欄位設計</span>
                <span className="label-mono" style={{ marginLeft: '10px', fontSize: '11px' }}>{newFields.length} 個欄位</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowNewPreview(v => !v)} style={{ ...ghostBtn, fontSize: '12px', padding: '5px 12px' }}>
                  {showNewPreview ? '隱藏預覽' : '即時預覽'}
                </button>
                <button onClick={addNewField} style={{ ...ghostBtn }}>+ 新增欄位</button>
              </div>
            </div>

            {newFields.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-faint)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)' }}>
                尚未新增欄位，點擊「+ 新增欄位」開始設計（也可建立後再補）
              </div>
            )}

            {newFields.map((f, i) => (
              <FieldRow
                key={i}
                field={f}
                index={i}
                total={newFields.length}
                onChange={patch => updateNewField(i, patch)}
                onDelete={() => deleteNewField(i)}
                onMove={dir => moveNewField(i, dir)}
                moduleOptions={moduleOptions}
                allFields={newFields}
              />
            ))}

            {newFields.length > 0 && (
              <button onClick={addNewField} style={{ ...ghostBtn, width: '100%', marginTop: '4px', textAlign: 'center' }}>
                + 新增欄位
              </button>
            )}

            {showNewPreview && (
              <div style={{ ...card, marginTop: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <span className="label-mono">即時預覽</span>
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-faint)' }}>{newDraft.name || '新表單'}</span>
                </div>
                <FormPreview fields={newFields} />
              </div>
            )}
          </div>

          {errMsg && <div style={{ marginTop: '14px', fontSize: '13px', color: '#e54d4d' }}>{errMsg}</div>}
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
            <button onClick={handleCreate} disabled={saving} style={primaryBtn(saving)}>
              {saving ? '建立中…' : '建立表單'}
            </button>
            <button onClick={() => { setShowNewForm(false); setErrMsg('') }} style={ghostBtn}>取消</button>
          </div>
        </div>
      )}

      <div className="fb-layout">
        {/* ── 左側：表單清單 ── */}
        <div>
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <span className="label-mono">表單清單</span>
              <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-faint)' }}>
                {forms.length} 個
              </span>
            </div>
            {loading && (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-faint)' }}>載入中…</div>
            )}
            {!loading && forms.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-faint)' }}>尚無表單</div>
            )}
            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {forms.map(f => (
              <div
                key={f.id}
                onClick={() => selectForm(f)}
                style={{
                  padding: '11px 14px',
                  border: selectedId === f.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  background: selectedId === f.id ? 'var(--surface-2)' : 'var(--surface)',
                  transition: 'border-color .15s, background .1s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </div>
                    <div className="label-mono" style={{ marginTop: '2px', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.module_code === f.form_code ? f.module_code : `${f.module_code} / ${f.form_code}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {/* 來源 badge：內建 / 內建·已修改 / 自訂 */}
                    <span style={{
                      fontSize: '10px', padding: '1px 6px', borderRadius: '99px',
                      background: !f.is_builtin ? '#fef3c7' : f.customized ? '#dbeafe' : 'var(--surface-2)',
                      color: !f.is_builtin ? '#b45309' : f.customized ? '#2563eb' : 'var(--text-faint)',
                    }}>
                      {!f.is_builtin ? '自訂' : f.customized ? '內建·已修改' : '內建'}
                    </span>
                    <span style={{
                      fontSize: '10px', padding: '1px 6px', borderRadius: '99px',
                      background: f.is_active ? '#d1fae5' : 'var(--surface-2)',
                      color: f.is_active ? '#059669' : 'var(--text-faint)',
                    }}>
                      {f.is_active ? '啟用' : '停用'}
                    </span>
                    {/* 刪除鈕只對真實 DB row(id>0);內建覆寫刪除=還原內建;純內建(id<0)無刪除鈕 */}
                    {f.id > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(f.id) }}
                        title={f.is_builtin ? '刪除此覆寫(還原為系統內建表單)' : '刪除此自訂表單'}
                        style={{ ...dangerBtn, padding: '2px 7px', fontSize: '11px' }}
                      >{f.is_builtin ? '還原' : '刪'}</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>

        {/* ── 右側：欄位編輯器 ── */}
        <div style={{ minWidth: 0 }}>
          {!selected ? (
            <div style={{ ...card, padding: '48px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-faint)' }}>← 從左側選擇一個表單開始編輯</div>
            </div>
          ) : (
            <>
              {/* 基本資訊 */}
              <div style={{ ...card, padding: '18px', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '14px' }}>基本資訊</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>表單名稱</label>
                    <input style={inputStyle} value={editMeta.name ?? ''}
                      onChange={e => setEditMeta(m => ({ ...m, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>表單代碼 <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>（建立後固定）</span></label>
                    <input style={{ ...inputStyle, color: 'var(--text-faint)' }} value={editMeta.module_code ?? ''} readOnly />
                  </div>
                  <div>
                    <label style={labelStyle}>圖示</label>
                    <IconSelector value={editMeta.icon ?? ''} onChange={v => setEditMeta(m => ({ ...m, icon: v }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>群組 / 分類</label>
                    <select style={inputStyle} value={editMeta.group_code ?? ''}
                      onChange={e => setEditMeta(m => ({ ...m, group_code: e.target.value }))}>
                      <option value="">不分類</option>
                      {menuGroups.map(g => <option key={g.code} value={g.code}>{g.name}</option>)}
                    </select>
                    {/* 相容顯示：尚無 group_code 但有舊 group_name */}
                    {!editMeta.group_code && editMeta.group_name && (
                      <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-faint)' }}>
                        舊值: {editMeta.group_name}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>綁定簽核流程</label>
                    <select style={inputStyle} value={editMeta.chain_code ?? ''}
                      onChange={e => setEditMeta(m => ({ ...m, chain_code: e.target.value }))}>
                      <option value="">不綁定</option>
                      {CHAIN_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '18px' }}>
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={!!editMeta.is_active}
                      onChange={e => setEditMeta(m => ({ ...m, is_active: e.target.checked }))}
                    />
                    <label htmlFor="is_active" style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer' }}>啟用</label>
                  </div>
                </div>
                {/* 可見角色 */}
                <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  <label style={labelStyle}>可見角色（空 = 全部可見）</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', marginTop: '6px' }}>
                    {ROLE_OPTIONS.map(r => (
                      <label key={r.code} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={(editMeta.visible_roles ?? []).includes(r.code)}
                          onChange={e => {
                            setEditMeta(m => {
                              const cur = m.visible_roles ?? []
                              return {
                                ...m,
                                visible_roles: e.target.checked
                                  ? [...cur, r.code]
                                  : cur.filter(rc => rc !== r.code),
                              }
                            })
                          }}
                        />
                        {r.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* 欄位編輯器 */}
              <div style={{ ...card, padding: '18px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>欄位設定</span>
                    <span className="label-mono" style={{ marginLeft: '10px', fontSize: '11px' }}>
                      {editFields.length} 個欄位
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setShowPreview(v => !v)}
                      style={{ ...ghostBtn, fontSize: '12px', padding: '5px 12px' }}
                    >
                      {showPreview ? '隱藏預覽' : '即時預覽'}
                    </button>
                    <button onClick={addField} style={{ ...ghostBtn }}>+ 新增欄位</button>
                  </div>
                </div>

                {editFields.length === 0 && (
                  <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-faint)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)' }}>
                    尚未新增欄位，點擊「+ 新增欄位」開始設計
                  </div>
                )}

                {editFields.map((f, i) => (
                  <FieldRow
                    key={i}
                    field={f}
                    index={i}
                    total={editFields.length}
                    onChange={patch => updateField(i, patch)}
                    onDelete={() => deleteField(i)}
                    onMove={dir => moveField(i, dir)}
                    moduleOptions={moduleOptions}
                    allFields={editFields}
                  />
                ))}

                {editFields.length > 0 && (
                  <button onClick={addField} style={{ ...ghostBtn, width: '100%', marginTop: '4px', textAlign: 'center' }}>
                    + 新增欄位
                  </button>
                )}
              </div>

              {/* 即時預覽 */}
              {showPreview && (
                <div style={{ ...card, marginBottom: '16px', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    <span className="label-mono">即時預覽</span>
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-faint)' }}>
                      {editMeta.name}
                    </span>
                  </div>
                  <FormPreview fields={editFields} />
                </div>
              )}

              {/* 操作列 */}
              {errMsg && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '13px', color: '#e54d4d', marginBottom: '12px' }}>
                  {errMsg}
                </div>
              )}
              {successMsg && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '13px', color: '#059669', marginBottom: '12px' }}>
                  {successMsg}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleSave} disabled={saving} style={primaryBtn(saving)}>
                  {saving ? '儲存中…' : '儲存表單'}
                </button>
                <button onClick={() => selectForm(selected)} style={ghostBtn}>重設</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
