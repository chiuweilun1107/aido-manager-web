'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { SessionUser } from '@/lib/types'

interface ApprovalItem {
  id: number
  request_no: string
  title: string
  module_code: string
  status: string
  created_at: string
  requester_name?: string
}

const CHIP_CLASS: Record<string, string> = {
  draft: 'chip chip--draft',
  in_review: 'chip chip--in_review',
  approved: 'chip chip--approved',
  rejected: 'chip chip--rejected',
  returned: 'chip chip--returned',
  cancelled: 'chip chip--cancelled',
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', in_review: '審核中', approved: '已核准',
  rejected: '已駁回', returned: '退回', cancelled: '已取消',
}

const TABS = [
  { key: 'pending', label: '待我簽核' },
  { key: 'mine',    label: '我的申請' },
]

export default function ApprovalsView({ user }: { user: SessionUser }) {
  const [tab, setTab] = useState<'pending' | 'mine'>('pending')
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/approvals')
      const data = await res.json()
      // API 回 { pending, my_requests }；依分頁取對應清單
      setItems(tab === 'pending' ? (data.pending || []) : (data.my_requests || []))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  return (
    <>
      <style>{`
        .arow { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border); text-decoration: none; transition: background 0.1s ease; }
        .arow:hover { background: var(--surface-2); }
        .arow:last-child { border-bottom: none; }
      `}</style>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Page heading */}
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'var(--text)', letterSpacing: '-0.03em', margin: 0 }}>
            簽核作業
          </h1>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          gap: '2px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '3px',
          width: 'fit-content',
          marginBottom: '16px',
        }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as 'pending' | 'mine')}
              className={tab === t.key ? undefined : 'label-mono'}
              style={{
                padding: '6px 14px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: tab === t.key ? 500 : 400,
                fontFamily: tab === t.key ? 'var(--font-geist-sans), system-ui, sans-serif' : 'var(--font-geist-mono), monospace',
                background: tab === t.key ? 'var(--surface-2)' : 'transparent',
                color: tab === t.key ? 'var(--text)' : 'var(--text-faint)',
                transition: 'all 0.15s ease',
                letterSpacing: tab === t.key ? 'normal' : '0.07em',
                textTransform: tab === t.key ? 'none' : 'uppercase',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '140px 1fr 100px 120px 80px',
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            {['申請編號', '標題', '模組', '狀態', '建立日期'].map(h => (
              <div key={h} className="label-mono">{h}</div>
            ))}
          </div>

          {/* Rows */}
          {loading && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>
              載入中…
            </div>
          )}
          {!loading && items.length === 0 && (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>
              {tab === 'pending' ? '目前沒有待簽核事項' : '尚無申請紀錄'}
            </div>
          )}
          {!loading && items.map(item => (
            <Link
              key={item.id}
              href={`/request/${item.id}`}
              className="arow"
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr 100px 120px 80px',
              }}
            >
              <div style={{
                fontFamily: 'var(--font-geist-mono), monospace',
                fontSize: '12px',
                color: 'var(--text-faint)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {item.request_no}
              </div>
              <div style={{ color: 'var(--text)', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '16px' }}>
                {item.title}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{item.module_code}</div>
              <div>
                <span className={CHIP_CLASS[item.status] || 'chip chip--draft'}>
                  {STATUS_LABEL[item.status] || item.status}
                </span>
              </div>
              <div style={{
                fontFamily: 'var(--font-geist-mono), monospace',
                fontSize: '11px',
                color: 'var(--text-faint)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {new Date(item.created_at).toLocaleDateString('zh-TW')}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
