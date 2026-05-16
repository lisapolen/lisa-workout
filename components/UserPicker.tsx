'use client'
import { useUser } from '@/lib/context/UserContext'

const C = {
  bg:   '#1C1814',
  card: '#2D2520',
  border: '#3A3228',
  text: '#F5F0E8',
  muted: '#C4B098',
}

export default function UserPicker() {
  const { users, setUser, showPicker } = useUser()

  if (!showPicker) return null

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-[200] px-6"
      style={{ backgroundColor: C.bg }}
    >
      <h1 className="text-3xl font-bold mb-2" style={{ color: C.text }}>Who&rsquo;s cooking?</h1>
      <p className="text-sm mb-12" style={{ color: C.muted }}>Your data is kept separate</p>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        {users.map(u => (
          <button
            key={u.id}
            onClick={() => setUser(u)}
            className="flex items-center gap-4 p-5 rounded-2xl text-left active:opacity-80"
            style={{ backgroundColor: C.card, border: `2px solid ${u.color}` }}
          >
            <span
              className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0"
              style={{ backgroundColor: u.color, color: C.text }}
            >
              {u.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-xl font-semibold" style={{ color: C.text }}>{u.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
