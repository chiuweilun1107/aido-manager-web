'use client'
import { useEffect, useState } from 'react'
import type { SessionUser } from '@/lib/types'

interface Notification {
  id: number
  title: string
  body?: string
  read_at?: string | null
  created_at: string
  link?: string
}

export default function NotificationsView({ user: _user }: { user: SessionUser }) {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(data => setItems(Array.isArray(data) ? data : data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  async function markRead(id: number) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {})
  }

  async function markAllRead() {
    const now = new Date().toISOString()
    setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at || now })))
    await fetch('/api/notifications/read-all', { method: 'PATCH' }).catch(() => {})
  }

  const unreadCount = items.filter(n => !n.read_at).length

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'var(--text)', letterSpacing: '-0.03em', margin: 0 }}>
            通知
          </h1>
          {unreadCount > 0 && (
            <span className="chip chip--in_review">
              {unreadCount} 未讀
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="label-mono"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--primary)', padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              transition: 'color 0.15s ease',
            }}
          >
            全部標為已讀
          </button>
        )}
      </div>

      {/* Feed */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}>
        {loading && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>
            載入中…
          </div>
        )}
        {!loading && items.length === 0 && (
          <div style={{ padding: '48px 16px', textAlign: 'center' }}>
            <div style={{ color: 'var(--text-faint)', fontSize: '13px' }}>目前沒有通知</div>
          </div>
        )}
        {!loading && items.map((n, i) => {
          const isUnread = !n.read_at
          return (
            <div
              key={n.id}
              onClick={() => isUnread && markRead(n.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px 16px',
                borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                background: isUnread ? 'var(--surface)' : 'transparent',
                cursor: isUnread ? 'pointer' : 'default',
                transition: 'background 0.1s ease',
              }}
              onMouseEnter={e => { if (isUnread) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isUnread ? 'var(--surface)' : 'transparent' }}
            >
              {/* Unread dot */}
              <div style={{ paddingTop: '5px', flexShrink: 0, width: '8px', display: 'flex', justifyContent: 'center' }}>
                {isUnread && (
                  <div style={{
                    width: '6px', height: '6px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--primary)',
                    flexShrink: 0,
                  }} />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: isUnread ? 500 : 400,
                  color: isUnread ? 'var(--text)' : 'var(--text-muted)',
                  lineHeight: 1.4,
                }}>
                  {n.title}
                </div>
                {n.body && (
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--text-faint)',
                    marginTop: '3px',
                    lineHeight: 1.5,
                  }}>
                    {n.body}
                  </div>
                )}
                <div className="label-mono" style={{ marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(n.created_at).toLocaleString('zh-TW', {
                    month: 'numeric', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
