'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex pb-safe z-50" style={{ backgroundColor: '#252018', borderTop: '1px solid #3A3228' }}>
      <Link
        href="/"
        className="flex-1 py-4 text-center font-semibold text-lg transition-colors"
        style={{ color: pathname === '/' ? '#C4714A' : '#A89880' }}
      >
        Home
      </Link>
      <Link
        href="/progress"
        className="flex-1 py-4 text-center font-semibold text-lg transition-colors"
        style={{ color: pathname.startsWith('/progress') ? '#C4714A' : '#A89880' }}
      >
        Progress
      </Link>
    </nav>
  )
}
