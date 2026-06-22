'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { SessionUser } from '@/lib/types'

interface DashConfig { title: string; link: string }
interface DashData {
  my_requests: Array<{ id: number; request_no: string; module_code: string; title: string; status: string; amount?: number; created_at: string }>
  pending_approvals_count: number
  announcements: Array<{ id: number; title: string; created_at: string }>
  leave_balances: Array<{ period_year: number; used_hours: number; granted_hours: number; leave_types?: { name: string } }>
  today_attendance?: { clock_in_at?: string; clock_out_at?: string } | null
}

const STATUS_MAP: Record<string, string> = {
  draft: '草稿', in_review: '審核中', approved: '已核准', rejected: '已駁回', returned: '退回', cancelled: '已取消',
}
const MODULE_LABEL: Record<string, string> = {
  leave: '請假申請', overtime: '加班申請', expense: '費用報銷', procurement: '採購申請',
  seal: '用印申請', benefit: '福利申請', attendance_correction: '補打卡',
}

// 管理層 (在一般職員個人基底之上，額外加角色專屬區塊)
const MGMT_ROLES = ['manager', 'hr', 'finance', 'executive', 'auditor', 'it', 'admin_officer']

// 區塊定義：span 1=窄(1/4) 2=中(1/2) 4=全寬；roles='*' 所有角色(個人基底) 或角色清單
type BlockId = 'kpi' | 'inbox' | 'leave-donut' | 'leave-stats' | 'expense' | 'recent' | 'analytics' | 'shortcuts'
interface BlockDef { id: BlockId; title: string; defaultSpan: number; roles: '*' | string[] }
const BLOCKS: BlockDef[] = [
  { id: 'kpi', title: '今日待辦總覽', defaultSpan: 4, roles: '*' },
  { id: 'inbox', title: '待簽核清單', defaultSpan: 4, roles: '*' },
  { id: 'leave-donut', title: '特休使用', defaultSpan: 1, roles: '*' },
  { id: 'leave-stats', title: '請假統計', defaultSpan: 1, roles: '*' },
  { id: 'expense', title: '費用報銷', defaultSpan: 1, roles: '*' },
  { id: 'recent', title: '近期紀錄', defaultSpan: 1, roles: '*' },
  { id: 'analytics', title: '報表分析', defaultSpan: 1, roles: MGMT_ROLES },
  { id: 'shortcuts', title: '快速功能', defaultSpan: 4, roles: '*' },
]
function roleVisible(b: BlockDef, role: string) { return b.roles === '*' || b.roles.includes(role) }
function nextSpan(s: number) { return s === 1 ? 2 : s === 2 ? 4 : 1 }
const SPAN_LABEL: Record<number, string> = { 1: '窄', 2: '中', 4: '寬' }

type Prefs = Record<string, { hidden?: boolean; span?: number }>

function Donut({ pct, center, sub }: { pct: number; center: string; sub: string }) {
  const r = 42, c = 2 * Math.PI * r
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100)
  return (
    <div style={{ position: 'relative', width: '128px', height: '128px' }}>
      <svg viewBox="0 0 100 100" width="128" height="128">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--primary)" strokeWidth="9"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 50 50)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em' }}>{center}</div>
        <div style={{ fontSize: '10px', color: 'var(--text-faint)', fontFamily: 'var(--font-geist-mono), monospace', marginTop: '2px' }}>{sub}</div>
      </div>
    </div>
  )
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', height: '100%' }
const sectionTitle: React.CSSProperties = { fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }

