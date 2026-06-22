'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

const DEMO_ACCOUNTS = [
  { label: '員工 - 陳志明',   email: 'chen.zhiming@aido.demo',   pwd: 'Aido@2026!' },
  { label: '主管 - 林美華',   email: 'lin.meihua@aido.demo',     pwd: 'Aido@2026!' },
  { label: 'HR - 張惠芳',    email: 'zhang.huifang@aido.demo',  pwd: 'Aido@2026!' },
  { label: 'IT - 黃建宏',    email: 'huang.jianhong@aido.demo', pwd: 'Aido@2026!' },
  { label: '財務 - 劉芳儀',   email: 'liu.fangyi@aido.demo',     pwd: 'Aido@2026!' },
  { label: '經營者 - 王大明', email: 'wang.daming@aido.demo',    pwd: 'Aido@2026!' },
  { label: '行政 - 吳秀蘭',   email: 'wu.xiulan@aido.demo',      pwd: 'Aido@2026!' },
  { label: '法務 - 趙文傑',   email: 'zhao.wenjie@aido.demo',    pwd: 'Aido@2026!' },
  { label: '稽核 - 楊淑芬',   email: 'yang.shufen@aido.demo',    pwd: 'Aido@2026!' },
  { label: '員工2 - 許建國',  email: 'xu.jianguo@aido.demo',     pwd: 'Aido@2026!' },
  { label: '員工3 - 鄭淑娟',  email: 'zheng.shujuan@aido.demo',  pwd: 'Aido@2026!' },
  { label: '主管2 - 蔡明哲',  email: 'cai.mingzhe@aido.demo',    pwd: 'Aido@2026!' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function fillDemo(acc: typeof DEMO_ACCOUNTS[0]) {
    setEmail(acc.email)
    setPwd(acc.pwd)
    setError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password: pwd })
      if (authError) { setError(authError.message); return }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('登入失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo block */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/aido-app-icon.png" alt="AiDo 智行" width={60} height={60}
            style={{ borderRadius: '14px', marginBottom: '14px', display: 'inline-block' }} />
          <h1 style={{
            fontSize: '22px', fontWeight: 600, color: 'var(--text)',
            letterSpacing: '-0.03em', lineHeight: 1.2, margin: 0,
          }}>AiDo 智行</h1>
          <p style={{ color: 'var(--text-faint)', fontSize: '13px', marginTop: '4px' }}>
            企業行政管理平台
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          marginBottom: '16px',
        }}>
          {error && (
            <div style={{
              background: 'var(--danger-bg)', border: '1px solid var(--danger)',
              borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: '16px',
              fontSize: '13px', color: 'var(--danger)',
            }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <div className="label-mono" style={{ marginBottom: '6px' }}>電子郵件</div>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="user@aido.demo" required
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: '14px',
                  color: 'var(--text)', fontFamily: 'var(--font-geist-mono), monospace',
                  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s ease',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div className="label-mono" style={{ marginBottom: '6px' }}>密碼</div>
              <input
                type="password" value={pwd} onChange={e => setPwd(e.target.value)}
                placeholder="••••••••" required
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: '14px',
                  color: 'var(--text)', fontFamily: 'var(--font-geist-mono), monospace',
                  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s ease',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', background: loading ? 'var(--primary-hover)' : 'var(--primary)',
                color: '#fff', border: 'none', borderRadius: 'var(--radius)',
                padding: '10px', fontSize: '14px', fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '-0.01em',
                transition: 'background 0.15s ease',
              }}
            >
              {loading ? '登入中…' : '登入'}
            </button>
          </form>
        </div>

        {/* Demo accounts */}
        <div>
          <div className="label-mono" style={{ textAlign: 'center', marginBottom: '10px' }}>
            示範帳號（點選自動填入）
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {DEMO_ACCOUNTS.map(acc => (
              <button
                key={acc.email} onClick={() => fillDemo(acc)}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '8px 10px',
                  textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.15s ease',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
              >
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>{acc.label}</div>
                <div className="label-mono" style={{ marginTop: '2px', fontSize: '10px' }}>
                  {acc.email.split('@')[0]}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
