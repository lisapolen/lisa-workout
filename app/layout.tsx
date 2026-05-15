import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import SwRegister from '@/components/SwRegister'

const geist = Geist({ subsets: ['latin'] })

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
  themeColor: '#09090b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.className}>
      <body className="min-h-screen bg-zinc-950 text-white antialiased">
        <main className="pb-20">{children}</main>
        <BottomNav />
        <SwRegister />
      </body>
    </html>
  )
}
