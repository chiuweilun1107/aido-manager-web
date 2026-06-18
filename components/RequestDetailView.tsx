'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { SessionUser } from '@/lib/types'

const STATUS_MAP: Record<string, string> = {
  draft: '草稿', in_review: '審核中', approved: '已核准', rejected: '已駁回',
  returned: '退回修改', cancelled: '已取消', error: '處理異常'
}
const STEP_STATUS_MAP: Record<string, string> = {
  pending: '等待中', active: '待簽核', approved: '已核准', rejected: '已駁回',
  returned: '退回', skipped: '略過', archived: '已封存'
}
const ACTION_MAP: Record<string, string> = {
  submit: '送出申請', approve: '核准', reject: '駁回', return: '退回修改',
  cancel: '取消', resubmit: '重送', add_step: '加簽', system_approve: '系統核准'
}

type StepRow = {
  id: number; step_no: number; name?: string; status: string; required_mode?: string
  approver_user_id?: number; approver_role_id?: number
  users?: { display_name: string }
  roles?: { name: string }
}
type ActionRow = {
  id: number; action: string; comment?: string; created_at: string
  users?: { display_name: string }
}
type RequestRow = Record<string, unknown> & { payload?: Record<string, unknown> }

interface RequestData {
  request: RequestRow
  steps: StepRow[]
  actions: ActionRow[]
  currentUser: { id: number; primary_role_id?: number; primary_role?: { code: string } }
}

export default function RequestDetailView({ requestId, user }: { requestId: number; user: SessionUser }) {
  const [data, setData] = useState<RequestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  const loadData = () => {
    setLoading(true)
    fetch(`/api/requests/${requestId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }

  useEffect(loadData, [requestId])

  async function handleAction(act: string) {
    if (['reject', 'return'].includes(act) && !comment.trim()) {
      setErrMsg('請填寫意見'); return
    }
    setSubmitting(true); setErrMsg('')
    const res = await fetch(`/api/requests/${requestId}/act`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: act, comment: comment || null })
    })
    const d = await res.json()
    setSubmitting(false)
    if (!res.ok) { setErrMsg(d.error || '操作失敗'); return }
    setComment('')
    loadData()
  }

  if (loading) return <div className="text-center py-16 text-sm text-gray-400">載入中...</div>
  if (!data) return <div className="text-center py-16 text-sm text-red-400">找不到此單據或無權限查看</div>

  const req = data.request
  const payload = (req.payload as Record<string, unknown>) || {}
  const isRequester = data.currentUser.id === Number(req.requester_user_id)
  const canAct = data.steps.some(s => s.status === 'active' &&
    (s.approver_user_id === data.currentUser.id || s.approver_role_id === data.currentUser.primary_role_id))
  const canCancel = isRequester && req.status === 'in_review'
  const canResubmit = isRequester && req.status === 'returned'

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">首頁</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-600">{String(req.title ?? '')}</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">{String(req.title ?? '')}</h1>
            <div className="text-xs text-gray-400 mt-1">{String(req.request_no ?? '')}</div>
          </div>
          <span className={`status-badge status-${String(req.status)}`}>
            {STATUS_MAP[String(req.status)] || String(req.status)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {Object.entries(payload).slice(0, 10).map(([k, v]) => (
            <div key={k}>
              <span className="text-gray-500">{k}：</span>
              <span className="text-gray-800">{String(v ?? '—')}</span>
            </div>
          ))}
          {Boolean(req.amount) && (
            <div>
              <span className="text-gray-500">金額：</span>
              <span className="text-gray-800">{Number(req.amount).toLocaleString()} {String(req.currency || 'TWD')}</span>
            </div>
          )}
          <div>
            <span className="text-gray-500">送出時間：</span>
            <span className="text-gray-800">
              {req.submitted_at ? new Date(String(req.submitted_at)).toLocaleString('zh-TW') : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
        <h2 className="font-semibold text-gray-700 mb-4">簽核流程</h2>
        <div className="space-y-3">
          {data.steps.filter(s => s.status !== 'archived').map((s, i) => (
            <div key={s.id} className={`flex items-center gap-3 p-3 rounded-lg border ${s.status === 'active' ? 'border-blue-200 bg-blue-50' : 'border-gray-100'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${s.status === 'approved' ? 'bg-green-100 text-green-700' : s.status === 'active' ? 'bg-blue-100 text-blue-700' : s.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'}`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700">{s.name || '簽核關卡'}</div>
                <div className="text-xs text-gray-400">
                  {s.users?.display_name || s.roles?.name || '指定人員'}
                </div>
              </div>
              <span className={`status-badge status-${s.status}`}>{STEP_STATUS_MAP[s.status] || s.status}</span>
            </div>
          ))}
        </div>
      </div>

      {data.actions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
          <h2 className="font-semibold text-gray-700 mb-4">審核紀錄</h2>
          <div className="space-y-2">
            {data.actions.map(a => (
              <div key={a.id} className="flex gap-3 text-sm">
                <div className="text-gray-400 flex-shrink-0 w-32 text-xs">
                  {new Date(a.created_at).toLocaleString('zh-TW')}
                </div>
                <div className="flex-1">
                  <span className="font-medium text-gray-700">{a.users?.display_name || '系統'}</span>
                  <span className="text-gray-500 ml-2">{ACTION_MAP[a.action] || a.action}</span>
                  {a.comment && <div className="text-gray-500 mt-0.5 text-xs">{a.comment}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(canAct || canCancel || canResubmit) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-700 mb-4">執行操作</h2>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="審核意見（駁回/退回時必填）"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          />
          {errMsg && <div className="text-red-500 text-sm mb-3">{errMsg}</div>}
          <div className="flex flex-wrap gap-3">
            {canAct && (
              <>
                <button onClick={() => handleAction('approve')} disabled={submitting}
                  className="bg-green-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                  核准
                </button>
                <button onClick={() => handleAction('return')} disabled={submitting}
                  className="bg-yellow-500 text-white text-sm px-5 py-2 rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors">
                  退回修改
                </button>
                <button onClick={() => handleAction('reject')} disabled={submitting}
                  className="bg-red-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                  駁回
                </button>
              </>
            )}
            {canCancel && (
              <button onClick={() => handleAction('cancel')} disabled={submitting}
                className="border border-gray-300 text-gray-600 text-sm px-5 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                取消申請
              </button>
            )}
            {canResubmit && (
              <button onClick={() => handleAction('resubmit')} disabled={submitting}
                className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                重送申請
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
