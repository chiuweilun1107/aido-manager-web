import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AiDo 智行',
  description: '企業行政管理平台'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
}
