import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import SwRegister from '@/components/SwRegister'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Workout',
  description: 'Personal workout tracker',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Workout',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0F0F0F',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen text-white antialiased" style={{ backgroundColor: '#0F0F0F' }}>
        <main className="pb-20">{children}</main>
        <BottomNav />
        <SwRegister />
      </body>
    </html>
  )
}
