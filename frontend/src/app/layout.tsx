import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/layout/Providers'

export const metadata: Metadata = {
  title: 'CC-Bill | Personal Finance Intelligence',
  description: 'Personal Credit Card & EMI Financial Intelligence Platform',
  applicationName: 'CC-Bill',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

// Viewport must be exported separately in Next.js 14+ App Router
// themeColor here produces the <meta name="theme-color"> that paints
// the mobile browser chrome (address bar, nav bar) to match our brand
export const viewport: Viewport = {
  themeColor: '#F97316',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
