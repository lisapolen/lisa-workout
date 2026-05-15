'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 flex pb-safe z-50" style={{ backgroundColor: '#1A1A1A' }}>
      <Link
        href="/"
        className={`flex-1 py-4 text-center font-semibold text-lg transition-colors ${
          pathname === '/' ? 'text-[#3B82F6]' : 'text-[#9CA3AF]'
        }`}
      >
        Home
      </Link>
      <Link
        href="/progress"
        className={`flex-1 py-4 text-center font-semibold text-lg transition-colors ${
          pathname.startsWith('/progress') ? 'text-[#3B82F6]' : 'text-[#9CA3AF]'
        }`}
      >
        Progress
      </Link>
    </nav>
  )
}
