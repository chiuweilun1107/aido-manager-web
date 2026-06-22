'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { SessionUser } from '@/lib/types'

interface DashConfig { title: string; link: string }

interface DashData {
  my_requests: Array<{ id: number; request_no: string; module_code: string; title: string; status: string; created_at: string }>
  pending_approvals_count: number
  announcements: Array<{ id: number; title: string; created_at: string }>
  leave_balances: Array<{ period_year: number; used_hours: number; granted_hours: number; leave_types?: { name: string } }>
  today_attendance?: { clock_in_at?: string; clock_out_at?: string } | null
}

const STATUS_MAP: Record<string, string> = {
  draft: '草稿', in_review: '審核中', approved: '已核准', rejected: '已駁回', returned: '退回', cancelled: '已取消'
}

const CHIP_CLASS: Record<string, string> = {
  draft: 'chip chip--draft', in_review: 'chip chip--in_review', approved: 'chip chip--approved',
  rejected: 'chip chip--rejected', returned: 'chip chip--returned', cancelled: 'chip chip--cancelled',
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      padding: '20px 20px 20px 0',
      borderRight: '1px solid var(--border)',
    }}>
      <div className="label-mono" style={{ marginBottom: '8px' }}>{label}</div>
      <div style={{
        fontSize: '32px',
        fontWeight: 400,
        color: 'var(--text)',
        letterSpacing: '-0.05em',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>{value}</div>
      {sub && <div style={{ color: 'var(--text-faint)', fontSize: '12px', marginTop: '6px' }}>{sub}</div>}
    </div>
  )
}

export default function DashboardView({ user, shortcuts }: { user: SessionUser; shortcuts: DashConfig[] }) {
  const [data, setData] = useState<DashData | null>(null)
  const thisYear = new Date().getFullYear()

  useEffect(() => { fetch('/api/dashboard').then(r => r.json()).then(setData) }, [])

  const leaveBalance = data?.leave_balances?.find(b => b.period_year === thisYear)
  const attendanceStr = data?.today_attendance
    ? `${data.today_attendance.clock_in_at ? new Date(data.today_attendance.clock_in_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '—'} ~ ${data.today_attendance.clock_out_at ? new Date(data.today_attendance.clock_out_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '未退勤'}`
    : null

  return (
    <>
      <style>{`
        .dash-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
        .dash-row:hover { background: var(--surface-2); }
        .dash-shortcut { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 14px 16px; text-decoration: none; display: block; transition: border-color 0.15s ease; }
        .dash-shortcut:hover { border-color: var(--border-strong); }
      `}</style>

      {/* §16 main content section: bg=var(--bg) */}
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Page heading */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 400,
            color: 'var(--text)',
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            margin: 0,
          }}>
            歡迎，{user.displayName}
          </h1>
          <p style={{ color: 'var(--text-faint)', fontSize: '13px', marginTop: '4px' }}>
            {new Date().toLocaleDateString('zh-TW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* stat-counter-row--aido-kpi: 4-col KPI divider row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0',
          marginBottom: '24px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          padding: '0 0 0 20px',
        }}>
          <KpiCard label="待簽核" value={data?.pending_approvals_count ?? '—'} />
          <div style={{ padding: '20px' }}>
            <div className="label-mono" style={{ marginBottom: '8px' }}>我的申請</div>
            <div style={{ fontSize: '32px', fontWeight: 400, color: 'var(--text)', letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {data?.my_requests?.length ?? '—'}
            </div>
          </div>
          <div style={{ padding: '20px', borderLeft: '1px solid var(--border)' }}>
            <div className="label-mono" style={{ marginBottom: '8px' }}>今日出勤</div>
            <div style={{ fontSize: '14px', color: attendanceStr ? 'var(--text)' : 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
              {attendanceStr || '—'}
            </div>
          </div>
          <div style={{ padding: '20px', borderLeft: '1px solid var(--border)' }}>
            <div className="label-mono" style={{ marginBottom: '8px' }}>
              {leaveBalance?.leave_types?.name || '年假'} 剩餘
            </div>
            <div style={{ fontSize: '32px', fontWeight: 400, color: 'var(--text)', letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {leaveBalance ? `${leaveBalance.granted_hours - leaveBalance.used_hours}h` : '—'}
            </div>
          </div>
        </div>

        {/* bento-grid--aido-dashboard: 2fr + 1fr asymmetric */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '20px',
          marginBottom: '24px',
        }}>
          {/* Main widget: recent requests */}
          <div className="dash-card">
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: '14px' }}>最近申請</span>
              <Link href="/approvals" style={{ color: 'var(--primary)', fontSize: '13px', textDecoration: 'none' }}>
                全部 →
              </Link>
            </div>
            {(!data?.my_requests || data.my_requests.length === 0) && (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>
                尚無申請紀錄
              </div>
            )}
            {data?.my_requests?.slice(0, 5).map(r => (
              <Link
                key={r.id}
                href={`/request/${r.id}`}
                className="dash-row"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderBottom: '1px solid var(--border)',
                  textDecoration: 'none', transition: 'background 0.15s ease',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--text)', fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.title}
                  </div>
                  <div style={{ color: 'var(--text-faint)', fontSize: '12px', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
                    {r.request_no}
                  </div>
                </div>
                <span className={CHIP_CLASS[r.status] || 'chip chip--draft'} style={{ marginLeft: '12px', flexShrink: 0 }}>
                  {STATUS_MAP[r.status] || r.status}
                </span>
              </Link>
            ))}
          </div>

          {/* Right column widgets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Announcements widget */}
            <div className="dash-card" style={{ flex: 1 }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: '14px' }}>最新公告</span>
              </div>
              {(!data?.announcements || data.announcements.length === 0) && (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>暫無公告</div>
              )}
              {data?.announcements?.slice(0, 3).map(a => (
                <div key={a.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ color: 'var(--text)', fontSize: '13px' }}>{a.title}</div>
                  <div style={{ color: 'var(--text-faint)', fontSize: '11px', fontVariantNumeric: 'tabular-nums', marginTop: '3px' }}>
                    {new Date(a.created_at).toLocaleDateString('zh-TW')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* card-grid-trio--aido-modules: quick access shortcuts */}
        {shortcuts.length > 0 && (
          <div>
            <div className="label-mono" style={{ marginBottom: '12px' }}>快速功能</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '8px',
            }}>
              {shortcuts.map(c => (
                <Link key={c.link} href={c.link} className="dash-shortcut">
                  <div style={{ color: 'var(--text)', fontSize: '14px', fontWeight: 500 }}>{c.title}</div>
                  <div style={{ color: 'var(--primary)', fontSize: '12px', marginTop: '4px' }}>前往 →</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
