'use client'
import { useEffect, useState } from 'react'
import type { SessionUser } from '@/lib/types'
import type { ChainStep } from '@/lib/chains'

// ─── Types ──────────────────────────────────────────────────────────────────

interface WorkflowTemplate {
  id: number
  chain_code: string
  name: string
  module_code: string | null
  amount_field: string
  steps_json: ChainStep[]
  is_active: boolean
  created_at: string
}

interface Role {
  id: number
  code: string
  name: string
}

// ─── Styles (shared with other admin views) ─────────────────────────────────

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: '13px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

const btnPrimary: React.CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius)',
  padding: '7px 14px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '7px 14px',
  fontSize: '13px',
  cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--danger, #e53e3e)',
  border: '1px solid var(--danger, #e53e3e)',
  borderRadius: 'var(--radius)',
  padding: '5px 10px',
  fontSize: '12px',
  cursor: 'pointer',
}

const label: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: '4px',
  textTransform: 'uppercase' as const,
}

const RESOLVER_LABELS: Record<string, string> = {
  direct_manager: '直屬主管',
  department_manager: '部門主管',
  role: '指定角色',
  specific_user: '指定人員',
}

const OP_LABELS: Record<string, string> = {
  '>': '>',
  '>=': '≥',
  '<': '<',
  '<=': '≤',
  '==': '=',
}

const REQUIRED_LABELS: Record<string, string> = {
  all: '全簽（all）',
  any: '任一（any）',
}

function emptyStep(step_no: number): ChainStep {
  return {
    step_no,
    name: `第 ${Math.floor(step_no / 10)} 關`,
    type: 'serial',
    approver: { resolver: 'direct_manager' },
    required: 'all',
  }
}

