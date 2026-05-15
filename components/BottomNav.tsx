'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex pb-safe z-50">
      <Link
        href="/"
        className={`flex-1 py-4 text-center font-semibold text-lg transition-colors ${
          pathname === '/' ? 'text-amber-400' : 'text-zinc-400'
        }`}
      >
        Home
      </Link>
      <Link
        href="/progress"
        className={`flex-1 py-4 text-center font-semibold text-lg transition-colors ${
          pathname.startsWith('/progress') ? 'text-amber-400' : 'text-zinc-400'
        }`}
      >
        Progress
      </Link>
    </nav>
  )
}
