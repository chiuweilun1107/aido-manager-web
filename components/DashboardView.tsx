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

export default function DashboardView({ user, shortcuts }: { user: SessionUser; shortcuts: DashConfig[] }) {
  const config = shortcuts
  const [data, setData] = useState<DashData | null>(null)
  const thisYear = new Date().getFullYear()

  useEffect(() => { fetch('/api/dashboard').then(r => r.json()).then(setData) }, [])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">
          歡迎，{user.displayName}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('zh-TW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-2xl font-bold text-blue-600">{data?.pending_approvals_count ?? '—'}</div>
          <div className="text-sm text-gray-500 mt-1">待簽核</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-2xl font-bold text-slate-700">{data?.my_requests?.length ?? '—'}</div>
          <div className="text-sm text-gray-500 mt-1">我的申請</div>
        </div>
        {data?.today_attendance && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-sm font-semibold text-gray-700">今日出勤</div>
            <div className="text-xs text-gray-500 mt-1">
              {data.today_attendance.clock_in_at
                ? new Date(data.today_attendance.clock_in_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
                : '—'}
              {' ~ '}
              {data.today_attendance.clock_out_at
                ? new Date(data.today_attendance.clock_out_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
                : '未退勤'}
            </div>
          </div>
        )}
        {data?.leave_balances?.filter(b => b.period_year === thisYear).slice(0, 1).map(b => (
          <div key={b.period_year} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-green-600">{b.granted_hours - b.used_hours}h</div>
            <div className="text-sm text-gray-500 mt-1">{b.leave_types?.name || '年假'} 剩餘</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {config.map(c => (
          <Link key={c.link} href={c.link}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group">
            <div className="text-sm font-medium text-gray-700 group-hover:text-blue-600">{c.title}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-700">最近申請</h3>
            <Link href="/approvals" className="text-xs text-blue-500 hover:text-blue-700">全部</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data?.my_requests?.length === 0 && <div className="px-4 py-6 text-center text-sm text-gray-400">尚無申請紀錄</div>}
            {data?.my_requests?.map(r => (
              <Link key={r.id} href={`/request/${r.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div>
                  <div className="text-sm font-medium text-gray-700">{r.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{r.request_no}</div>
                </div>
                <span className={`status-badge status-${r.status}`}>{STATUS_MAP[r.status] || r.status}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-700">最新公告</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {data?.announcements?.length === 0 && <div className="px-4 py-6 text-center text-sm text-gray-400">暫無公告</div>}
            {data?.announcements?.map(a => (
              <div key={a.id} className="px-4 py-3">
                <div className="text-sm text-gray-700">{a.title}</div>
                <div className="text-xs text-gray-400 mt-1">{new Date(a.created_at).toLocaleDateString('zh-TW')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
