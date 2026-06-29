'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Module, ModuleField } from '@/lib/modules'
import type { SessionUser } from '@/lib/types'
import RelationSelect from '@/components/RelationSelect'
import UserSelect from '@/components/UserSelect'
import FilePreview from '@/components/FilePreview'

const STATUS_MAP: Record<string, string> = {
  draft: '草稿', in_review: '審核中', approved: '已核准', rejected: '已駁回', returned: '退回', cancelled: '已取消'
}

interface ModuleViewProps { module: Module; user: SessionUser }

/** 條件顯示：依另一欄位值決定本欄是否出現 */
function fieldVisible(f: ModuleField, form: Record<string, unknown>): boolean {
  if (!f.showIf) return true
  const left = String(form[f.showIf.field] ?? '')
  const rv = f.showIf.value
  const ln = parseFloat(left)
  const rn = typeof rv === 'number' ? rv : parseFloat(String(rv))
  switch (f.showIf.op) {
    case '>': return ln > rn
    case '>=': return ln >= rn
    case '<': return ln < rn
    case '<=': return ln <= rn
    case '=': return left === String(rv)
    case '!=': return left !== String(rv)
    default: return true
  }
}

/** 單欄驗證，回 null 表通過 */
function validateField(f: ModuleField, val: string): string | null {
  if (f.required && !val) return `「${f.label}」為必填`
  if (!val) return null
  if (f.validate?.pattern && !new RegExp(f.validate.pattern).test(val)) return f.validate.message || `「${f.label}」格式不符`
  if (f.type === 'number' || f.type === 'money') {
    const n = Number(val)
    if (Number.isNaN(n)) return `「${f.label}」必須是數字`
    if (f.validate?.min != null && n < f.validate.min) return `「${f.label}」不可小於 ${f.validate.min}`
    if (f.validate?.max != null && n > f.validate.max) return `「${f.label}」不可大於 ${f.validate.max}`
  }
  return null
}

