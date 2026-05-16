'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function BottomNav() {
  const pathname = usePathname()
  const [plansVisited, setPlansVisited] = useState(true) // true by default to avoid flash on load

  useEffect(() => {
    const visited = !!localStorage.getItem('plans_tab_visited')
    setPlansVisited(visited)
  }, [])

  useEffect(() => {
    if (pathname.startsWith('/plans')) {
      localStorage.setItem('plans_tab_visited', '1')
      setPlansVisited(true)
    }
  }, [pathname])

  const tabs = [
    { href: '/', label: 'Home', active: pathname === '/', color: '#C4714A', showDot: false },
    { href: '/plans', label: 'Plans', active: pathname.startsWith('/plans'), color: '#A87FA8', showDot: !plansVisited },
    { href: '/progress', label: 'Progress', active: pathname.startsWith('/progress'), color: '#C4714A', showDot: false },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex pb-safe z-50" style={{ backgroundColor: '#2D2520', borderTop: '1px solid #3A3228' }}>
      {tabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className="flex-1 pt-3 pb-2 flex flex-col items-center gap-1 font-semibold text-lg transition-colors relative"
          style={{ color: tab.active ? tab.color : '#C4B098' }}
        >
          {tab.label}
          {tab.showDot && (
            <span
              className="absolute top-2 right-1/4 w-2 h-2 rounded-full"
              style={{ backgroundColor: '#A87FA8' }}
            />
          )}
          <span
            className="w-1.5 h-1.5 rounded-full transition-colors"
            style={{ backgroundColor: tab.active ? tab.color : 'transparent' }}
          />
        </Link>
      ))}
    </nav>
  )
}
