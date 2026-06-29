'use client'
import { useEffect, useState } from 'react'

interface DirUser { id: number; display_name: string; employee_no?: string; department_name?: string | null }

/** 人員選擇器：從通訊錄載入同公司在職成員，下拉顯示姓名（工號·部門），值存 user id。
 *  取代原本要使用者手填 user id 的純文字輸入（id 看不出是誰）。 */
export default function UserSelect({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) {
  const [users, setUsers] = useState<DirUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/directory')
      .then(r => r.json())
      .then(d => { setUsers(d.members || d.items || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2'
  const inputStyle: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }

  return (
    <select required={required} value={value} className={inputCls} style={inputStyle} onChange={e => onChange(e.target.value)}>
      <option value="">{loading ? '載入中…' : '請選擇人員'}</option>
      {users.map(u => (
        <option key={u.id} value={String(u.id)}>
          {u.display_name}{u.employee_no ? `（${u.employee_no}）` : ''}{u.department_name ? ` · ${u.department_name}` : ''}
        </option>
      ))}
    </select>
  )
}
