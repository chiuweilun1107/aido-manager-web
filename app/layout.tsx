import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'AiDo 智行 — 企業行政管理平台',
  description: '企業 BPM 簽核管理系統',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

// 在 hydration 前依 theme-mode 先設 dataset.theme，避免深色重整閃白 (FOUC)
const themeInitScript = `(function(){try{var m=localStorage.getItem('theme-mode')||'light';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.dataset.theme='dark';}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
