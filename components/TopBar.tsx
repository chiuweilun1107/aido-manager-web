'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { SessionUser } from '@/lib/types'
import Link from 'next/link'

export default function TopBar({ user }: { user: SessionUser }) {
  const [notifCount, setNotifCount] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetch('/api/notifications/count').then(r => r.json()).then(d => setNotifCount(d.count || 0)).catch(() => {})
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="text-gray-600 text-sm">
        {user.departmentName && <span className="text-gray-400 mr-2">{user.departmentName}</span>}
        <span className="font-medium text-gray-800">{user.displayName}</span>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/notifications" className="relative text-sm text-gray-500 hover:text-gray-700">
          通知
          {notifCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </Link>
        <Link href="/approvals" className="text-sm text-gray-500 hover:text-gray-700">待簽核</Link>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">登出</button>
      </div>
    </header>
  )
}
