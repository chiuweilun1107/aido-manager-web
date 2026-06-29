'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { SessionUser } from '@/lib/types'
import type { ModuleField } from '@/lib/modules'
import FilePreview from '@/components/FilePreview'
import UserSelect from '@/components/UserSelect'

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
  fields?: ModuleField[]
  steps: StepRow[]
  actions: ActionRow[]
  currentUser: { id: number; primary_role_id?: number; primary_role?: { code: string } }
}

// 把 payload 值正規化成 fileId 陣列（相容單一字串與陣列）
function toFileIds(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(x => String(x)).filter(Boolean)
  if (v === undefined || v === null || v === '') return []
  return [String(v)]
}

export default function RequestDetailView({ requestId, user }: { requestId: number; user: SessionUser }) {
  const [data, setData] = useState<RequestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [showAddStep, setShowAddStep] = useState(false)
  const [addStepUser, setAddStepUser] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, unknown>>({})
  const [userMap, setUserMap] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/directory').then(r => r.json()).then(d => {
      const m: Record<string, string> = {}
      for (const u of (d.members || [])) m[String(u.id)] = u.display_name
      setUserMap(m)
    }).catch(() => {})
  }, [])

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

  // 加簽：現任簽核人指定後續關卡簽核人（後端 bpm.addStep 驗證僅現任簽核人可加簽）
  async function handleAddStep() {
    if (!addStepUser.trim()) { setErrMsg('請輸入加簽對象員工編號'); return }
    setSubmitting(true); setErrMsg('')
    const res = await fetch(`/api/requests/${requestId}/add-step`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: Number(addStepUser), name: '加簽關卡' })
    })
    const d = await res.json()
    setSubmitting(false)
    if (!res.ok) { setErrMsg(d.error || '加簽失敗'); return }
    setAddStepUser(''); setShowAddStep(false); loadData()
  }

  // 退回後修改重送：走 /resubmit 端點（非 /act）；editing 時帶入修改後 payload
  async function handleResubmit() {
    setSubmitting(true); setErrMsg('')
    const res = await fetch(`/api/requests/${requestId}/resubmit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { payload: editForm } : {})
    })
    const d = await res.json()
    setSubmitting(false)
    if (!res.ok) { setErrMsg(d.error || '重送失敗'); return }
    setEditing(false); loadData()
  }

  function startEdit() {
    setEditForm({ ...((data?.request.payload as Record<string, unknown>) || {}) })
    setEditing(true)
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
          {Object.entries(payload).map(([k, v]) => {
            const field = (data.fields ?? []).find(f => f.key === k)
            const fileIds = field?.type === 'file' ? toFileIds(v) : null
            if (fileIds) {
              return (
                <div key={k} className="col-span-2">
                  <span className="text-gray-500 block mb-2">{field?.label || k}：</span>
                  {fileIds.length === 0
                    ? <span className="text-gray-800">—</span>
                    : <div className="flex flex-wrap gap-2">{fileIds.map(id => <FilePreview key={id} fileId={id} showName />)}</div>}
                </div>
              )
            }
            if (field?.type === 'lineitem' && Array.isArray(v)) {
              const cols = field.itemColumns ?? []
              const rows = v as Record<string, unknown>[]
              return (
                <div key={k} className="col-span-2">
                  <span className="text-gray-500 block mb-2">{field.label || k}：</span>
                  {rows.length === 0 ? <span className="text-gray-800">—</span> : (
                    <div className="overflow-x-auto border border-gray-100 rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>{cols.map(c => <th key={c.key} className="px-2 py-1.5 text-left font-medium text-gray-500 whitespace-nowrap">{c.label}</th>)}</tr>
                        </thead>
                        <tbody>
                          {rows.map((row, ri) => (
                            <tr key={ri} className="border-t border-gray-100">
                              {cols.map(c => <td key={c.key} className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{String(row[c.key] ?? '—')}</td>)}
                            </tr>
                          ))}
                          {cols.some(c => c.sum) && (
                            <tr className="border-t-2 border-gray-200 bg-gray-50 font-medium">
                              {cols.map((c, ci) => (
                                <td key={c.key} className="px-2 py-1.5 text-gray-700">
                                  {ci === 0 ? '總計' : c.sum ? rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0).toLocaleString() : ''}
                                </td>
                              ))}
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            }
            const display = field?.type === 'user' && v != null && v !== ''
              ? (userMap[String(v)] || `員工 #${String(v)}`)
              : String(v ?? '—')
            return (
              <div key={k}>
                <span className="text-gray-500">{field?.label || k}：</span>
                <span className="text-gray-800">{display}</span>
              </div>
            )
          })}
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

          {canResubmit && editing && (
            <div className="mb-4 space-y-3 border border-gray-100 rounded-lg p-4 bg-gray-50">
              <div className="text-sm font-medium text-gray-600">修改欄位後重送</div>
              {(data.fields ?? []).filter(f => f.type !== 'file' && f.type !== 'lineitem').map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-500 mb-1">{f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}</label>
                  {f.type === 'user' ? (
                    <UserSelect value={String(editForm[f.key] ?? '')} required={f.required} onChange={v => setEditForm(p => ({ ...p, [f.key]: v }))} />
                  ) : f.type === 'select' ? (
                    <select value={String(editForm[f.key] ?? '')} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="">請選擇</option>
                      {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea rows={2} value={String(editForm[f.key] ?? '')} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  ) : (
                    <input type={f.type === 'number' || f.type === 'money' ? 'number' : f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : 'text'}
                      value={String(editForm[f.key] ?? '')} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  )}
                </div>
              ))}
              <p className="text-xs text-gray-400">附件與明細沿用原內容；如需更改請取消後重新建立申請。</p>
            </div>
          )}

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
                <button onClick={() => setShowAddStep(s => !s)} disabled={submitting}
                  className="border border-gray-300 text-gray-600 text-sm px-5 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                  加簽
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
              <>
                {!editing && (
                  <button onClick={startEdit} disabled={submitting}
                    className="border border-gray-300 text-gray-600 text-sm px-5 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    編輯欄位
                  </button>
                )}
                <button onClick={handleResubmit} disabled={submitting}
                  className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  重送申請
                </button>
              </>
            )}
          </div>
          {canAct && showAddStep && (
            <div className="flex items-center gap-2 mt-3">
              <input value={addStepUser} onChange={e => setAddStepUser(e.target.value)} placeholder="加簽對象員工編號"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-48" />
              <button onClick={handleAddStep} disabled={submitting}
                className="bg-gray-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50">確認加簽</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
