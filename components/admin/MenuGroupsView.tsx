'use client'
import { useEffect, useState } from 'react'
import { SessionUser } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MenuGroup {
  id: number
  company_id: number
  code: string
  name: string
  sort_order: number
  is_system: boolean
  created_at: string
  updated_at: string
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: '13px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
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

const sectionTitle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 700,
  color: 'var(--text)',
  margin: 0,
  letterSpacing: '-0.01em',
}

// ─── AddGroupModal ────────────────────────────────────────────────────────────

function AddGroupModal({
  onClose,
  onCreated,
  nextSortOrder,
}: {
  onClose: () => void
  onCreated: (g: MenuGroup) => void
  nextSortOrder: number
}) {
  const [form, setForm] = useState({ code: '', name: '', sort_order: nextSortOrder })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!form.code.trim()) { setErr('代碼為必填'); return }
    if (!form.name.trim()) { setErr('名稱為必填'); return }
    setSaving(true)
    const res = await fetch('/api/admin/menu-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setErr(data.error || '建立失敗'); return }
    onCreated(data.group)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleCreate}
        style={{ ...card, padding: '24px', width: '400px', maxWidth: '95vw' }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 18px' }}>新增選單群組</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <span style={label}>群組代碼 (code)</span>
            <input
              style={inputStyle}
              value={form.code}
              onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
              placeholder="例: finance"
              autoFocus
            />
          </div>
          <div>
            <span style={label}>群組名稱</span>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="例: 財務管理"
            />
          </div>
          <div>
            <span style={label}>排序</span>
            <input
              style={inputStyle}
              type="number"
              value={form.sort_order}
              onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
            />
          </div>
        </div>

        {err && (
          <div style={{ fontSize: '12px', color: 'var(--danger, #e53e3e)', marginTop: '10px' }}>{err}</div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '18px' }}>
          <button type="button" onClick={onClose} style={btnSecondary}>取消</button>
          <button type="submit" style={btnPrimary} disabled={saving}>
            {saving ? '建立中…' : '建立'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── EditGroupModal ───────────────────────────────────────────────────────────

function EditGroupModal({
  group,
  onClose,
  onSaved,
}: {
  group: MenuGroup
  onClose: () => void
  onSaved: (g: MenuGroup) => void
}) {
  const [form, setForm] = useState({ name: group.name, sort_order: group.sort_order })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!form.name.trim()) { setErr('名稱為必填'); return }
    setSaving(true)
    const res = await fetch('/api/admin/menu-groups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: group.id, name: form.name, sort_order: form.sort_order }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setErr(data.error || '儲存失敗'); return }
    onSaved(data.group)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSave}
        style={{ ...card, padding: '24px', width: '400px', maxWidth: '95vw' }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 18px' }}>
          編輯群組
          <span className="label-mono" style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-faint)', fontWeight: 400 }}>{group.code}</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <span style={label}>群組名稱</span>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <span style={label}>排序</span>
            <input
              style={inputStyle}
              type="number"
              value={form.sort_order}
              onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
            />
          </div>
        </div>

        {err && (
          <div style={{ fontSize: '12px', color: 'var(--danger, #e53e3e)', marginTop: '10px' }}>{err}</div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '18px' }}>
          <button type="button" onClick={onClose} style={btnSecondary}>取消</button>
          <button type="submit" style={btnPrimary} disabled={saving}>
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MenuGroupsView({ user: _user }: { user: SessionUser }) {
  const [groups, setGroups] = useState<MenuGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchErr, setFetchErr] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<MenuGroup | null>(null)
  const [actionErr, setActionErr] = useState('')

  async function loadGroups() {
    setLoading(true)
    setFetchErr('')
    try {
      const res = await fetch('/api/admin/menu-groups')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setGroups(data.groups ?? [])
    } catch {
      setFetchErr('載入失敗，請重新整理')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadGroups() }, [])

  async function handleDelete(g: MenuGroup) {
    if (!confirm(`確定要刪除「${g.name}」嗎？`)) return
    setActionErr('')
    const res = await fetch(`/api/admin/menu-groups?id=${g.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { setActionErr(data.error || '刪除失敗'); return }
    setGroups(prev => prev.filter(x => x.id !== g.id))
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return
    await swapSortOrder(index, index - 1)
  }

  async function handleMoveDown(index: number) {
    if (index === groups.length - 1) return
    await swapSortOrder(index, index + 1)
  }

  async function swapSortOrder(i: number, j: number) {
    setActionErr('')
    const a = groups[i]
    const b = groups[j]

    // PUT 兩筆交換 sort_order
    const [resA, resB] = await Promise.all([
      fetch('/api/admin/menu-groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, sort_order: b.sort_order }),
      }),
      fetch('/api/admin/menu-groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id, sort_order: a.sort_order }),
      }),
    ])

    if (!resA.ok || !resB.ok) {
      setActionErr('排序更新失敗')
      return
    }

    const [dataA, dataB] = await Promise.all([resA.json(), resB.json()])
    setGroups(prev => {
      const next = [...prev]
      next[i] = dataA.group
      next[j] = dataB.group
      // re-sort by sort_order
      return next.sort((x, y) => x.sort_order - y.sort_order)
    })
  }

  const nextSortOrder = groups.length > 0
    ? Math.max(...groups.map(g => g.sort_order)) + 10
    : 10

  return (
    <>
      <style>{`
        .mg-item:hover { border-color: var(--primary) !important; }
      `}</style>

      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={sectionTitle}>選單群組管理</h2>
            <span className="label-mono" style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--text-faint)' }}>Menu Groups</span>
          </div>
          <button style={btnPrimary} onClick={() => setShowAdd(true)}>+ 新增群組</button>
        </div>

        {fetchErr && (
          <div style={{ ...card, padding: '14px 16px', color: 'var(--danger, #e53e3e)', fontSize: '13px', marginBottom: '16px' }}>{fetchErr}</div>
        )}

        {actionErr && (
          <div style={{ ...card, padding: '14px 16px', color: 'var(--danger, #e53e3e)', fontSize: '13px', marginBottom: '16px' }}>{actionErr}</div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ ...card, padding: '32px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>載入中…</div>
        ) : groups.length === 0 ? (
          <div style={{ ...card, padding: '32px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>
            尚無群組，點擊「新增群組」建立
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {groups.map((g, i) => (
              <div
                key={g.id}
                className="mg-item"
                style={{
                  ...card,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'border-color .15s',
                }}
              >
                {/* Left: info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{g.name}</span>
                    {g.is_system && (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 7px',
                          borderRadius: '999px',
                          background: 'rgba(66,153,225,0.12)',
                          color: '#2b6cb0',
                          border: '1px solid #90cdf4',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        系統
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px', alignItems: 'center' }}>
                    <span className="label-mono" style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{g.code}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>排序 {g.sort_order}</span>
                  </div>
                </div>

                {/* Right: actions */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                  <button
                    onClick={() => handleMoveUp(i)}
                    disabled={i === 0}
                    style={{ ...btnSecondary, padding: '4px 8px', opacity: i === 0 ? 0.3 : 1 }}
                    title="上移"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveDown(i)}
                    disabled={i === groups.length - 1}
                    style={{ ...btnSecondary, padding: '4px 8px', opacity: i === groups.length - 1 ? 0.3 : 1 }}
                    title="下移"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => setEditTarget(g)}
                    style={{ ...btnSecondary, padding: '5px 10px', fontSize: '12px' }}
                  >
                    改名
                  </button>
                  {!g.is_system && (
                    <button onClick={() => handleDelete(g)} style={btnDanger}>刪除</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddGroupModal
          nextSortOrder={nextSortOrder}
          onClose={() => setShowAdd(false)}
          onCreated={g => {
            setGroups(prev => [...prev, g].sort((a, b) => a.sort_order - b.sort_order))
            setShowAdd(false)
          }}
        />
      )}

      {editTarget && (
        <EditGroupModal
          group={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={updated => {
            setGroups(prev =>
              prev.map(x => x.id === updated.id ? updated : x)
                .sort((a, b) => a.sort_order - b.sort_order)
            )
            setEditTarget(null)
          }}
        />
      )}
    </>
  )
}