export default function ModuleView({ module: mod, user: _user }: ModuleViewProps) {
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [errMsg, setErrMsg] = useState('')

  // 受控輸入用：純量值(string/number)轉字串；array/object(file 多檔/lineitem)回空字串不綁進文字輸入。
  // 注意：agent 預填的草稿會把數字欄位(時數)與 user id 存成 number，故不可只認 string，否則被丟成空。
  const sv = (k: string): string => { const v = form[k]; return (v == null || typeof v === 'object') ? '' : String(v) }
  // 取某 file 欄位已上傳的 fileId 陣列（相容單一字串與陣列）
  const fileIdsOf = (k: string): string[] => { const v = form[k]; return Array.isArray(v) ? (v as string[]) : (typeof v === 'string' && v ? [v] : []) }
  // lineitem（明細表）列存取
  const rowsOf = (k: string): Record<string, string>[] => { const v = form[k]; return Array.isArray(v) ? (v as Record<string, string>[]) : [] }
  const addRow = (k: string) => setForm(p => ({ ...p, [k]: [...(Array.isArray(p[k]) ? (p[k] as Record<string, string>[]) : []), {}] }))
  const removeRow = (k: string, idx: number) => setForm(p => ({ ...p, [k]: (Array.isArray(p[k]) ? (p[k] as Record<string, string>[]) : []).filter((_, i) => i !== idx) }))
  const setCell = (k: string, idx: number, col: string, val: string) => setForm(p => {
    const rows = Array.isArray(p[k]) ? [...(p[k] as Record<string, string>[])] : []
    rows[idx] = { ...(rows[idx] || {}), [col]: val }
    return { ...p, [k]: rows }
  })

  useEffect(() => {
    fetch(`/api/modules/${mod.code}`)
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [mod.code])

  // 上傳一或多個檔案；multiple 欄位累加成 fileId 陣列，單檔欄位存單一字串
  async function handleFiles(key: string, files: File[], multiple: boolean) {
    if (files.length === 0) return
    setUploading(key); setErrMsg('')
    try {
      const uploaded: { id: string; name: string }[] = []
      for (const file of files) {
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) { setErrMsg(`${file.name}：${data.error || '上傳失敗'}`); break }
        uploaded.push({ id: String(data.fileId), name: data.fileName })
      }
      if (uploaded.length === 0) return
      if (multiple) {
        setForm(p => {
          const cur = Array.isArray(p[key]) ? (p[key] as string[]) : (typeof p[key] === 'string' && p[key] ? [p[key] as string] : [])
          return { ...p, [key]: [...cur, ...uploaded.map(u => u.id)] }
        })
      } else {
        setForm(p => ({ ...p, [key]: uploaded[0].id }))
      }
    } finally {
      setUploading(null)
    }
  }

  // 移除已上傳的某個檔案（依索引）
  function removeFile(key: string, idx: number, multiple: boolean) {
    if (multiple) {
      setForm(p => {
        const cur = Array.isArray(p[key]) ? (p[key] as string[]) : []
        return { ...p, [key]: cur.filter((_, i) => i !== idx) }
      })
    } else {
      setForm(p => { const n = { ...p }; delete n[key]; return n })
    }
  }

  function endpoint(mode: 'draft' | 'submit') {
    const qs = new URLSearchParams()
    if (mode === 'draft') qs.set('mode', 'draft')
    if (editingId) qs.set('id', String(editingId))
    const q = qs.toString()
    return `/api/modules/${mod.code}${q ? '?' + q : ''}`
  }

  async function refreshList() {
    const refreshed = await fetch(`/api/modules/${mod.code}`).then(r => r.json())
    setItems(refreshed.items || [])
  }

  function closeForm() { setShowForm(false); setForm({}); setEditingId(null); setErrMsg('') }

  // 送出(submit)會驗證可見必填欄位；存草稿(draft)允許不完整
  async function persist(mode: 'draft' | 'submit') {
    setErrMsg('')
    if (mode === 'submit') {
      for (const f of mod.fields || []) {
        if (!fieldVisible(f, form)) continue
        const raw = form[f.key]
        // file/lineitem 欄位以「陣列非空」判斷有無值；其餘用字串
        const valForCheck = Array.isArray(raw) ? (raw.length > 0 ? 'x' : '') : (typeof raw === 'string' ? raw : '')
        const err = validateField(f, valForCheck)
        if (err) { setErrMsg(err); return }
      }
    }
    if (mode === 'draft') setSavingDraft(true); else setSubmitting(true)
    const res = await fetch(endpoint(mode), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    })
    const data = await res.json()
    if (mode === 'draft') setSavingDraft(false); else setSubmitting(false)
    if (!res.ok) { setErrMsg(data.error || (mode === 'draft' ? '草稿儲存失敗' : '送出失敗')); return }
    closeForm()
    await refreshList()
  }

  function handleSubmit(e: React.FormEvent) { e.preventDefault(); persist('submit') }

  // 由清單載入既有草稿續編
  async function loadDraft(id: number) {
    setErrMsg('')
    const res = await fetch(`/api/requests/${id}`)
    if (!res.ok) {
      // 他人草稿(403)/不存在(404)/其他 → 報錯不開空白表單（避免綁外部 id 的誤導表單）
      setErrMsg(res.status === 403 ? '無權存取此草稿' : res.status === 404 ? '找不到此草稿' : '草稿載入失敗')
      return
    }
    const d = await res.json()
    const payload = (d?.request?.payload as Record<string, unknown>) || {}
    setForm(payload); setEditingId(id); setShowForm(true)
  }

  // 深連結預填：?draft=<id> → 自動載入既有草稿續編
  // 供 agent app 導流「對話確認 → 開公司表單頁，欄位已預填」(loadDraft 經 /api/requests/[id] 有 owner 驗證)
  useEffect(() => {
    if (mod.kind !== 'request') return
    const draftId = new URLSearchParams(window.location.search).get('draft')
    if (draftId && /^\d+$/.test(draftId)) loadDraft(Number(draftId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod.code])

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2'
  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>{mod.name}</h1>
        {(mod.kind === 'request' || mod.kind === 'record') && (
          <button onClick={() => { if (showForm) closeForm(); else { setForm({}); setEditingId(null); setShowForm(true) } }}
            style={{ background: 'var(--primary)', color: '#fff', fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer' }}>
            {showForm ? '取消' : '新增申請'}
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginTop: 0, marginBottom: '16px' }}>{editingId ? '編輯草稿' : '填寫'} {mod.name}</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mod.fields?.filter(f => fieldVisible(f, form)).map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  {f.label}{f.required && <span style={{ color: 'var(--danger)', marginLeft: '2px' }}>*</span>}
                </label>
                {f.type === 'relation' ? (
                  <RelationSelect field={f} value={sv(f.key)} onChange={v => setForm(p => ({ ...p, [f.key]: v }))} />
                ) : f.type === 'user' ? (
                  <UserSelect value={sv(f.key)} required={f.required} onChange={v => setForm(p => ({ ...p, [f.key]: v }))} />
                ) : f.type === 'select' ? (
                  <select required={f.required} value={sv(f.key)} className={inputCls} style={inputStyle}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                    <option value="">請選擇</option>
                    {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea required={f.required} rows={3} value={sv(f.key)} className={inputCls} style={inputStyle}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                ) : f.type === 'file' ? (
                  <div>
                    <input
                      type="file"
                      multiple={f.multiple}
                      accept="image/*,.pdf"
                      onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; if (files.length) handleFiles(f.key, files, !!f.multiple) }}
                      style={{ fontSize: '13px', color: 'var(--text-muted)' }}
                    />
                    {uploading === f.key && <span style={{ fontSize: '12px', color: 'var(--primary)', marginLeft: '8px' }}>上傳中…</span>}
                    {fileIdsOf(f.key).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
                        {fileIdsOf(f.key).map((id, i) => (
                          <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <FilePreview fileId={id} size={84} showName />
                            <button type="button" onClick={() => removeFile(f.key, i, !!f.multiple)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e54d4d', fontSize: '12px', lineHeight: 1, padding: 0 }}>移除</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : f.type === 'lineitem' ? (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', minWidth: '480px' }}>
                        <thead style={{ background: 'var(--surface-2)' }}>
                          <tr>
                            {(f.itemColumns || []).map(c => (
                              <th key={c.key} className="label-mono" style={{ padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>{c.label}</th>
                            ))}
                            <th style={{ width: 44 }} />
                          </tr>
                        </thead>
                        <tbody>
                          {rowsOf(f.key).length === 0 && (
                            <tr><td colSpan={(f.itemColumns || []).length + 1} style={{ padding: '10px', textAlign: 'center', color: 'var(--text-faint)' }}>尚無明細，點「新增明細」</td></tr>
                          )}
                          {rowsOf(f.key).map((row, ri) => (
                            <tr key={ri} style={{ borderTop: '1px solid var(--border)' }}>
                              {(f.itemColumns || []).map(c => (
                                <td key={c.key} style={{ padding: '4px 6px' }}>
                                  {c.type === 'select' ? (
                                    <select value={row[c.key] || ''} className={inputCls} style={inputStyle} onChange={e => setCell(f.key, ri, c.key, e.target.value)}>
                                      <option value="">—</option>
                                      {(c.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                  ) : (
                                    <input
                                      type={c.type === 'number' || c.type === 'money' ? 'number' : c.type === 'date' ? 'date' : c.type === 'time' ? 'time' : c.type === 'datetime' ? 'datetime-local' : 'text'}
                                      value={row[c.key] || ''} className={inputCls} style={inputStyle}
                                      onChange={e => setCell(f.key, ri, c.key, e.target.value)} />
                                  )}
                                </td>
                              ))}
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                <button type="button" onClick={() => removeRow(f.key, ri)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e54d4d', fontSize: '12px' }}>移除</button>
                              </td>
                            </tr>
                          ))}
                          {(f.itemColumns || []).some(c => c.sum) && rowsOf(f.key).length > 0 && (
                            <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface-2)' }}>
                              {(f.itemColumns || []).map((c, ci) => (
                                <td key={c.key} className="label-mono" style={{ padding: '8px 10px', fontWeight: 600 }}>
                                  {ci === 0 ? '總計' : c.sum ? rowsOf(f.key).reduce((s, r) => s + (Number(r[c.key]) || 0), 0).toLocaleString() : ''}
                                </td>
                              ))}
                              <td />
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
                      <button type="button" onClick={() => addRow(f.key)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 12px', fontSize: '12px', cursor: 'pointer', color: 'var(--text)' }}>+ 新增明細</button>
                    </div>
                  </div>
                ) : (
                  <input
                    type={f.type === 'number' || f.type === 'money' ? 'number' : f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : 'text'}
                    required={f.required} placeholder={f.placeholder} value={sv(f.key)} className={inputCls} style={inputStyle}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}
            {errMsg && <div style={{ color: 'var(--danger)', fontSize: '13px', background: 'var(--danger-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>{errMsg}</div>}
            <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
              <button type="submit" disabled={submitting || savingDraft || !!uploading}
                style={{ background: 'var(--primary)', color: '#fff', fontSize: '13px', padding: '8px 24px', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}>
                {submitting ? '送出中…' : '送出申請'}
              </button>
              {mod.kind === 'request' && (
                <button type="button" onClick={() => persist('draft')} disabled={submitting || savingDraft || !!uploading}
                  style={{ fontSize: '13px', padding: '8px 20px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', opacity: savingDraft ? 0.5 : 1 }}>
                  {savingDraft ? '儲存中…' : '儲存草稿'}
                </button>
              )}
              <button type="button" onClick={closeForm}
                style={{ fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>取消</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 600, color: 'var(--text)', fontSize: '14px', margin: 0 }}>
            {mod.kind === 'request' ? '我的申請記錄' : '記錄清單'}
          </h3>
        </div>
        {loading && <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-faint)' }}>載入中…</div>}
        {!loading && items.length === 0 && <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-faint)' }}>尚無資料</div>}
        {!loading && items.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', minWidth: '480px' }}>
              <thead style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  {mod.columns?.map(c => (
                    <th key={c.key} className="label-mono" style={{ padding: '10px 16px', textAlign: 'left' }}>{c.label}</th>
                  ))}
                  <th className="label-mono" style={{ padding: '10px 16px', textAlign: 'left' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={String(item.id ?? idx)} style={{ borderBottom: '1px solid var(--border)' }}>
                    {mod.columns?.map(c => {
                      const val = item[c.key]
                      const display = c.key === 'status'
                        ? <span className={`chip chip--${String(val)}`}>{STATUS_MAP[String(val)] || String(val ?? '—')}</span>
                        : c.type === 'date' && val ? new Date(String(val)).toLocaleDateString('zh-TW') : String(val ?? '—')
                      return <td key={c.key} style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{display}</td>
                    })}
                    <td style={{ padding: '10px 16px' }}>
                      {mod.kind === 'request' && (
                        String(item.status) === 'draft'
                          ? <button type="button" onClick={() => loadDraft(Number(item.id))} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontSize: '12px', cursor: 'pointer' }}>編輯</button>
                          : <Link href={`/request/${String(item.id)}`} style={{ color: 'var(--primary)', fontSize: '12px', textDecoration: 'none' }}>詳情</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