export default function DashboardView({ user, shortcuts }: { user: SessionUser; shortcuts: DashConfig[] }) {
  const [data, setData] = useState<DashData | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const [thisYear, setThisYear] = useState(0)
  const [prefs, setPrefs] = useState<Prefs>({})
  const [editMode, setEditMode] = useState(false)
  const prefsKey = `dash-prefs-${user.id}`

  useEffect(() => { setThisYear(new Date().getFullYear()) }, [])
  useEffect(() => {
    try { const raw = localStorage.getItem(prefsKey); if (raw) setPrefs(JSON.parse(raw)) } catch { /* ignore */ }
  }, [prefsKey])
  useEffect(() => {
    fetch('/api/dashboard').then(r => { if (!r.ok) throw new Error(); return r.json() }).then(setData).catch(() => setFetchError(true))
  }, [])

  function savePrefs(next: Prefs) { setPrefs(next); try { localStorage.setItem(prefsKey, JSON.stringify(next)) } catch { /* ignore */ } }
  function setBlock(id: string, patch: { hidden?: boolean; span?: number }) {
    savePrefs({ ...prefs, [id]: { ...prefs[id], ...patch } })
  }
  function resetPrefs() { savePrefs({}); }

  const effVisible = (b: BlockDef) => prefs[b.id]?.hidden !== undefined ? !prefs[b.id]!.hidden : roleVisible(b, user.roleCode)
  const effSpan = (b: BlockDef) => prefs[b.id]?.span ?? b.defaultSpan

  // 衍生資料
  const reqs = data?.my_requests || []
  const countBy = (m: string) => reqs.filter(r => r.module_code === m).length
  const kpis = [
    { label: '待簽核', value: data?.pending_approvals_count ?? 0, accent: true },
    { label: '請假申請', value: countBy('leave') },
    { label: '費用報銷', value: countBy('expense') },
    { label: '採購申請', value: countBy('procurement') },
    { label: '用印申請', value: countBy('seal') },
    { label: '加班申請', value: countBy('overtime') },
  ]
  const leaveBal = thisYear > 0 ? data?.leave_balances?.find(b => b.period_year === thisYear) : undefined
  const remainPct = leaveBal && leaveBal.granted_hours > 0 ? 100 - Math.round((leaveBal.used_hours / leaveBal.granted_hours) * 100) : 0
  const expenseReqs = reqs.filter(r => r.module_code === 'expense')
  const expenseTotal = expenseReqs.reduce((s, r) => s + (Number(r.amount) || 0), 0)

  function renderBlock(id: BlockId) {
    switch (id) {
      case 'kpi': return (
        <div className="rwd-kpi" style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(6, minmax(150px, 1fr))', overflowX: 'auto' }}>
          {kpis.map((k, i) => (
            <div key={k.label} style={{ padding: '18px 20px', borderRight: i < kpis.length - 1 ? '1px solid var(--border)' : 'none', position: 'relative' }}>
              {k.accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'var(--primary)' }} />}
              <div className="label-mono" style={{ marginBottom: '8px' }}>{k.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '32px', fontWeight: 700, color: k.accent ? 'var(--primary)' : 'var(--text)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{data ? k.value : '—'}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>件</span>
              </div>
            </div>
          ))}
        </div>
      )
      case 'inbox': return (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={sectionTitle}>待簽核清單 <span className="label-mono" style={{ marginLeft: '6px' }}>/ INBOX</span></h3>
            <Link href="/approvals" style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>查看全部 →</Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', minWidth: '640px' }}>
              <thead><tr style={{ background: 'var(--surface-2)' }}>{['申請單號', '類型', '主旨', '金額/天數', '狀態', '申請日'].map(h => <th key={h} className="label-mono" style={{ padding: '9px 16px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>
                {!data && <tr><td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>載入中…</td></tr>}
                {data && reqs.length === 0 && <tr><td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>目前沒有待辦項目</td></tr>}
                {reqs.slice(0, 8).map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-geist-mono), monospace', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.request_no}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{MODULE_LABEL[r.module_code] || r.module_code}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.amount ? `NT$ ${Number(r.amount).toLocaleString()}` : '—'}</td>
                    <td style={{ padding: '10px 16px' }}><span className={`chip chip--${r.status}`}>{STATUS_MAP[r.status] || r.status}</span></td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-geist-mono), monospace', fontSize: '11px', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('zh-TW') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
      case 'leave-donut': return (
        <div style={{ ...card, padding: '18px' }}>
          <h3 style={{ ...sectionTitle, marginBottom: '14px' }}>特休使用<span className="label-mono" style={{ marginLeft: '6px' }}>本年</span></h3>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><Donut pct={remainPct} center={`${remainPct}%`} sub="剩餘" /></div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>已用 {leaveBal?.used_hours ?? 0}h</span><span>核配 {leaveBal?.granted_hours ?? 0}h</span>
          </div>
        </div>
      )
      case 'leave-stats': return (
        <div style={{ ...card, padding: '18px' }}>
          <h3 style={{ ...sectionTitle, marginBottom: '14px' }}>請假統計<span className="label-mono" style={{ marginLeft: '6px' }}>本年</span></h3>
          {(data?.leave_balances || []).slice(0, 6).map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <span>{b.leave_types?.name || '假別'}</span><span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{b.used_hours}h</span>
            </div>
          ))}
          {(!data?.leave_balances || data.leave_balances.length === 0) && <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>尚無紀錄</div>}
        </div>
      )
      case 'expense': return (
        <div style={{ ...card, padding: '18px' }}>
          <h3 style={{ ...sectionTitle, marginBottom: '14px' }}>費用報銷<span className="label-mono" style={{ marginLeft: '6px' }}>概況</span></h3>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>NT$ {expenseTotal.toLocaleString()}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px', marginBottom: '14px' }}>累計報銷金額</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: '1px solid var(--border)' }}>
            <span>報銷筆數</span><span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{expenseReqs.length}</span>
          </div>
        </div>
      )
      case 'recent': return (
        <div style={{ ...card, padding: '18px' }}>
          <h3 style={{ ...sectionTitle, marginBottom: '14px' }}>近期紀錄<span className="label-mono" style={{ marginLeft: '6px' }}>RECENT</span></h3>
          {reqs.slice(0, 5).map(r => (
            <div key={r.id} style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)', marginTop: '6px', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-faint)', fontFamily: 'var(--font-geist-mono), monospace' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('zh-TW') : ''}</div>
              </div>
            </div>
          ))}
          {reqs.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>尚無紀錄</div>}
        </div>
      )
      case 'analytics': return (
        <Link href="/module/bi" style={{ ...card, padding: '18px', textDecoration: 'none', display: 'block' }}>
          <h3 style={{ ...sectionTitle, marginBottom: '14px' }}>報表分析<span className="label-mono" style={{ marginLeft: '6px' }}>BI</span></h3>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>部門簽核統計、出勤費用彙總、可匯出 Excel。</div>
          <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '14px', fontWeight: 600 }}>進入報表中心 →</div>
        </Link>
      )
      case 'shortcuts': return (
        <div>
          <div className="label-mono" style={{ marginBottom: '10px' }}>快速功能</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
            {shortcuts.map(c => (
              <Link key={c.link} href={c.link} style={{ ...card, padding: '14px 16px', textDecoration: 'none', display: 'block', height: 'auto', transition: 'border-color .15s ease' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{c.title}</div>
                <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '6px' }}>前往 →</div>
              </Link>
            ))}
          </div>
        </div>
      )
    }
  }

  const visibleBlocks = BLOCKS.filter(effVisible)
  // 只列「角色本可見但被用戶隱藏」的；角色本就不該見的(如一般職員的 analytics)不出現在恢復清單
  const hiddenBlocks = BLOCKS.filter(b => roleVisible(b, user.roleCode) && !effVisible(b))

  return (
    <>
      <style>{`
        .dash-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
        @media (max-width:768px){ .dash-grid { grid-template-columns:1fr !important; } .dash-grid > * { grid-column: span 1 !important; } }
        .edit-ctrl { position:absolute; top:8px; right:8px; z-index:5; display:flex; gap:4px; }
      `}</style>

      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* 工具列 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h2 style={sectionTitle}>今日待辦總覽</h2>
            <span className="label-mono" style={{ display: 'block', marginTop: '4px' }}>{user.roleName} · {user.displayName}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {editMode && (
              <button onClick={resetPrefs} className="label-mono" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 12px', cursor: 'pointer', color: 'var(--text-muted)' }}>重設預設</button>
            )}
            <button onClick={() => setEditMode(e => !e)} className="label-mono" style={{ background: editMode ? 'var(--primary)' : 'transparent', color: editMode ? '#fff' : 'var(--text-muted)', border: editMode ? 'none' : '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {!editMode && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>}
              {editMode ? '完成' : '自訂版面'}
            </button>
          </div>
        </div>

        {fetchError && <div style={{ ...card, padding: '16px', color: 'var(--danger)', fontSize: '13px', marginBottom: '20px' }}>載入失敗，請重新整理</div>}

        {/* 區塊網格 */}
        <div className="dash-grid">
          {visibleBlocks.map(b => {
            const span = effSpan(b)
            return (
              <div key={b.id} style={{ gridColumn: `span ${span}`, position: 'relative', outline: editMode ? '1px dashed var(--border-strong)' : 'none', outlineOffset: '3px', borderRadius: 'var(--radius-lg)' }}>
                {editMode && (
                  <div className="edit-ctrl">
                    <button onClick={() => setBlock(b.id, { span: nextSpan(span) })} title={`大小：${SPAN_LABEL[span]}`} className="label-mono"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', cursor: 'pointer', color: 'var(--text)', fontSize: '10px' }}>
                      {SPAN_LABEL[span]} ⇄
                    </button>
                    <button onClick={() => setBlock(b.id, { hidden: true })} title="隱藏" aria-label="隱藏區塊"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '3px 6px', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ overflow: 'visible' }}><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>
                    </button>
                  </div>
                )}
                {renderBlock(b.id)}
              </div>
            )
          })}
        </div>

        {/* 編輯模式：已隱藏區塊 */}
        {editMode && hiddenBlocks.length > 0 && (
          <div style={{ marginTop: '20px', padding: '14px 16px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-lg)' }}>
            <div className="label-mono" style={{ marginBottom: '10px' }}>已隱藏區塊（點擊恢復）</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {hiddenBlocks.map(b => (
                <button key={b.id} onClick={() => setBlock(b.id, { hidden: false })}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 12px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" style={{ overflow: 'visible' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {b.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {editMode && (
          <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text-faint)', textAlign: 'center' }}>
            自訂版面會記住你的設定。「窄 ⇄」可切換區塊大小（窄／中／寬）。
          </div>
        )}
      </div>
    </>
  )
}
