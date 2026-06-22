'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { SessionUser } from '@/lib/types'

type ThemeMode = 'light' | 'dark' | 'system'

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}
function applyMode(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && systemPrefersDark())
  if (dark) document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
}

export default function TopBar({ user }: { user: SessionUser }) {
  const router = useRouter()
  const [initials, setInitials] = useState('')
  const [themeMode, setThemeMode] = useState<ThemeMode | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const name = user.displayName || user.email || ''
    setInitials(name.slice(0, 2).toUpperCase())
    const saved = (localStorage.getItem('theme-mode') as ThemeMode) || 'light'
    setThemeMode(saved)
    applyMode(saved)
    // 跟隨系統時，監聽 OS 深淺變更
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => { if ((localStorage.getItem('theme-mode') as ThemeMode) === 'system') applyMode('system') }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [user.displayName, user.email])

  // scroll-aware：主內容下拉時才出現分隔線/陰影
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    const onScroll = () => setScrolled(main.scrollTop > 4)
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [])

  // 點選單外關閉
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  function pickMode(mode: ThemeMode) {
    setThemeMode(mode); localStorage.setItem('theme-mode', mode); applyMode(mode); setMenuOpen(false)
  }

  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }) }
    finally { router.push('/login'); router.refresh() }
  }

  const effectiveDark = themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark())
  const iconBtn: React.CSSProperties = {
    width: '32px', height: '32px', borderRadius: 'var(--radius)',
    background: 'transparent', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-muted)', transition: 'color 0.15s ease',
  }

  const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: '淺色', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg> },
    { mode: 'dark', label: '深色', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> },
    { mode: 'system', label: '跟隨系統', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> },
  ]

  return (
    <header style={{
      height: 'var(--topbar-h)',
      background: scrolled ? 'var(--surface)' : 'var(--bg)',
      borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
      boxShadow: scrolled ? '0 1px 4px rgba(0,0,0,0.04)' : 'none',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: '12px', flexShrink: 0,
      transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
        企業行政管理平台
      </div>

      <div style={{ flex: 1 }} />

      {/* 主題三態切換 (淺色/深色/跟隨系統) */}
      {themeMode !== null && (
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(o => !o)} aria-label="主題設定" title="主題設定" style={iconBtn}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}>
            {effectiveDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            )}
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: '40px', right: 0, zIndex: 100,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              padding: '4px', minWidth: '150px',
            }}>
              {THEME_OPTIONS.map(opt => {
                const sel = themeMode === opt.mode
                return (
                  <button key={opt.mode} onClick={() => pickMode(opt.mode)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 10px', background: sel ? 'var(--primary-light)' : 'transparent',
                      border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      color: sel ? 'var(--primary)' : 'var(--text-muted)', fontSize: '13px',
                      fontWeight: sel ? 600 : 400, textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                    onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <span style={{ display: 'flex', flexShrink: 0 }}>{opt.icon}</span>
                    <span style={{ flex: 1 }}>{opt.label}</span>
                    {sel && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <button aria-label="通知" style={iconBtn}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </button>

      {/* 部門 / 角色 資訊 (通知之後、用戶名之前；先部門再角色) */}
      <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', fontFamily: 'var(--font-geist-mono), monospace' }}>
        {user.departmentName && (
          <>
            <span style={{ color: 'var(--text-faint)' }}>部門 <span style={{ color: 'var(--text)', fontWeight: 600 }}>{user.departmentName}</span></span>
            <span style={{ color: 'var(--border-strong)' }}>|</span>
          </>
        )}
        <span style={{ color: 'var(--text-faint)' }}>角色 <span style={{ color: 'var(--text)', fontWeight: 600 }}>{user.roleName}</span></span>
      </div>
      <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '30px', height: '30px', borderRadius: 'var(--radius-full)',
          background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-geist-mono), monospace', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {initials}
        </div>
        <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.displayName || user.email}
        </span>
      </div>

      <button onClick={logout} className="label-mono" style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--text-faint)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', transition: 'color 0.15s ease',
      }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--primary)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-faint)')}>
        登出
      </button>
    </header>
  )
}
