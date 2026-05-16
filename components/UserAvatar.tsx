'use client'
import { useUser } from '@/lib/context/UserContext'

export default function UserAvatar() {
  const { user, setShowPicker } = useUser()

  if (!user) return null

  return (
    <button
      onClick={() => setShowPicker(true)}
      className="fixed top-4 right-4 z-[100] w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm active:opacity-70"
      style={{ backgroundColor: user.color, color: '#F5F0E8' }}
      aria-label="Switch user"
    >
      {user.name.charAt(0).toUpperCase()}
    </button>
  )
}
