'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { visibleModules } from '@/lib/modules'
import { ROLE_LABELS } from '@/lib/rbac'
import Icon from '@/components/Icon'

const GROUP_ORDER = ['我的工作區', '差勤', '行政 / 財務', '人資', '治理 / 系統']

function NavItem({ href, icon, label, active, collapsed }: {
  href: string; icon: string; label: string; active: boolean; collapsed: boolean
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex', alignItems: 'center',
        gap: collapsed ? '0' : '8px',
        padding: collapsed ? '9px 0' : '7px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 'var(--radius)',
        fontSize: '13px', fontWeight: active ? 500 : 400,
        color: active ? 'var(--primary)' : 'var(--text-muted)',
        background: active ? 'var(--primary-light)' : 'transparent',
        textDecoration: 'none',
        transition: 'background 0.15s ease, color 0.15s ease',
        marginBottom: '1px',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
        }
      }}
    >
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <Icon name={icon} size={16} className={active ? '' : 'opacity-60'} />
      </span>
      {!collapsed && (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {label}
        </span>
      )}
    </Link>
  )
}

export default function Sidebar({ roleCode }: { roleCode: string }) {
  const pathname = usePathname()
  const modules = visibleModules(roleCode)
  const [collapsed, setCollapsed] = useState(false)
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set())
  const [mobileOpen, setMobileOpen] = useState(false)

  // 路由變更時自動關閉手機 drawer
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const groups: Record<string, typeof modules> = {}
  for (const m of modules) {
    const g = m.group || '其他'
    if (!groups[g]) groups[g] = []
    groups[g].push(m)
  }

  function toggleGroup(g: string) {
    setClosedGroups(prev => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  const sideW = collapsed ? '56px' : 'var(--sidebar-w)'

  return (
    <>
    {/* 手機漢堡選單按鈕 (僅手機顯示，drawer 開啟時隱藏) */}
    {!mobileOpen && (
      <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="開啟選單"
        style={{ alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', cursor: 'pointer', width: '38px', height: '38px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
    )}
    {/* 手機 drawer 背景遮罩 */}
    {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}
    <aside className={`app-sidebar${mobileOpen ? ' open' : ''}`} style={{
      width: sideW, minWidth: sideW,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', overflowX: 'hidden',
      flexShrink: 0,
      transition: 'width 0.2s ease, min-width 0.2s ease, transform 0.25s ease',
    }}>
      {/* Brand header */}
      <div style={{
        padding: collapsed ? '14px 0' : '16px 16px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: '8px',
      }}>
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
              AiDo 智行
            </div>
            <div className="label-mono" style={{ marginTop: '3px' }}>
              {ROLE_LABELS[roleCode] || roleCode}
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? '展開側欄' : '收合側欄'}
          style={{
            flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-faint)', padding: '4px', borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-faint)')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed
              ? <polyline points="9 18 15 12 9 6" />
              : <polyline points="15 18 9 12 15 6" />}
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: collapsed ? '8px 4px' : '8px' }}>
        <NavItem href="/dashboard" icon="chart-bar-square" label="首頁"
          active={pathname === '/dashboard'} collapsed={collapsed} />

        {GROUP_ORDER.filter(g => groups[g]?.length).map(g => (
          <div key={g}>
            {/* Group header — clickable to collapse */}
            {!collapsed ? (
              <button
                onClick={() => toggleGroup(g)}
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 12px 4px', gap: '4px',
                }}
              >
                <span className="label-mono" style={{ letterSpacing: '0.08em' }}>{g}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{
                    flexShrink: 0, color: 'var(--text-faint)',
                    transform: closedGroups.has(g) ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                  }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            ) : (
              <div style={{ height: '8px' }} />
            )}

            {/* Group items */}
            {(collapsed || !closedGroups.has(g)) && groups[g].map(m => {
              const href = `/module/${m.code}`
              return (
                <NavItem key={m.code} href={href} icon={m.icon} label={m.name}
                  active={pathname.startsWith(href)} collapsed={collapsed} />
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
    </>
  )
}
