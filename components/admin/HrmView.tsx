'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import type { SessionUser } from '@/lib/types'
import { isAdminRole } from '@/lib/rbac'

interface Employee {
  id: number
  employee_no: string | null
  email: string
  display_name: string
  status: string
  department_id: number | null
  position_id: number | null
  primary_role_id: number | null
  manager_user_id: number | null
  manager_name: string | null
  hired_at: string | null
  resigned_at: string | null
  departments: { id: number; name: string } | null
  positions: { id: number; title: string; grade: string | null } | null
  roles: { id: number; name: string; code: string } | null
}

interface Department { id: number; name: string }
interface Position { id: number; title: string; grade: string | null }
interface Role { id: number; name: string; code: string }

const STATUS_LABEL: Record<string, string> = { active: '在職', inactive: '停用', resigned: '離職' }
const STATUS_COLOR: Record<string, string> = { active: '#22c55e', inactive: '#f59e0b', resigned: '#94a3b8' }

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

interface EmpForm {
  email: string
  display_name: string
  employee_no: string
  department_id: string
  position_id: string
  primary_role_id: string
  manager_user_id: string
  status: string
  hired_at: string
  resigned_at: string
}

const emptyEmpForm = (): EmpForm => ({
  email: '', display_name: '', employee_no: '', department_id: '', position_id: '',
  primary_role_id: '', manager_user_id: '', status: 'active', hired_at: '', resigned_at: '',
})

interface PosForm { code: string; title: string; grade: string; job_family: string; is_manager: boolean; status: string }
const emptyPosForm = (): PosForm => ({ code: '', title: '', grade: '', job_family: '', is_manager: false, status: 'active' })