// ─── StepCard ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  total,
  roles,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  step: ChainStep
  index: number
  total: number
  roles: Role[]
  onChange: (s: ChainStep) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const isParallel = step.type === 'parallel'
  const resolver = isParallel
    ? (step.approvers?.[0]?.resolver ?? 'role')
    : (step.approver?.resolver ?? 'direct_manager')

  function setResolver(r: string) {
    if (isParallel) {
      onChange({ ...step, approvers: [{ resolver: r }] })
    } else {
      onChange({ ...step, approver: { resolver: r } })
    }
  }

  function setRoleCode(code: string) {
    if (isParallel) {
      onChange({
        ...step,
        approvers: (step.approvers || []).map(a => ({ ...a, role_code: code || undefined })),
      })
    } else {
      onChange({
        ...step,
        approver: { ...(step.approver ?? { resolver: 'role' }), role_code: code || undefined },
      })
    }
  }

  const roleCode = isParallel
    ? (step.approvers?.[0]?.role_code ?? '')
    : (step.approver?.role_code ?? '')

  const hasCondition = !!step.condition
  const cond = step.condition ?? { field: 'amount', op: '>', value: 0 }

  return (
    <div style={{ ...card, padding: '16px', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="label-mono"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '2px 8px',
              fontSize: '11px',
              color: 'var(--text-faint)',
            }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <input
            style={{ ...inputStyle, fontWeight: 600, maxWidth: '200px' }}
            value={step.name}
            onChange={e => onChange({ ...step, name: e.target.value })}
            placeholder="關卡名稱"
          />
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            style={{ ...btnSecondary, padding: '4px 8px', opacity: index === 0 ? 0.3 : 1 }}
            title="上移"
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            style={{ ...btnSecondary, padding: '4px 8px', opacity: index === total - 1 ? 0.3 : 1 }}
            title="下移"
          >
            ↓
          </button>
          <button onClick={onDelete} style={btnDanger}>刪除</button>
        </div>
      </div>

      {/* Body — 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* 類型 */}
        <div>
          <span style={label}>類型</span>
          <select
            style={selectStyle}
            value={step.type}
            onChange={e => {
              const t = e.target.value as 'serial' | 'parallel'
              if (t === 'parallel') {
                onChange({
                  ...step,
                  type: 'parallel',
                  approver: undefined,
                  approvers: [{ resolver: resolver }],
                })
              } else {
                onChange({
                  ...step,
                  type: 'serial',
                  approvers: undefined,
                  approver: { resolver: resolver },
                })
              }
            }}
          >
            <option value="serial">序簽（serial）</option>
            <option value="parallel">並簽（parallel）</option>
          </select>
        </div>

        {/* Required */}
        <div>
          <span style={label}>通過條件</span>
          <select
            style={selectStyle}
            value={step.required}
            onChange={e => onChange({ ...step, required: e.target.value as 'all' | 'any' })}
          >
            {Object.entries(REQUIRED_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {/* Approver resolver */}
        <div>
          <span style={label}>簽核人</span>
          <select
            style={selectStyle}
            value={resolver}
            onChange={e => setResolver(e.target.value)}
          >
            {Object.entries(RESOLVER_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {/* Role code (conditional) */}
        {resolver === 'role' && (
          <div>
            <span style={label}>角色</span>
            <select
              style={selectStyle}
              value={roleCode}
              onChange={e => setRoleCode(e.target.value)}
            >
              <option value="">— 選擇角色 —</option>
              {roles.map(r => (
                <option key={r.code} value={r.code}>{r.name}（{r.code}）</option>
              ))}
            </select>
          </div>
        )}

        {/* SLA */}
        <div>
          <span style={label}>SLA 時數（sla_hours）</span>
          <input
            style={inputStyle}
            type="number"
            min={0}
            value={step.sla_hours ?? ''}
            placeholder="不限"
            onChange={e => onChange({ ...step, sla_hours: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      </div>

      {/* Condition toggle */}
      <div style={{ marginTop: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={hasCondition}
            onChange={e => {
              if (e.target.checked) {
                onChange({ ...step, condition: { field: 'amount', op: '>', value: 0 } })
              } else {
                onChange({ ...step, condition: undefined })
              }
            }}
          />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>設定條件（滿足才觸發此關）</span>
        </label>

        {hasCondition && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              style={{ ...inputStyle, width: '120px' }}
              value={cond.field}
              placeholder="欄位（如 amount）"
              onChange={e => onChange({ ...step, condition: { ...cond, field: e.target.value } })}
            />
            <select
              style={{ ...selectStyle, width: '80px' }}
              value={cond.op}
              onChange={e => onChange({ ...step, condition: { ...cond, op: e.target.value } })}
            >
              {Object.entries(OP_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input
              style={{ ...inputStyle, width: '120px' }}
              type="number"
              value={cond.value}
              onChange={e => onChange({ ...step, condition: { ...cond, value: Number(e.target.value) } })}
            />
            <span
              style={{
                fontSize: '11px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '4px 10px',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {cond.field} {OP_LABELS[cond.op] || cond.op} {cond.value}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── NewWorkflowModal ────────────────────────────────────────────────────────

function NewWorkflowModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (t: WorkflowTemplate) => void
}) {
  const [form, setForm] = useState({ chain_code: '', name: '', module_code: '', amount_field: 'amount' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!form.chain_code.trim()) { setErr('chain_code 為必填'); return }
    if (!form.name.trim()) { setErr('流程名稱為必填'); return }
    setSaving(true)
    const res = await fetch('/api/admin/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, steps_json: [] }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setErr(data.error || '建立失敗'); return }
    onCreated(data.template)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleCreate}
        style={{ ...card, padding: '24px', width: '440px', maxWidth: '95vw' }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 18px' }}>新增簽核流程</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <span style={label}>流程代碼 (chain_code)</span>
            <input
              style={inputStyle}
              value={form.chain_code}
              onChange={e => setForm(p => ({ ...p, chain_code: e.target.value }))}
              placeholder="例: expense_custom"
              autoFocus
            />
          </div>
          <div>
            <span style={label}>流程名稱</span>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="例: 費用報銷流程"
            />
          </div>
          <div>
            <span style={label}>模組代碼 (module_code，選填)</span>
            <input
              style={inputStyle}
              value={form.module_code}
              onChange={e => setForm(p => ({ ...p, module_code: e.target.value }))}
              placeholder="例: expense"
            />
          </div>
          <div>
            <span style={label}>金額欄位 (amount_field)</span>
            <input
              style={inputStyle}
              value={form.amount_field}
              onChange={e => setForm(p => ({ ...p, amount_field: e.target.value }))}
              placeholder="amount"
            />
          </div>
        </div>

        {err && (
          <div style={{ fontSize: '12px', color: 'var(--danger, #e53e3e)', marginTop: '10px' }}>{err}</div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '18px' }}>
          <button type="button" onClick={onClose} style={btnSecondary}>取消</button>
          <button type="submit" style={btnPrimary} disabled={saving}>
            {saving ? '建立中…' : '建立流程'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function WorkflowDesignerView({ user: _user }: { user: SessionUser }) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<WorkflowTemplate | null>(null)
  const [steps, setSteps] = useState<ChainStep[]>([])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [fetchErr, setFetchErr] = useState('')

  useEffect(() => {
    fetch('/api/admin/workflows')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => {
        setTemplates(d.templates ?? [])
        setRoles(d.roles ?? [])
        setLoading(false)
      })
      .catch(() => { setFetchErr('載入失敗，請重新整理'); setLoading(false) })
  }, [])

  function selectTemplate(t: WorkflowTemplate) {
    setSelected(t)
    setSteps((t.steps_json ?? []).map((s, i) => ({ ...s, step_no: s.step_no ?? (i + 1) * 10 })))
    setSaveMsg('')
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setSaveMsg('')

    // Re-number step_no in multiples of 10
    const normalized = steps.map((s, i) => ({ ...s, step_no: (i + 1) * 10 }))

    const res = await fetch('/api/admin/workflows', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, steps_json: normalized }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setSaveMsg('儲存失敗：' + (data.error || '')); return }
    // Update local state
    setTemplates(prev => prev.map(t => t.id === selected.id ? { ...t, steps_json: normalized } : t))
    setSelected(prev => prev ? { ...prev, steps_json: normalized } : prev)
    setSteps(normalized)
    setSaveMsg('已儲存')
    setTimeout(() => setSaveMsg(''), 2500)
  }

  async function handleToggleActive(t: WorkflowTemplate) {
    const res = await fetch('/api/admin/workflows', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, is_active: !t.is_active }),
    })
    if (!res.ok) return
    const data = await res.json()
    setTemplates(prev => prev.map(x => x.id === t.id ? data.template : x))
    if (selected?.id === t.id) setSelected(data.template)
  }

  async function handleDelete(t: WorkflowTemplate) {
    if (!confirm(`確定要刪除「${t.name}」嗎？`)) return
    const res = await fetch(`/api/admin/workflows?id=${t.id}`, { method: 'DELETE' })
    if (!res.ok) return
    setTemplates(prev => prev.filter(x => x.id !== t.id))
    if (selected?.id === t.id) { setSelected(null); setSteps([]) }
  }

  function addStep() {
    const maxNo = steps.reduce((m, s) => Math.max(m, s.step_no), 0)
    setSteps(prev => [...prev, emptyStep(maxNo + 10)])
  }

  function updateStep(index: number, s: ChainStep) {
    setSteps(prev => prev.map((x, i) => i === index ? s : x))
  }

  function deleteStep(index: number) {
    setSteps(prev => prev.filter((_, i) => i !== index))
  }

  function moveStep(index: number, dir: -1 | 1) {
    const next = index + dir
    if (next < 0 || next >= steps.length) return
    setSteps(prev => {
      const arr = [...prev]
      ;[arr[index], arr[next]] = [arr[next], arr[index]]
      return arr
    })
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
    letterSpacing: '-0.01em',
  }

  return (
    <>
      <style>{`
        .wf-pane { min-width: 0; }
        .wf-list-item:hover { border-color: var(--primary) !important; }
        .wf-list-item.active { border-color: var(--primary) !important; background: var(--surface-2) !important; }
        @media (max-width: 768px) {
          .wf-layout { flex-direction: column !important; }
          .wf-left { width: 100% !important; border-right: none !important; border-bottom: 1px solid var(--border); }
        }
      `}</style>

      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ ...sectionTitle, fontSize: '15px' }}>簽核流程設計器</h2>
            <span className="label-mono" style={{ display: 'block', marginTop: '4px' }}>Workflow Designer</span>
          </div>
        </div>

        {fetchErr && (
          <div style={{ ...card, padding: '14px 16px', color: 'var(--danger, #e53e3e)', fontSize: '13px', marginBottom: '16px' }}>{fetchErr}</div>
        )}

        <div className="wf-layout" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          {/* ── Left Panel: flow list ── */}
          <div className="wf-left" style={{ width: '280px', flexShrink: 0, ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ ...sectionTitle }}>流程清單</span>
              <button onClick={() => setShowNew(true)} style={{ ...btnPrimary, padding: '5px 10px', fontSize: '12px' }}>
                + 新增
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {loading && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>載入中…</div>
              )}
              {!loading && templates.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>尚無流程，點擊「新增」建立</div>
              )}
              {templates.map(t => (
                <div
                  key={t.id}
                  className={`wf-list-item${selected?.id === t.id ? ' active' : ''}`}
                  onClick={() => selectTemplate(t)}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '10px 12px',
                    marginBottom: '6px',
                    cursor: 'pointer',
                    background: 'var(--surface)',
                    transition: 'border-color .15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>
                      {t.name}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '999px',
                        background: t.is_active ? 'rgba(72,187,120,0.15)' : 'var(--surface-2)',
                        color: t.is_active ? '#276749' : 'var(--text-faint)',
                        border: `1px solid ${t.is_active ? '#9ae6b4' : 'var(--border)'}`,
                        flexShrink: 0,
                        cursor: 'pointer',
                      }}
                      onClick={e => { e.stopPropagation(); handleToggleActive(t) }}
                      title="點擊切換啟用狀態"
                    >
                      {t.is_active ? '啟用' : '停用'}
                    </span>
                  </div>
                  <div className="label-mono" style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
                    {t.chain_code}
                  </div>
                  {t.module_code && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>模組: {t.module_code}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{(t.steps_json ?? []).length} 個關卡</span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(t) }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '11px', padding: '2px 4px' }}
                      title="刪除流程"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right Panel: step editor ── */}
          <div className="wf-pane" style={{ flex: 1, ...card, display: 'flex', flexDirection: 'column', minWidth: 0, alignSelf: 'stretch', minHeight: '420px' }}>
            {!selected ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>
                ← 從左側選擇一個流程開始編輯
              </div>
            ) : (
              <>
                {/* Right header */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={sectionTitle}>{selected.name}</span>
                    <span className="label-mono" style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--text-faint)' }}>{selected.chain_code}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {saveMsg && (
                      <span style={{ fontSize: '12px', color: saveMsg.startsWith('儲存失敗') ? 'var(--danger, #e53e3e)' : '#48bb78', fontWeight: 600 }}>
                        {saveMsg}
                      </span>
                    )}
                    <button onClick={addStep} style={btnSecondary}>+ 新增關卡</button>
                    <button onClick={handleSave} style={btnPrimary} disabled={saving}>
                      {saving ? '儲存中…' : '儲存'}
                    </button>
                  </div>
                </div>

                {/* Steps list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                  {steps.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px', padding: '40px 0' }}>
                      尚無關卡，點擊「新增關卡」開始建立簽核流程
                    </div>
                  )}

                  {steps.map((s, i) => (
                    <div key={i}>
                      <StepCard
                        step={s}
                        index={i}
                        total={steps.length}
                        roles={roles}
                        onChange={updated => updateStep(i, updated)}
                        onDelete={() => deleteStep(i)}
                        onMoveUp={() => moveStep(i, -1)}
                        onMoveDown={() => moveStep(i, 1)}
                      />

                      {/* Arrow between steps */}
                      {i < steps.length - 1 && (
                        <div style={{ textAlign: 'center', padding: '6px 0', color: 'var(--text-faint)', fontSize: '18px', userSelect: 'none' }}>
                          ↓
                        </div>
                      )}
                    </div>
                  ))}

                  {steps.length > 0 && (
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                      <button onClick={addStep} style={{ ...btnSecondary, fontSize: '12px' }}>
                        + 新增關卡
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showNew && (
        <NewWorkflowModal
          onClose={() => setShowNew(false)}
          onCreated={t => {
            setTemplates(prev => [...prev, t])
            setShowNew(false)
            selectTemplate(t)
          }}
        />
      )}
    </>
  )
}
