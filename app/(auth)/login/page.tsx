'use client'
import { useState, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const DEMO_ACCOUNTS = [
  { label: '員工 - 陳志明', email: 'chen.zhiming@aido.demo', pwd: 'Aido@2026!' },
  { label: '主管 - 林美華', email: 'lin.meihua@aido.demo', pwd: 'Aido@2026!' },
  { label: 'HR - 張惠芳', email: 'zhang.huifang@aido.demo', pwd: 'Aido@2026!' },
  { label: 'IT - 黃建宏', email: 'huang.jianhong@aido.demo', pwd: 'Aido@2026!' },
  { label: '財務 - 劉芳儀', email: 'liu.fangyi@aido.demo', pwd: 'Aido@2026!' },
  { label: '經營者 - 王大明', email: 'wang.daming@aido.demo', pwd: 'Aido@2026!' },
  { label: '行政 - 吳秀蘭', email: 'wu.xiulan@aido.demo', pwd: 'Aido@2026!' },
  { label: '法務 - 趙文傑', email: 'zhao.wenjie@aido.demo', pwd: 'Aido@2026!' },
  { label: '稽核 - 楊淑芬', email: 'yang.shufen@aido.demo', pwd: 'Aido@2026!' },
  { label: '員工2 - 許建國', email: 'xu.jianguo@aido.demo', pwd: 'Aido@2026!' },
  { label: '員工3 - 鄭淑娟', email: 'zheng.shujuan@aido.demo', pwd: 'Aido@2026!' },
  { label: '主管2 - 蔡明哲', email: 'cai.mingzhe@aido.demo', pwd: 'Aido@2026!' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setErr(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd })
    setLoading(false)
    if (error) { setErr(error.message); return }
    router.push('/dashboard')
    router.refresh()
  }

  function fillDemo(acc: typeof DEMO_ACCOUNTS[0]) {
    setEmail(acc.email); setPwd(acc.pwd)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-white mb-1">AiDo <span className="text-blue-400">智行</span></div>
          <div className="text-slate-400 text-sm">企業行政管理平台</div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">登入系統</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電子郵件</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="user@aido.demo"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密碼</label>
              <input
                type="password" value={pwd} onChange={e => setPwd(e.target.value)}
                required placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            {err && <div className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded">{err}</div>}
            <button
              type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? '登入中...' : '登入'}
            </button>
          </form>

          <div className="mt-6">
            <p className="text-xs text-gray-500 mb-2">Demo 帳號（點選自動填入）：</p>
            <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
              {DEMO_ACCOUNTS.map(acc => (
                <button key={acc.email} onClick={() => fillDemo(acc)}
                  className="text-left text-xs px-2 py-1.5 rounded hover:bg-blue-50 text-gray-600 hover:text-blue-700 transition-colors border border-transparent hover:border-blue-100">
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
