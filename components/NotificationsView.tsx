'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { SessionUser } from '@/lib/types'

interface Notif {
  id: number; title: string; body: string; link_url?: string; read_at?: string; created_at: string
}

export default function NotificationsView({ user }: { user: SessionUser }) {
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notifications').then(r => r.json()).then(d => {
      setNotifs(d.notifications || [])
      setLoading(false)
    })
  }, [])

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    setNotifs(n => n.map(x => ({ ...x, read_at: new Date().toISOString() })))
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">通知</h1>
        <button onClick={markAllRead} className="text-sm text-blue-500 hover:text-blue-700">全部標為已讀</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading && <div className="py-12 text-center text-sm text-gray-400">載入中...</div>}
        {!loading && notifs.length === 0 && <div className="py-12 text-center text-sm text-gray-400">沒有通知</div>}
        {!loading && notifs.map(n => (
          <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-gray-50 ${!n.read_at ? 'bg-blue-50/40' : ''}`}>
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read_at ? 'bg-blue-500' : 'bg-gray-200'}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-700">{n.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{n.body}</div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString('zh-TW')}</span>
                {n.link_url && <Link href={n.link_url} className="text-xs text-blue-500 hover:text-blue-700">查看</Link>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
