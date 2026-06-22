'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

const DEMO_ACCOUNTS = [
  { email: 'admin@demo.com',     password: 'demo1234', label: '系統管理員' },
  { email: 'hr@demo.com',        password: 'demo1234', label: 'HR 主管' },
  { email: 'employee@demo.com',  password: 'demo1234', label: '一般員工' },
  { email: 'manager@demo.com',   password: 'demo1234', label: '部門主管' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function fillDemo(acc: typeof DEMO_ACCOUNTS[0]) {
    setEmail(acc.email)
    setPassword(acc.password)
    setError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setError(authError.message); return }
      router.push('/dashboard')
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
      <div style={{ width: '100%', maxWidth: '360px' }}>
        {/* Logo block */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px', height: '36px',
            borderRadius: 'var(--radius)',
            background: 'var(--primary)',
            marginBottom: '12px',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 500,
            color: 'var(--text)',
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            margin: 0,
          }}>
            AiDo Manager
          </h1>
          <p style={{ color: 'var(--text-faint)', fontSize: '13px', marginTop: '4px' }}>
            企業簽核管理系統
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
        }}>
          {error && (
            <div style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius)',
              padding: '10px 12px',
              marginBottom: '16px',
              fontSize: '13px',
              color: 'var(--danger)',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <div className="label-mono" style={{ marginBottom: '6px' }}>電子郵件</div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                style={{
                  width: '100%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '8px 12px',
                  fontSize: '14px',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-geist-mono), monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div className="label-mono" style={{ marginBottom: '6px' }}>密碼</div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '8px 12px',
                  fontSize: '14px',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-geist-mono), monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? 'var(--primary-hover)' : 'var(--primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius)',
                padding: '10px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.01em',
                transition: 'background 0.15s ease',
              }}
            >
              {loading ? '登入中…' : '登入'}
            </button>
          </form>
        </div>

        {/* Demo accounts */}
        <div style={{ marginTop: '20px' }}>
          <div className="label-mono" style={{ textAlign: 'center', marginBottom: '10px' }}>
            示範帳號
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {DEMO_ACCOUNTS.map(acc => (
              <button
                key={acc.email}
                onClick={() => fillDemo(acc)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '8px 10px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
              >
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>{acc.label}</div>
                <div className="label-mono" style={{ marginTop: '2px', fontSize: '10px' }}>{acc.email.split('@')[0]}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
