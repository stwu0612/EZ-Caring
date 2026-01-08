import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PX 體適能測試系統',
  description: '體適能測試管理平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
}
