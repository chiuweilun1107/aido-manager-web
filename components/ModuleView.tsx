'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Module } from '@/lib/modules'
import type { SessionUser } from '@/lib/types'

const STATUS_MAP: Record<string, string> = {
  draft: '草稿', in_review: '審核中', approved: '已核准', rejected: '已駁回', returned: '退回', cancelled: '已取消'
}

interface ModuleViewProps { module: Module; user: SessionUser }

export default function ModuleView({ module: mod, user }: ModuleViewProps) {
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    fetch(`/api/modules/${mod.code}`)
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setLoading(false) })
  }, [mod.code])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true); setErrMsg('')
    const res = await fetch(`/api/modules/${mod.code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setErrMsg(data.error || '送出失敗'); return }
    setShowForm(false)
    setForm({})
    const refreshed = await fetch(`/api/modules/${mod.code}`).then(r => r.json())
    setItems(refreshed.items || [])
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">{mod.name}</h1>
        </div>
        {(mod.kind === 'request' || mod.kind === 'record') && (
          <button onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            {showForm ? '取消' : '新增申請'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">填寫 {mod.name}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mod.fields?.map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {f.type === 'select' ? (
                  <select
                    required={f.required}
                    value={form[f.key] ?? ''}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">請選擇</option>
                    {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea
                    required={f.required}
                    rows={3}
                    value={form[f.key] ?? ''}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <input
                    type={f.type === 'number' || f.type === 'money' ? 'number' : f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : 'text'}
                    required={f.required}
                    placeholder={f.placeholder}
                    value={form[f.key] ?? ''}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            ))}
            {errMsg && <div className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded">{errMsg}</div>}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={submitting}
                className="bg-blue-600 text-white text-sm px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {submitting ? '送出中...' : '送出申請'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setForm({}) }}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700">
            {mod.kind === 'request' ? '我的申請記錄' : '記錄清單'}
          </h3>
        </div>
        {loading && <div className="px-4 py-8 text-center text-sm text-gray-400">載入中...</div>}
        {!loading && items.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">尚無資料</div>
        )}
        {!loading && items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {mod.columns?.map(c => (
                  <th key={c.key} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{c.label}</th>
                ))}
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, idx) => (
                <tr key={String(item.id ?? idx)} className="hover:bg-gray-50">
                  {mod.columns?.map(c => {
                    const val = item[c.key]
                    const display = c.key === 'status'
                      ? <span className={`status-badge status-${String(val)}`}>{STATUS_MAP[String(val)] || String(val ?? '—')}</span>
                      : c.type === 'date' && val
                        ? new Date(String(val)).toLocaleDateString('zh-TW')
                        : String(val ?? '—')
                    return <td key={c.key} className="px-4 py-2.5 text-gray-700">{display}</td>
                  })}
                  <td className="px-4 py-2.5">
                    {mod.kind === 'request' && (
                      <Link href={`/request/${String(item.id)}`} className="text-blue-500 hover:text-blue-700 text-xs">詳情</Link>
                    )}
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
