'use client'
import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

const DEMO_ACCOUNTS = [
  { label: '員工 - 陳志明',   role: '員工',   email: 'chen.zhiming@aido.demo',   pwd: 'Aido@2026!' },
  { label: '主管 - 林美華',   role: '主管',   email: 'lin.meihua@aido.demo',     pwd: 'Aido@2026!' },
  { label: 'HR - 張惠芳',    role: 'HR',     email: 'zhang.huifang@aido.demo',  pwd: 'Aido@2026!' },
  { label: 'IT - 黃建宏',    role: 'IT',     email: 'huang.jianhong@aido.demo', pwd: 'Aido@2026!' },
  { label: '財務 - 劉芳儀',   role: '財務',   email: 'liu.fangyi@aido.demo',     pwd: 'Aido@2026!' },
  { label: '經營者 - 王大明', role: '經營者', email: 'wang.daming@aido.demo',    pwd: 'Aido@2026!' },
  { label: '行政 - 吳秀蘭',   role: '行政',   email: 'wu.xiulan@aido.demo',      pwd: 'Aido@2026!' },
  { label: '法務 - 趙文傑',   role: '法務',   email: 'zhao.wenjie@aido.demo',    pwd: 'Aido@2026!' },
  { label: '稽核 - 楊淑芬',   role: '稽核',   email: 'yang.shufen@aido.demo',    pwd: 'Aido@2026!' },
]

const CAPABILITIES = [
  { t: 'BPM Workflow', d: '多關卡簽核流程引擎' },
  { t: 'RBAC Permission', d: '角色權限分級控管' },
  { t: 'Audit Trail', d: '全程可追蹤稽核紀錄' },
]

