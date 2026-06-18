'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { SessionUser } from '@/lib/types'

const STATUS_MAP: Record<string, string> = {
  in_review: '審核中', approved: '已核准', rejected: '已駁回', returned: '退回', cancelled: '已取消'
}

interface RequestItem {
  id: number; request_no: string; module_code: string; title: string;
  status: string; submitted_at: string; created_at: string
  users?: { display_name: string }
}

export default function ApprovalsView({ user }: { user: SessionUser }) {
  const [pending, setPending] = useState<RequestItem[]>([])
  const [mine, setMine] = useState<RequestItem[]>([])
  const [tab, setTab] = useState<'pending' | 'mine'>('pending')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/approvals').then(r => r.json()).then(d => {
      setPending(d.pending || [])
      setMine(d.my_requests || [])
      setLoading(false)
    })
  }, [])

  const items = tab === 'pending' ? pending : mine

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-800 mb-6">簽核管理</h1>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('pending')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${tab === 'pending' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          待我簽核 {pending.length > 0 && <span className="ml-1 bg-blue-600 text-white text-xs rounded-full px-1.5">{pending.length}</span>}
        </button>
        <button onClick={() => setTab('mine')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${tab === 'mine' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          我的申請
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading && <div className="py-12 text-center text-sm text-gray-400">載入中...</div>}
        {!loading && items.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">
            {tab === 'pending' ? '目前沒有待簽核的單據' : '尚無申請記錄'}
          </div>
        )}
        {!loading && items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">單號</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">主旨</th>
                {tab === 'pending' && <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">申請人</th>}
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">狀態</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">時間</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.request_no}</td>
                  <td className="px-4 py-3 font-medium text-gray-700">{r.title}</td>
                  {tab === 'pending' && (
                    <td className="px-4 py-3 text-gray-500">{r.users?.display_name || '—'}</td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`status-badge status-${r.status}`}>{STATUS_MAP[r.status] || r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('zh-TW') : new Date(r.created_at).toLocaleDateString('zh-TW')}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/request/${r.id}`} className="text-blue-500 hover:text-blue-700 text-xs">檢視</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
