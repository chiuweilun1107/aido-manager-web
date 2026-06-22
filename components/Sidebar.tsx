'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { visibleModules } from '@/lib/modules'
import type { Module } from '@/lib/modules'
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
        gap: collapsed ? '0' : '10px',
        padding: collapsed ? '9px 0' : '8px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 'var(--radius-sm)',
        fontSize: '13px', fontWeight: active ? 600 : 400,
        color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-muted)',
        background: active ? 'var(--sidebar-active-bg)' : 'transparent',
        textDecoration: 'none',
        transition: 'background 0.15s ease, color 0.15s ease',
        marginBottom: '2px',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-surface)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--sidebar-muted)'
        }
      }}
    >
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <Icon name={icon} size={16} className={active ? '' : 'opacity-70'} />
      </span>
      {!collapsed && (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {label}
        </span>
      )}
    </Link>
  )
}

export default function Sidebar({ roleCode, modules: modulesProp, groupOrder }: { roleCode: string; modules?: Module[]; groupOrder?: string[] }) {
  const pathname = usePathname()
  // 完整 module 清單(含自訂表單)由 layout 算好傳入(已依權限 visible filtered)；無則 fallback code
  const modules = modulesProp && modulesProp.length ? modulesProp : visibleModules(roleCode)
  const [collapsed, setCollapsed] = useState(false)
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set())
  const [mobileOpen, setMobileOpen] = useState(false)
  const [now, setNow] = useState('')

  useEffect(() => { setMobileOpen(false) }, [pathname])
  useEffect(() => {
    const d = new Date()
    setNow(d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, ' / '))
  }, [])

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
  const sf = 'var(--sidebar-faint)'

  return (
    <>
    <button className={`mobile-menu-btn${mobileOpen ? ' is-open' : ''}`} onClick={() => setMobileOpen(true)} aria-label="開啟選單"
      style={{ alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', cursor: 'pointer', width: '38px', height: '38px' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
    {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}
    <aside className={`app-sidebar${mobileOpen ? ' open' : ''}`} style={{
      width: sideW, minWidth: sideW,
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--sidebar-border)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', overflowX: 'hidden',
      flexShrink: 0,
      transition: 'width 0.2s ease, min-width 0.2s ease, transform 0.25s ease',
    }}>
      {/* Brand header */}
      <div style={{
        padding: collapsed ? '16px 0' : '18px 16px 14px',
        borderBottom: '1px solid var(--sidebar-border)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: '8px',
      }}>
        {!collapsed && (
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '9px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/aido-app-icon.png" alt="AiDo 智行" width={30} height={30} style={{ borderRadius: '7px', flexShrink: 0 }} />
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--sidebar-text)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              AiDo 智行
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? '展開側欄' : '收合側欄'}
          style={{
            flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer',
            color: sf, padding: '4px', borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = sf)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: collapsed ? '8px 4px' : '10px 8px' }}>
        <NavItem href="/dashboard" icon="chart-bar-square" label="首頁總覽"
          active={pathname === '/dashboard'} collapsed={collapsed} />

        {[...(groupOrder ?? GROUP_ORDER), ...Object.keys(groups).filter(g => !(groupOrder ?? GROUP_ORDER).includes(g))].filter(g => groups[g]?.length).map(g => (
          <div key={g}>
            {!collapsed ? (
              <button
                onClick={() => toggleGroup(g)}
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', padding: '14px 12px 5px', gap: '4px',
                }}
              >
                <span className="label-mono" style={{ letterSpacing: '0.08em', color: sf }}>{g}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ flexShrink: 0, color: sf, transform: closedGroups.has(g) ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            ) : (
              <div style={{ height: '8px' }} />
            )}
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

      {/* 底部 SYSTEM INFO (依示意圖) */}
      {!collapsed && (
        <div style={{ borderTop: '1px solid var(--sidebar-border)', padding: '12px 16px 14px', flexShrink: 0 }}>
          <div className="label-mono" style={{ color: sf, marginBottom: '8px' }}>SYSTEM INFO</div>
          <div style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: '10px', lineHeight: 1.9, color: 'var(--sidebar-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: sf }}>DATE</span><span>{now || '—'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: sf }}>ROLE</span><span>{ROLE_LABELS[roleCode] || roleCode}</span></div>
          </div>
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--sidebar-border)' }}>
            <div style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--sidebar-active-bg)' }}>CONFIDENTIAL</div>
            <div style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: '9px', color: sf, marginTop: '2px' }}>Internal Use Only</div>
          </div>
        </div>
      )}
    </aside>
    </>
  )
}