export default function HrmView({ user }: { user: SessionUser }) {
  // 有 admin 寫入權限才顯示新增/編輯（與後端寫入守衛同一判斷）。
  // 稽核 auditor / 主管 manager 為唯讀（manager 的可見資料已由後端限縮成同部門）。
  const canManage = isAdminRole(user.roleCode)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [depts, setDepts] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loadingEmp, setLoadingEmp] = useState(true)
  const [loadingPos, setLoadingPos] = useState(true)
  const [errMsg, setErrMsg] = useState('')

  // Employee modal
  const [empModalOpen, setEmpModalOpen] = useState(false)
  const [editEmp, setEditEmp] = useState<Employee | null>(null)
  const [empForm, setEmpForm] = useState<EmpForm>(emptyEmpForm())
  const [savingEmp, setSavingEmp] = useState(false)
  const [empModalErr, setEmpModalErr] = useState('')

  // Position modal
  const [posModalOpen, setPosModalOpen] = useState(false)
  const [editPos, setEditPos] = useState<Position & { code?: string | null; job_family?: string | null; is_manager?: boolean; status?: string } | null>(null)
  const [posForm, setPosForm] = useState<PosForm>(emptyPosForm())
  const [savingPos, setSavingPos] = useState(false)
  const [posModalErr, setPosModalErr] = useState('')

  // Search / filter
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const mountedRef = useRef(true)

  const fetchEmployees = useCallback(async (signal?: AbortSignal) => {
    setLoadingEmp(true)
    try {
      const r = await fetch('/api/admin/employees', { signal })
      const d = await r.json()
      if (!mountedRef.current) return
      if (!r.ok) throw new Error(d.error)
      const emps: Employee[] = d.employees ?? []
      setEmployees(emps)
      // 從員工資料中提取角色清單（避免重複 fetch）
      const seen = new Set<number>()
      const roleList: Role[] = []
      for (const emp of emps) {
        if (emp.roles && !seen.has(emp.roles.id)) {
          seen.add(emp.roles.id)
          roleList.push(emp.roles)
        }
      }
      setRoles(roleList)
      setErrMsg('')
    } catch (e: unknown) {
      if (!mountedRef.current) return
      if (e instanceof DOMException && e.name === 'AbortError') return
      setErrMsg(e instanceof Error ? e.message : '員工資料載入失敗')
    } finally {
      if (mountedRef.current) setLoadingEmp(false)
    }
  }, [])

  const fetchDepts = useCallback(async (signal?: AbortSignal) => {
    try {
      const r = await fetch('/api/admin/org', { signal })
      const d = await r.json()
      if (!mountedRef.current) return
      setDepts((d.departments ?? []).map((dep: { id: number; name: string }) => ({ id: dep.id, name: dep.name })))
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      /* ignore other errors for dept list */
    }
  }, [])

  const fetchPositions = useCallback(async (signal?: AbortSignal) => {
    setLoadingPos(true)
    try {
      const r = await fetch('/api/admin/positions', { signal })
      const d = await r.json()
      if (!mountedRef.current) return
      setPositions(d.positions ?? [])
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      /* ignore */
    } finally {
      if (mountedRef.current) setLoadingPos(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const ac = new AbortController()
    fetchEmployees(ac.signal)
    fetchDepts(ac.signal)
    fetchPositions(ac.signal)
    return () => { mountedRef.current = false; ac.abort() }
  }, [fetchEmployees, fetchDepts, fetchPositions])

  // Employee modal helpers
  function openAddEmp() {
    setEditEmp(null)
    setEmpForm(emptyEmpForm())
    setEmpModalErr('')
    setEmpModalOpen(true)
  }
  function openEditEmp(e: Employee) {
    setEditEmp(e)
    setEmpForm({
      email: e.email,
      display_name: e.display_name,
      employee_no: e.employee_no ?? '',
      department_id: e.department_id != null ? String(e.department_id) : '',
      position_id: e.position_id != null ? String(e.position_id) : '',
      primary_role_id: e.primary_role_id != null ? String(e.primary_role_id) : '',
      manager_user_id: e.manager_user_id != null ? String(e.manager_user_id) : '',
      status: e.status,
      hired_at: e.hired_at ? e.hired_at.slice(0, 10) : '',
      resigned_at: e.resigned_at ? e.resigned_at.slice(0, 10) : '',
    })
    setEmpModalErr('')
    setEmpModalOpen(true)
  }

  async function handleSaveEmp() {
    if (!empForm.email.trim()) { setEmpModalErr('Email 為必填'); return }
    if (!empForm.display_name.trim()) { setEmpModalErr('姓名為必填'); return }
    setSavingEmp(true); setEmpModalErr('')
    try {
      const payload = {
        ...(editEmp ? { id: editEmp.id } : {}),
        email: empForm.email.trim(),
        display_name: empForm.display_name.trim(),
        employee_no: empForm.employee_no.trim() || null,
        department_id: empForm.department_id ? Number(empForm.department_id) : null,
        position_id: empForm.position_id ? Number(empForm.position_id) : null,
        primary_role_id: empForm.primary_role_id ? Number(empForm.primary_role_id) : null,
        manager_user_id: empForm.manager_user_id ? Number(empForm.manager_user_id) : null,
        status: empForm.status,
        hired_at: empForm.hired_at || null,
        resigned_at: empForm.resigned_at || null,
      }
      const r = await fetch('/api/admin/employees', {
        method: editEmp ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok) { setEmpModalErr(d.error || '儲存失敗'); return }
      setEmpModalOpen(false)
      fetchEmployees()
    } catch {
      setEmpModalErr('網路錯誤，請重試')
    } finally {
      setSavingEmp(false)
    }
  }

  // Position modal helpers
  function openAddPos() {
    setEditPos(null)
    setPosForm(emptyPosForm())
    setPosModalErr('')
    setPosModalOpen(true)
  }
  function openEditPos(p: Position & { code?: string | null; job_family?: string | null; is_manager?: boolean; status?: string }) {
    setEditPos(p)
    setPosForm({
      code: p.code ?? '',
      title: p.title,
      grade: p.grade ?? '',
      job_family: p.job_family ?? '',
      is_manager: p.is_manager ?? false,
      status: p.status ?? 'active',
    })
    setPosModalErr('')
    setPosModalOpen(true)
  }

  async function handleSavePos() {
    if (!posForm.title.trim()) { setPosModalErr('職位名稱為必填'); return }
    setSavingPos(true); setPosModalErr('')
    try {
      const payload = {
        ...(editPos ? { id: editPos.id } : {}),
        code: posForm.code.trim() || null,
        title: posForm.title.trim(),
        grade: posForm.grade.trim() || null,
        job_family: posForm.job_family.trim() || null,
        is_manager: posForm.is_manager,
        status: posForm.status,
      }
      const r = await fetch('/api/admin/positions', {
        method: editPos ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok) { setPosModalErr(d.error || '儲存失敗'); return }
      setPosModalOpen(false)
      fetchPositions()
    } catch {
      setPosModalErr('網路錯誤，請重試')
    } finally {
      setSavingPos(false)
    }
  }

  // Filter employees
  const filtered = employees.filter(e => {
    const q = search.toLowerCase()
    if (q && !e.display_name.toLowerCase().includes(q) && !e.email.toLowerCase().includes(q) && !(e.employee_no ?? '').toLowerCase().includes(q)) return false
    if (filterDept && String(e.department_id) !== filterDept) return false
    if (filterStatus && e.status !== filterStatus) return false
    return true
  })

  const empColumns = canManage
    ? ['工號', '姓名', '部門', '職位', '角色', '主管', '狀態', '操作']
    : ['工號', '姓名', '部門', '職位', '角色', '主管', '狀態']
  const empColCount = empColumns.length
  const posColumns = canManage
    ? ['職位代碼', '職位名稱', '職等', '職系', '是否主管職', '狀態', '操作']
    : ['職位代碼', '職位名稱', '職等', '職系', '是否主管職', '狀態']
  const posColCount = posColumns.length

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* ── 員工管理 ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>員工管理</h1>
          <span className="label-mono" style={{ display: 'block', marginTop: '4px' }}>HUMAN RESOURCES</span>
        </div>
        {canManage && <button onClick={openAddEmp} style={primaryBtn}>+ 新增員工</button>}
      </div>

      {errMsg && (
        <div style={{ ...card, padding: '12px 16px', color: 'var(--danger, #e53e3e)', fontSize: '13px', marginBottom: '16px' }}>{errMsg}</div>
      )}

      {/* 篩選列 */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜尋姓名 / Email / 工號…"
          style={{ ...inputStyle, width: '240px' }}
        />
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ ...inputStyle, width: '160px' }}>
          <option value="">全部部門</option>
          {depts.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: '120px' }}>
          <option value="">全部狀態</option>
          <option value="active">在職</option>
          <option value="inactive">停用</option>
          <option value="resigned">離職</option>
        </select>
      </div>

      <div style={{ ...card, overflow: 'hidden', marginBottom: '32px' }}>
        <div style={{ minWidth: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', minWidth: '800px' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {empColumns.map(h => (
                  <th key={h} className="label-mono" style={{ padding: '9px 16px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingEmp && (
                <tr><td colSpan={empColCount} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-faint)' }}>載入中…</td></tr>
              )}
              {!loadingEmp && filtered.length === 0 && (
                <tr><td colSpan={empColCount} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-faint)' }}>尚無員工資料</td></tr>
              )}
              {!loadingEmp && filtered.map(e => (
                <tr key={e.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-geist-mono), monospace', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {e.employee_no ?? '—'}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {e.display_name}
                    <div style={{ fontSize: '11px', color: 'var(--text-faint)', fontWeight: 400 }}>{e.email}</div>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {e.departments?.name ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {e.positions ? (
                      <span>{e.positions.title}{e.positions.grade ? <span className="label-mono" style={{ marginLeft: '4px', color: 'var(--text-faint)' }}>({e.positions.grade})</span> : null}</span>
                    ) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {e.roles?.name ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {e.manager_name ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      fontSize: '11px', fontWeight: 600,
                      color: STATUS_COLOR[e.status] ?? 'var(--text-muted)',
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: STATUS_COLOR[e.status] ?? 'var(--text-faint)', flexShrink: 0 }} />
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </td>
                  {canManage && (
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => openEditEmp(e)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: '12px' }}>編輯</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 職位管理 ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>職位管理</h2>
          <span className="label-mono" style={{ display: 'block', marginTop: '2px' }}>POSITIONS</span>
        </div>
        {canManage && <button onClick={openAddPos} style={{ ...primaryBtn, padding: '6px 12px', fontSize: '12px' }}>+ 新增職位</button>}
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ minWidth: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', minWidth: '560px' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {posColumns.map(h => (
                  <th key={h} className="label-mono" style={{ padding: '9px 16px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingPos && (
                <tr><td colSpan={posColCount} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-faint)' }}>載入中…</td></tr>
              )}
              {!loadingPos && positions.length === 0 && (
                <tr><td colSpan={posColCount} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-faint)' }}>尚無職位資料</td></tr>
              )}
              {!loadingPos && (positions as Array<Position & { code?: string | null; job_family?: string | null; is_manager?: boolean; status?: string }>).map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-geist-mono), monospace', fontSize: '11px', color: 'var(--text-muted)' }}>{p.code ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 500 }}>{p.title}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{p.grade ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{p.job_family ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: p.is_manager ? 'var(--primary)' : 'var(--text-faint)' }}>{p.is_manager ? '是' : '否'}</td>
                  <td style={{ padding: '10px 16px', color: p.status === 'active' ? '#22c55e' : 'var(--text-faint)', fontWeight: 600, fontSize: '12px' }}>
                    {p.status === 'active' ? '啟用' : '停用'}
                  </td>
                  {canManage && (
                    <td style={{ padding: '10px 16px' }}>
                      <button onClick={() => openEditPos(p)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: '12px' }}>編輯</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Employee Modal ── */}
      {empModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ ...card, padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px' }}>
              {editEmp ? '編輯員工' : '新增員工'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Email <span style={{ color: 'var(--danger, #e53e3e)' }}>*</span></label>
                <input type="email" value={empForm.email} onChange={e => setEmpForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} placeholder="name@company.com" />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>姓名 <span style={{ color: 'var(--danger, #e53e3e)' }}>*</span></label>
                <input value={empForm.display_name} onChange={e => setEmpForm(f => ({ ...f, display_name: e.target.value }))} style={inputStyle} placeholder="員工姓名" />
              </div>
              <div>
                <label style={labelStyle}>工號</label>
                <input value={empForm.employee_no} onChange={e => setEmpForm(f => ({ ...f, employee_no: e.target.value }))} style={inputStyle} placeholder="例：EMP001" />
              </div>
              <div>
                <label style={labelStyle}>狀態</label>
                <select value={empForm.status} onChange={e => setEmpForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                  <option value="active">在職</option>
                  <option value="inactive">停用</option>
                  <option value="resigned">離職</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>部門</label>
                <select value={empForm.department_id} onChange={e => setEmpForm(f => ({ ...f, department_id: e.target.value }))} style={inputStyle}>
                  <option value="">（未設定）</option>
                  {depts.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>職位</label>
                <select value={empForm.position_id} onChange={e => setEmpForm(f => ({ ...f, position_id: e.target.value }))} style={inputStyle}>
                  <option value="">（未設定）</option>
                  {positions.map(p => <option key={p.id} value={String(p.id)}>{p.title}{p.grade ? ` (${p.grade})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>角色</label>
                <select value={empForm.primary_role_id} onChange={e => setEmpForm(f => ({ ...f, primary_role_id: e.target.value }))} style={inputStyle}>
                  <option value="">（未設定）</option>
                  {roles.map(r => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>直屬主管</label>
                <select value={empForm.manager_user_id} onChange={e => setEmpForm(f => ({ ...f, manager_user_id: e.target.value }))} style={inputStyle}>
                  <option value="">（未設定）</option>
                  {employees.filter(e => !editEmp || e.id !== editEmp.id).map(e => (
                    <option key={e.id} value={String(e.id)}>{e.display_name}{e.employee_no ? ` (${e.employee_no})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>到職日</label>
                <input type="date" value={empForm.hired_at} onChange={e => setEmpForm(f => ({ ...f, hired_at: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>離職日</label>
                <input type="date" value={empForm.resigned_at} onChange={e => setEmpForm(f => ({ ...f, resigned_at: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            {empModalErr && (
              <div style={{ marginTop: '12px', color: 'var(--danger, #e53e3e)', fontSize: '13px', background: 'rgba(229,62,62,0.08)', padding: '8px 12px', borderRadius: 'var(--radius)' }}>{empModalErr}</div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={handleSaveEmp} disabled={savingEmp} style={{ ...primaryBtn, opacity: savingEmp ? 0.6 : 1 }}>{savingEmp ? '儲存中…' : '儲存'}</button>
              <button onClick={() => setEmpModalOpen(false)} style={ghostBtn}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Position Modal ── */}
      {posModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ ...card, padding: '24px', width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px' }}>
              {editPos ? '編輯職位' : '新增職位'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>職位名稱 <span style={{ color: 'var(--danger, #e53e3e)' }}>*</span></label>
                <input value={posForm.title} onChange={e => setPosForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="例：工程師" />
              </div>
              <div>
                <label style={labelStyle}>職位代碼</label>
                <input value={posForm.code} onChange={e => setPosForm(f => ({ ...f, code: e.target.value }))} style={inputStyle} placeholder="例：ENG-L3" />
              </div>
              <div>
                <label style={labelStyle}>職等</label>
                <input value={posForm.grade} onChange={e => setPosForm(f => ({ ...f, grade: e.target.value }))} style={inputStyle} placeholder="例：L3" />
              </div>
              <div>
                <label style={labelStyle}>職系</label>
                <input value={posForm.job_family} onChange={e => setPosForm(f => ({ ...f, job_family: e.target.value }))} style={inputStyle} placeholder="例：Engineering" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="is_manager" checked={posForm.is_manager} onChange={e => setPosForm(f => ({ ...f, is_manager: e.target.checked }))}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }} />
                <label htmlFor="is_manager" style={{ ...labelStyle, margin: 0, cursor: 'pointer' }}>主管職</label>
              </div>
              <div>
                <label style={labelStyle}>狀態</label>
                <select value={posForm.status} onChange={e => setPosForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                  <option value="active">啟用</option>
                  <option value="inactive">停用</option>
                </select>
              </div>
            </div>
            {posModalErr && (
              <div style={{ marginTop: '12px', color: 'var(--danger, #e53e3e)', fontSize: '13px', background: 'rgba(229,62,62,0.08)', padding: '8px 12px', borderRadius: 'var(--radius)' }}>{posModalErr}</div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={handleSavePos} disabled={savingPos} style={{ ...primaryBtn, opacity: savingPos ? 0.6 : 1 }}>{savingPos ? '儲存中…' : '儲存'}</button>
              <button onClick={() => setPosModalOpen(false)} style={ghostBtn}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
