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

export default function DashboardView({ user, shortcuts }: { user: SessionUser; shortcuts: DashConfig[] }) {
  const [data, setData] = useState<DashData | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const [thisYear, setThisYear] = useState(0)

  useEffect(() => { setThisYear(new Date().getFullYear()) }, [])
  useEffect(() => {
    fetch('/api/dashboard').then(r => { if (!r.ok) throw new Error(); return r.json() }).then(setData).catch(() => setFetchError(true))
  }, [])

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
  const usePct = leaveBal && leaveBal.granted_hours > 0 ? Math.round((leaveBal.used_hours / leaveBal.granted_hours) * 100) : 0
  const remainPct = 100 - usePct
  const expenseReqs = reqs.filter(r => r.module_code === 'expense')
  const expenseTotal = expenseReqs.reduce((s, r) => s + (Number(r.amount) || 0), 0)

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }
  const sectionTitle: React.CSSProperties = { fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }

  return (
    <>
      <style>{`
        .ib-row { display:flex; align-items:center; padding:11px 16px; border-bottom:1px solid var(--border); text-decoration:none; transition:background .1s ease; }
        .ib-row:hover { background: var(--surface-2); }
        .ib-row:last-child { border-bottom:none; }
      `}</style>

      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

        {/* 今日待辦總覽 — 6 KPI */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={sectionTitle}>今日待辦總覽</h2>
          <span className="label-mono">{user.roleName} · {user.displayName}</span>
        </div>
        {fetchError && <div style={{ ...card, padding: '16px', color: 'var(--danger)', fontSize: '13px', marginBottom: '20px' }}>載入失敗，請重新整理</div>}
        <div className="rwd-kpi" style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: '20px', overflow: 'hidden' }}>
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

        {/* 待簽核清單 INBOX */}
        <div style={{ ...card, marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={sectionTitle}>待簽核清單 <span className="label-mono" style={{ marginLeft: '6px' }}>/ INBOX</span></h3>
            <Link href="/approvals" style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>查看全部 →</Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', minWidth: '640px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['申請單號', '類型', '主旨', '金額/天數', '狀態', '申請日'].map(h => (
                    <th key={h} className="label-mono" style={{ padding: '9px 16px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
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

        {/* 三欄: 出勤圓環 / 請假統計 / 費用概況 / 近期紀錄 */}
        <div className="rwd-cols-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
          {/* 假別使用 圓環 */}
          <div style={{ ...card, padding: '18px' }}>
            <h3 style={{ ...sectionTitle, marginBottom: '14px' }}>特休使用<span className="label-mono" style={{ marginLeft: '6px' }}>本年</span></h3>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <Donut pct={remainPct} center={`${remainPct}%`} sub="剩餘" />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>已用 {leaveBal?.used_hours ?? 0}h</span><span>核配 {leaveBal?.granted_hours ?? 0}h</span>
            </div>
          </div>
          {/* 請假統計 */}
          <div style={{ ...card, padding: '18px' }}>
            <h3 style={{ ...sectionTitle, marginBottom: '14px' }}>請假統計<span className="label-mono" style={{ marginLeft: '6px' }}>本年</span></h3>
            {(data?.leave_balances || []).slice(0, 6).map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <span>{b.leave_types?.name || '假別'}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{b.used_hours}h</span>
              </div>
            ))}
            {(!data?.leave_balances || data.leave_balances.length === 0) && <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>尚無紀錄</div>}
          </div>
          {/* 費用報銷概況 */}
          <div style={{ ...card, padding: '18px' }}>
            <h3 style={{ ...sectionTitle, marginBottom: '14px' }}>費用報銷<span className="label-mono" style={{ marginLeft: '6px' }}>概況</span></h3>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>NT$ {expenseTotal.toLocaleString()}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px', marginBottom: '14px' }}>累計報銷金額</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: '1px solid var(--border)' }}>
              <span>報銷筆數</span><span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{expenseReqs.length}</span>
            </div>
          </div>
          {/* 近期行政紀錄 */}
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
        </div>

        {/* 快速功能 */}
        {shortcuts.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div className="label-mono" style={{ marginBottom: '10px' }}>快速功能</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
              {shortcuts.map(c => (
                <Link key={c.link} href={c.link} style={{ ...card, padding: '14px 16px', textDecoration: 'none', display: 'block', transition: 'border-color .15s ease' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{c.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '6px' }}>前往 →</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
