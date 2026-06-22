'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { visibleModules } from '@/lib/modules'
import { ROLE_LABELS } from '@/lib/rbac'
import Icon from '@/components/Icon'

const GROUP_ORDER = ['我的工作區', '差勤', '行政 / 財務', '人資', '治理 / 系統']

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '7px 12px',
        borderRadius: 'var(--radius)',
        fontSize: '13px',
        fontWeight: active ? 500 : 400,
        color: active ? 'var(--primary)' : 'var(--text-muted)',
        background: active ? 'var(--primary-light)' : 'transparent',
        textDecoration: 'none',
        transition: 'background 0.15s ease, color 0.15s ease',
        marginBottom: '1px',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
        }
      }}
    >
      <Icon name={icon} size={15} className={active ? '' : 'opacity-60'} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </Link>
  )
}

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
    <aside style={{
      width: 'var(--sidebar-w)',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{
        padding: '18px 16px 14px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          AiDo 智行
        </div>
        <div className="label-mono" style={{ marginTop: '3px' }}>
          {ROLE_LABELS[roleCode] || roleCode}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 8px' }}>
        <NavItem href="/dashboard" icon="chart-bar-square" label="首頁" active={pathname === '/dashboard'} />

        {GROUP_ORDER.filter(g => groups[g]?.length).map(g => (
          <div key={g}>
            <div className="label-mono" style={{ padding: '12px 12px 4px', letterSpacing: '0.08em' }}>
              {g}
            </div>
            {groups[g].map(m => {
              const href = `/module/${m.code}`
              return (
                <NavItem
                  key={m.code}
                  href={href}
                  icon={m.icon}
                  label={m.name}
                  active={pathname.startsWith(href)}
                />
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
