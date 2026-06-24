'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import type { SessionUser } from '@/lib/types'
import { isAdminRole } from '@/lib/rbac'

interface Department {
  id: number
  code: string | null
  name: string
  parent_id: number | null
  manager_user_id: number | null
  manager_name: string | null
  sort_order: number
  status: string
  cost_center: string | null
  member_count: number
}

interface UserOption {
  id: number
  display_name: string
  employee_no: string | null
}

interface Member {
  id: number
  employee_no: string | null
  display_name: string
  status: string
  position_title: string | null
  is_manager: boolean
}

// 每個部門展開時的成員載入狀態
interface MemberState {
  loading: boolean
  error: string | null
  members: Member[] | null
}

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 'var(--radius)',
  padding: '7px 10px',
  fontSize: '13px',
  width: '100%',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--text-muted)',
  marginBottom: '5px',
}

const primaryBtn: React.CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius)',
  padding: '8px 14px',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '13px',
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '7px 12px',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '13px',
}

function buildTree(depts: Department[]): Array<Department & { children: Department[] }> {
  const map = new Map<number, Department & { children: Department[] }>()
  for (const d of depts) map.set(d.id, { ...d, children: [] })
  const roots: Array<Department & { children: Department[] }> = []
  for (const d of depts) {
    const node = map.get(d.id)!
    if (d.parent_id && map.has(d.parent_id)) {
      map.get(d.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

function MemberPanel({ state, depth }: { state: MemberState | undefined; depth: number }) {
  const indent = 16 + depth * 24 + 20
  if (!state || state.loading) {
    return <div style={{ padding: `10px 16px 10px ${indent}px`, color: 'var(--text-faint)', fontSize: '12px' }}>載入成員中…</div>
  }
  if (state.error) {
    return <div style={{ padding: `10px 16px 10px ${indent}px`, color: 'var(--danger, #e53e3e)', fontSize: '12px' }}>{state.error}</div>
  }
  const members = state.members ?? []
  if (members.length === 0) {
    return <div style={{ padding: `10px 16px 10px ${indent}px`, color: 'var(--text-faint)', fontSize: '12px' }}>此部門目前沒有在職成員</div>
  }
  return (
    <div style={{ padding: `8px 16px 12px ${indent}px`, display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {members.map(m => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0', fontSize: '12px' }}>
          <Link href={`/directory/${m.id}`} style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }} title="查看通訊錄個人頁">{m.display_name}</Link>
          {m.employee_no && <span className="label-mono" style={{ color: 'var(--text-faint)' }}>{m.employee_no}</span>}
          {m.position_title && <span style={{ color: 'var(--text-muted)' }}>{m.position_title}</span>}
          {m.is_manager && (
            <span style={{ fontSize: '11px', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 'var(--radius)', padding: '0 6px', lineHeight: '16px' }}>主管</span>
          )}
        </div>
      ))}
    </div>
  )
}

function DeptRow({
  dept,
  depth,
  allDepts,
  expanded,
  memberState,
  canManage,
  colCount,
  onToggle,
  onEdit,
  onDelete,
}: {
  dept: Department & { children: Department[] }
  depth: number
  allDepts: Department[]
  expanded: Set<number>
  memberState: Record<number, MemberState>
  canManage: boolean
  colCount: number
  onToggle: (d: Department) => void
  onEdit: (d: Department) => void
  onDelete: (d: Department) => void
}) {
  const isExpanded = expanded.has(dept.id)
  return (
    <>
      <tr style={{ borderTop: '1px solid var(--border)' }}>
        <td style={{ padding: '10px 16px', paddingLeft: `${16 + depth * 24}px`, color: 'var(--text)', fontWeight: depth === 0 ? 600 : 400 }}>
          {depth > 0 && <span style={{ color: 'var(--text-faint)', marginRight: '6px' }}>└</span>}
          <button
            onClick={() => onToggle(dept)}
            aria-expanded={isExpanded}
            title="展開成員"
            style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', color: 'inherit', font: 'inherit', fontWeight: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span style={{ color: 'var(--text-faint)', fontSize: '10px', display: 'inline-block', width: '10px', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s' }}>▶</span>
            {dept.name}
          </button>
          {dept.code && <span className="label-mono" style={{ marginLeft: '8px', color: 'var(--text-faint)' }}>{dept.code}</span>}
        </td>
        <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
          {dept.manager_name ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}
        </td>
        <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
          {dept.member_count}
        </td>
        <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
          {dept.cost_center ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}
        </td>
        {canManage && (
          <td style={{ padding: '10px 16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => onEdit(dept)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: '12px' }}>編輯</button>
              <button onClick={() => onDelete(dept)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: '12px', color: 'var(--danger, #e53e3e)', borderColor: 'var(--danger, #e53e3e)' }}>刪除</button>
            </div>
          </td>
        )}
      </tr>
      {isExpanded && (
        <tr style={{ background: 'var(--surface-2)' }}>
          <td colSpan={colCount} style={{ padding: 0 }}>
            <MemberPanel state={memberState[dept.id]} depth={depth} />
          </td>
        </tr>
      )}
      {dept.children.map(child => (
        <DeptRow key={child.id} dept={child as Department & { children: Department[] }} depth={depth + 1} allDepts={allDepts} expanded={expanded} memberState={memberState} canManage={canManage} colCount={colCount} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </>
  )
}

interface ModalForm {
  name: string
  code: string
  parent_id: string
  manager_user_id: string
  sort_order: string
  cost_center: string
}

const emptyForm = (): ModalForm => ({ name: '', code: '', parent_id: '', manager_user_id: '', sort_order: '0', cost_center: '' })

export default function OrgView({ user }: { user: SessionUser }) {
  // 有 admin 寫入權限才顯示新增/編輯/刪除（與後端 org 寫入守衛同一判斷）。
  // 無權限者仍可正常檢視部門與成員（read-only）。
  const canManage = isAdminRole(user.roleCode)
  const [depts, setDepts] = useState<Department[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Department | null>(null)
  const [form, setForm] = useState<ModalForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [modalErr, setModalErr] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [memberState, setMemberState] = useState<Record<number, MemberState>>({})
  const mountedRef = useRef(true)

  const fetchDepts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/org', { signal })
      const d = await r.json()
      if (!mountedRef.current) return
      if (!r.ok) throw new Error(d.error)
      setDepts(d.departments ?? [])
      setErrMsg('')
    } catch (e: unknown) {
      if (!mountedRef.current) return
      if (e instanceof DOMException && e.name === 'AbortError') return
      setErrMsg(e instanceof Error ? e.message : '載入失敗')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async (signal?: AbortSignal) => {
    try {
      const r = await fetch('/api/admin/employees', { signal })
      const d = await r.json()
      if (!mountedRef.current) return
      setUsers((d.employees ?? []).map((u: { id: number; display_name: string; employee_no: string | null }) => ({ id: u.id, display_name: u.display_name, employee_no: u.employee_no })))
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      /* other errors silently ignored for user list */
    }
  }, [])

  const fetchMembers = useCallback(async (deptId: number) => {
    setMemberState(s => ({ ...s, [deptId]: { loading: true, error: null, members: s[deptId]?.members ?? null } }))
    try {
      const r = await fetch(`/api/admin/org/${deptId}/members`)
      const d = await r.json()
      if (!mountedRef.current) return
      if (!r.ok) throw new Error(d.error || '載入成員失敗')
      setMemberState(s => ({ ...s, [deptId]: { loading: false, error: null, members: d.members ?? [] } }))
    } catch (e: unknown) {
      if (!mountedRef.current) return
      setMemberState(s => ({ ...s, [deptId]: { loading: false, error: e instanceof Error ? e.message : '載入成員失敗', members: null } }))
    }
  }, [])

  const toggleExpand = useCallback((d: Department) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(d.id)) {
        next.delete(d.id)
      } else {
        next.add(d.id)
        // lazy fetch：只在首次展開且尚無資料時抓
        setMemberState(s => {
          if (!s[d.id]?.members && !s[d.id]?.loading) fetchMembers(d.id)
          return s
        })
      }
      return next
    })
  }, [fetchMembers])

  useEffect(() => {
    mountedRef.current = true
    const ac = new AbortController()
    fetchDepts(ac.signal)
    // 員工清單僅供新增/編輯 modal 的主管下拉用 → 無管理權限不需抓（且該端點會擋）
    if (canManage) fetchUsers(ac.signal)
    return () => { mountedRef.current = false; ac.abort() }
  }, [fetchDepts, fetchUsers, canManage])

  function openAdd() {
    setEditTarget(null)
    setForm(emptyForm())
    setModalErr('')
    setModalOpen(true)
  }

  function openEdit(d: Department) {
    setEditTarget(d)
    setForm({
      name: d.name,
      code: d.code ?? '',
      parent_id: d.parent_id != null ? String(d.parent_id) : '',
      manager_user_id: d.manager_user_id != null ? String(d.manager_user_id) : '',
      sort_order: String(d.sort_order ?? 0),
      cost_center: d.cost_center ?? '',
    })
    setModalErr('')
    setModalOpen(true)
  }

  async function handleDelete(d: Department) {
    if (!confirm(`確定要刪除「${d.name}」？`)) return
    try {
      const r = await fetch(`/api/admin/org?id=${d.id}`, { method: 'DELETE' })
      const data = await r.json()
      if (!r.ok) { alert(data.error || '刪除失敗'); return }
      setExpanded(prev => { const next = new Set(prev); next.delete(d.id); return next })
      setMemberState(s => { const next = { ...s }; delete next[d.id]; return next })
      fetchDepts()
    } catch {
      alert('網路錯誤，請重試')
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { setModalErr('部門名稱為必填'); return }
    setSaving(true); setModalErr('')
    try {
      const payload = {
        ...(editTarget ? { id: editTarget.id } : {}),
        name: form.name.trim(),
        code: form.code.trim() || null,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        manager_user_id: form.manager_user_id ? Number(form.manager_user_id) : null,
        sort_order: Number(form.sort_order) || 0,
        cost_center: form.cost_center.trim() || null,
      }
      const r = await fetch('/api/admin/org', {
        method: editTarget ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok) { setModalErr(d.error || '儲存失敗'); return }
      setModalOpen(false)
      fetchDepts()
      // 主管/部門可能變動，重抓目前展開中的成員（is_manager 標記會變）
      expanded.forEach(id => fetchMembers(id))
    } catch {
      setModalErr('網路錯誤，請重試')
    } finally {
      setSaving(false)
    }
  }

  const tree = buildTree(depts)
  const columns = canManage ? ['部門名稱', '主管', '人數', '成本中心', '操作'] : ['部門名稱', '主管', '人數', '成本中心']
  const colCount = columns.length

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>組織架構</h1>
          <span className="label-mono" style={{ display: 'block', marginTop: '4px' }}>DEPARTMENTS</span>
        </div>
        {canManage && <button onClick={openAdd} style={primaryBtn}>+ 新增部門</button>}
      </div>

      {errMsg && (
        <div style={{ ...card, padding: '12px 16px', color: 'var(--danger, #e53e3e)', fontSize: '13px', marginBottom: '16px' }}>{errMsg}</div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ minWidth: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {columns.map(h => (
                  <th key={h} className="label-mono" style={{ padding: '9px 16px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={colCount} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-faint)' }}>載入中…</td></tr>
              )}
              {!loading && depts.length === 0 && (
                <tr><td colSpan={colCount} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-faint)' }}>尚無部門資料</td></tr>
              )}
              {!loading && tree.map(d => (
                <DeptRow key={d.id} dept={d} depth={0} allDepts={depts} expanded={expanded} memberState={memberState} canManage={canManage} colCount={colCount} onToggle={toggleExpand} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ ...card, padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px' }}>
              {editTarget ? '編輯部門' : '新增部門'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>部門名稱 <span style={{ color: 'var(--danger, #e53e3e)' }}>*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="例：工程部" />
              </div>
              <div>
                <label style={labelStyle}>部門代碼</label>
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} style={inputStyle} placeholder="例：ENG" />
              </div>
              <div>
                <label style={labelStyle}>上層部門</label>
                <select value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))} style={inputStyle}>
                  <option value="">（無，頂層部門）</option>
                  {depts.filter(d => !editTarget || d.id !== editTarget.id).map(d => (
                    <option key={d.id} value={String(d.id)}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>主管</label>
                <select value={form.manager_user_id} onChange={e => setForm(f => ({ ...f, manager_user_id: e.target.value }))} style={inputStyle}>
                  <option value="">（未設定）</option>
                  {users.map(u => (
                    <option key={u.id} value={String(u.id)}>{u.display_name}{u.employee_no ? ` (${u.employee_no})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>排序</label>
                <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>成本中心</label>
                <input value={form.cost_center} onChange={e => setForm(f => ({ ...f, cost_center: e.target.value }))} style={inputStyle} placeholder="例：CC-001" />
              </div>
            </div>
            {modalErr && (
              <div style={{ marginTop: '12px', color: 'var(--danger, #e53e3e)', fontSize: '13px', background: 'rgba(229,62,62,0.08)', padding: '8px 12px', borderRadius: 'var(--radius)' }}>{modalErr}</div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>{saving ? '儲存中…' : '儲存'}</button>
              <button onClick={() => setModalOpen(false)} style={ghostBtn}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
