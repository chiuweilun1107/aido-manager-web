'use client'
import { useEffect, useState, useCallback } from 'react'
import type { SessionUser } from '@/lib/types'
import type { ModuleField, ModuleColumn, FieldType } from '@/lib/modules'
import { CHAINS } from '@/lib/chains'

// ──────────────────────────────────────────────
// 型別
// ──────────────────────────────────────────────
interface FormDef {
  id: number
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
  sort_order: number
  created_at: string
  updated_at: string
}

interface NewFormDraft {
  module_code: string
  form_code: string
  name: string
  icon: string
  group_name: string
  chain_code: string
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
  { value: 'select', label: '下拉選單' },
  { value: 'user', label: '人員' },
  { value: 'file', label: '檔案' },
]

const CHAIN_OPTIONS = Object.keys(CHAINS)

const EMPTY_FIELD = (): ModuleField => ({ key: '', label: '', type: 'text', required: false })

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
// 子元件：單一欄位編輯列
// ──────────────────────────────────────────────
function FieldRow({
  field,
  index,
  total,
  onChange,
  onDelete,
  onMove,
}: {
  field: ModuleField
  index: number
  total: number
  onChange: (patch: Partial<ModuleField>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const [optionInput, setOptionInput] = useState('')

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
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editFields, setEditFields] = useState<ModuleField[]>([])
  const [editMeta, setEditMeta] = useState<Partial<FormDef>>({})
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newDraft, setNewDraft] = useState<NewFormDraft>({
    module_code: '', form_code: '', name: '', icon: '', group_name: '', chain_code: '',
  })
  const [showPreview, setShowPreview] = useState(false)

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

  useEffect(() => { loadForms() }, [loadForms])

  // ── 選中表單 ──
  function selectForm(f: FormDef) {
    setSelectedId(f.id)
    setEditFields(f.fields_json ? [...f.fields_json] : [])
    setEditMeta({
      name: f.name,
      icon: f.icon ?? '',
      group_name: f.group_name ?? '',
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
    if (!selectedId) return
    setErrMsg(''); setSuccessMsg(''); setSaving(true)
    try {
      const res = await fetch('/api/admin/forms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedId,
          name: editMeta.name,
          icon: editMeta.icon || null,
          group_name: editMeta.group_name || null,
          chain_code: editMeta.chain_code || null,
          is_active: editMeta.is_active,
          fields_json: editFields,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErrMsg(data.error || '儲存失敗'); return }
      setSuccessMsg('已儲存')
      await loadForms()
      setTimeout(() => setSuccessMsg(''), 2500)
    } catch {
      setErrMsg('儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  // ── 新增表單 ──
  async function handleCreate() {
    if (!newDraft.module_code || !newDraft.form_code || !newDraft.name) {
      setErrMsg('module_code / form_code / 名稱 為必填')
      return
    }
    setSaving(true); setErrMsg('')
    try {
      const res = await fetch('/api/admin/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_code: newDraft.module_code,
          form_code: newDraft.form_code,
          name: newDraft.name,
          icon: newDraft.icon || null,
          group_name: newDraft.group_name || null,
          chain_code: newDraft.chain_code || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErrMsg(data.error || '新增失敗'); return }
      setShowNewForm(false)
      setNewDraft({ module_code: '', form_code: '', name: '', icon: '', group_name: '', chain_code: '' })
      await loadForms()
      if (data.form) selectForm(data.form)
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
          onClick={() => { setShowNewForm(v => !v); setErrMsg('') }}
          style={primaryBtn()}
        >
          {showNewForm ? '取消' : '+ 新增表單'}
        </button>
      </div>

      {/* ── 新增表單 Panel ── */}
      {showNewForm && (
        <div style={{ ...card, padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>建立新表單</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
            <div>
              <label style={labelStyle}>module_code *</label>
              <input style={inputStyle} value={newDraft.module_code} placeholder="e.g. leave"
                onChange={e => setNewDraft(d => ({ ...d, module_code: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>form_code *</label>
              <input style={inputStyle} value={newDraft.form_code} placeholder="e.g. leave_v2"
                onChange={e => setNewDraft(d => ({ ...d, form_code: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>表單名稱 *</label>
              <input style={inputStyle} value={newDraft.name} placeholder="e.g. 請假申請"
                onChange={e => setNewDraft(d => ({ ...d, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Icon</label>
              <input style={inputStyle} value={newDraft.icon} placeholder="e.g. calendar"
                onChange={e => setNewDraft(d => ({ ...d, icon: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>群組 / 分類</label>
              <input style={inputStyle} value={newDraft.group_name} placeholder="e.g. 差勤"
                onChange={e => setNewDraft(d => ({ ...d, group_name: e.target.value }))} />
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
          {errMsg && <div style={{ marginTop: '12px', fontSize: '13px', color: '#e54d4d' }}>{errMsg}</div>}
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
                      {f.module_code} / {f.form_code}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '10px', padding: '1px 6px', borderRadius: '99px',
                      background: f.is_active ? '#d1fae5' : 'var(--surface-2)',
                      color: f.is_active ? '#059669' : 'var(--text-faint)',
                    }}>
                      {f.is_active ? '啟用' : '停用'}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(f.id) }}
                      style={{ ...dangerBtn, padding: '2px 7px', fontSize: '11px' }}
                    >刪</button>
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
                    <label style={labelStyle}>module_code</label>
                    <input style={{ ...inputStyle, color: 'var(--text-faint)' }} value={editMeta.module_code ?? ''} readOnly />
                  </div>
                  <div>
                    <label style={labelStyle}>form_code</label>
                    <input style={{ ...inputStyle, color: 'var(--text-faint)' }} value={editMeta.form_code ?? ''} readOnly />
                  </div>
                  <div>
                    <label style={labelStyle}>Icon</label>
                    <input style={inputStyle} value={editMeta.icon ?? ''}
                      onChange={e => setEditMeta(m => ({ ...m, icon: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>群組</label>
                    <input style={inputStyle} value={editMeta.group_name ?? ''}
                      onChange={e => setEditMeta(m => ({ ...m, group_name: e.target.value }))} />
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