const LS_CREDS = 'aido_login'
function loadCreds(): { email: string; password: string } | null {
  try {
    const raw = localStorage.getItem(LS_CREDS)
    if (!raw) return null
    const o = JSON.parse(decodeURIComponent(atob(raw)))
    return typeof o?.email === 'string' && typeof o?.password === 'string' ? o : null
  } catch { return null }
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function doLogin(e: string, p: string, persistOverride?: boolean) {
    setLoading(true); setError('')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email: e, password: p })
      if (authError) { setError(authError.message); return }
      const persist = persistOverride ?? remember
      if (persist) { localStorage.setItem(LS_CREDS, btoa(encodeURIComponent(JSON.stringify({ email: e, password: p })))) }
      else { localStorage.removeItem(LS_CREDS) }
      router.push('/dashboard'); router.refresh()
    } catch { setError('登入失敗，請稍後再試') } finally { setLoading(false) }
  }

  useEffect(() => {
    const saved = loadCreds()
    if (saved) { setEmail(saved.email); setPwd(saved.password); setRemember(true) }
    // 只自動填入帳號密碼，不自動登入；使用者需手動按登入
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function handleSubmit(ev: FormEvent) { ev.preventDefault(); doLogin(email, pwd) }
  function loginAs(acc: typeof DEMO_ACCOUNTS[0]) { setEmail(acc.email); setPwd(acc.pwd); doLogin(acc.email, acc.pwd, false) }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: '14px',
    color: 'var(--text)', fontFamily: 'var(--font-geist-mono), monospace',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s ease',
  }

  return (
    <>
      <style>{`
        .login-shell {
          display: flex; justify-content: center; min-height: 100vh;
          background-color: var(--bg);
          background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 38px 38px;
          background-position: center center;
        }
        /* 內容容器置中：寬螢幕內容不拉開，grid 在兩側延伸 */
        .login-inner {
          width: 100%; max-width: 1160px; display: flex; align-items: stretch;
        }
        .login-brand {
          flex: 0 0 45%; position: relative; overflow: hidden;
          padding: 56px 48px; display: flex; flex-direction: column; justify-content: space-between;
        }
        .login-formcol { flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 44px; }
        .login-formwrap { width: 100%; max-width: 360px; }
        .login-mobilelogo { display: none; align-items: center; justify-content: center; gap: 10px; margin-bottom: 24px; }
        @media (max-width: 900px) {
          .login-inner { flex-direction: column; border-left: none; border-right: none; max-width: 460px; }
          .login-brand { display: none; }
          .login-formcol { width: 100%; padding: 32px 20px; }
          .login-mobilelogo { display: flex; }
        }
      `}</style>

      <div className="login-shell">
        <div className="login-inner">
        {/* 左：品牌敘事 (Dossier) */}
        <div className="login-brand">
          <div className="label-mono" style={{ position: 'relative', lineHeight: 2, color: 'var(--text-faint)' }}>
            SYSTEM ACCESS<br />AIDO-ADMIN-PORTAL<br />ROLE-BASED ENTRY · AUDIT ENABLED
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ marginBottom: '20px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/aido-logo-horizontal.png" alt="AiDo 智行" style={{ height: '56px', width: 'auto', display: 'block' }} className="login-logo-img" />
            </div>
            <h1 style={{ fontSize: '30px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1.2, margin: '0 0 14px' }}>
              企業 AI 行政管理平台
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7, margin: '0 0 28px', maxWidth: '360px' }}>
              把簽核、請假、費用、採購、用印與權限控管，集中成一個可追蹤、可稽核的行政入口。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {CAPABILITIES.map(c => (
                <div key={c.t} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
                  <div>
                    <span style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{c.t}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-faint)', marginLeft: '8px' }}>{c.d}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="label-mono" style={{ position: 'relative', color: 'var(--text-faint)' }}>
            © 2026 AiDo · CONFIDENTIAL · INTERNAL USE ONLY
          </div>
        </div>

        {/* 右：登入 */}
        <div className="login-formcol">
          <div className="login-formwrap">
            {/* 手機 logo */}
            <div className="login-mobilelogo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/aido-logo-horizontal.png" alt="AiDo 智行" style={{ height: '46px', width: 'auto' }} />
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <span className="label-mono" style={{ color: 'var(--primary)' }}>● SECURE ACCESS</span>
                <span className="label-mono">RBAC</span>
              </div>

              {error && (
                <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: '16px', fontSize: '13px', color: 'var(--danger)' }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '14px' }}>
                  <div className="label-mono" style={{ marginBottom: '6px' }}>電子郵件</div>
                  <input type="email" id="email" name="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@aido.demo" required style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--primary)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <div className="label-mono" style={{ marginBottom: '6px' }}>密碼</div>
                  <div style={{ position: 'relative' }}>
                    <input type={showPwd ? 'text' : 'password'} id="password" name="password" autoComplete="current-password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••••" required style={{ ...inputStyle, paddingRight: '56px' }}
                      onFocus={e => (e.target.style.borderColor = 'var(--primary)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                    <button type="button" onClick={() => setShowPwd(s => !s)} tabIndex={-1}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '12px', cursor: 'pointer', padding: '4px 6px' }}>
                      {showPwd ? '隱藏' : '顯示'}
                    </button>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={remember} onChange={e => { setRemember(e.target.checked); if (!e.target.checked) { localStorage.removeItem(LS_CREDS) } }} />
                  記住帳號密碼，下次自動填入
                </label>
                <button type="submit" disabled={loading}
                  style={{ width: '100%', background: loading ? 'var(--primary-hover)' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '11px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '-0.01em', transition: 'background 0.15s ease' }}>
                  {loading ? '登入中…' : '登入'}
                </button>
              </form>
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-faint)', textAlign: 'center' }}>
                登入後將依角色載入對應儀表板
              </div>
            </div>

            {/* Demo Role Access — 角色快速登入 */}
            <div style={{ marginTop: '20px' }}>
              <div className="label-mono" style={{ marginBottom: '10px', textAlign: 'center' }}>Demo Role Access · 點選角色快速登入</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {DEMO_ACCOUNTS.map(acc => (
                  <button key={acc.email} onClick={() => loginAs(acc)} disabled={loading}
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', padding: '6px 14px', fontSize: '13px', color: 'var(--text-muted)', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease' }}
                    onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--primary)' } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
                    {acc.role}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  )
}
