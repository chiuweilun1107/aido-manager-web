'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { visibleModules } from '@/lib/modules'
import { ROLE_LABELS } from '@/lib/rbac'
import Icon from '@/components/Icon'

const GROUP_ORDER = ['我的工作區', '差勤', '行政 / 財務', '人資', '治理 / 系統']

export default function Sidebar({ roleCode }: { roleCode: string }) {
  const pathname = usePathname()
  const modules = visibleModules(roleCode)

  const groups: Record<string, typeof modules> = {}
  for (const m of modules) {
    const g = m.group || '其他'
    if (!groups[g]) groups[g] = []
    groups[g].push(m)
  }

  return (
    <aside className="w-[220px] bg-slate-900 text-slate-300 flex flex-col overflow-y-auto">
      <div className="px-4 py-5 border-b border-slate-700">
        <span className="text-white font-bold text-lg">AiDo 智行</span>
        <div className="text-xs text-slate-500 mt-0.5">{ROLE_LABELS[roleCode]}</div>
      </div>

      <nav className="flex-1 py-2">
        <Link href="/dashboard"
          className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${pathname === '/dashboard' ? 'bg-slate-700 text-white' : ''}`}>
          <Icon name="chart-bar-square" size={16} className="shrink-0 opacity-70" />
          首頁
        </Link>

        {GROUP_ORDER.filter(g => groups[g]?.length).map(g => (
          <div key={g}>
            <div className="px-4 pt-4 pb-1 text-xs font-semibold text-slate-500 tracking-wider">{g}</div>
            {groups[g].map(m => {
              const href = `/module/${m.code}`
              const active = pathname.startsWith(href)
              return (
                <Link key={m.code} href={href}
                  className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${active ? 'bg-slate-700 text-white' : ''}`}>
                  <Icon name={m.icon} size={16} className="shrink-0 opacity-70" />
                  <span className="truncate">{m.name}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
