import { createClient } from './supabase/client'

/**
 * SSO 框架 — 用 Supabase Auth signInWithOAuth。
 * 完整啟用需 (1) Supabase Dashboard 設定對應 OAuth provider
 * (2) 設 NEXT_PUBLIC_ENABLE_SSO=true。未設定時登入頁不顯示 SSO 按鈕。
 */
export type SsoProvider = 'google' | 'azure'

export const SSO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SSO === 'true'

export const SSO_PROVIDERS: { id: SsoProvider; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'azure', label: 'Microsoft (Azure AD)' },
]

export async function signInWithSso(provider: SsoProvider, next = '/dashboard') {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  })
  if (error) throw error
  return data
}
