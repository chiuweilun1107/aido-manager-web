'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SessionUser } from '@/lib/types'

export default function TopBar({ user }: { user: SessionUser }) {
  const router = useRouter()
  const [initials, setInitials] = useState('')

  useEffect(() => {
    const name = user.displayName || user.email || ''
    setInitials(name.slice(0, 2).toUpperCase())
  }, [user])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header style={{
      height: 'var(--topbar-h)',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: '12px',
      flexShrink: 0,
    }}>
      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Notification badge placeholder */}
      <button
        aria-label="通知"
        style={{
          width: '32px', height: '32px',
          borderRadius: 'var(--radius)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)',
          position: 'relative',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </button>

      {/* User info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Avatar */}
        <div style={{
          width: '28px', height: '28px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--primary-light)',
          border: '1px solid var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-geist-mono), monospace',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--primary)',
          flexShrink: 0,
        }}>
          {initials}
        </div>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.displayName || user.email}
        </span>
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="label-mono"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-faint)',
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--text)')}
        onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--text-faint)')}
      >
        登出
      </button>
    </header>
  )
}
