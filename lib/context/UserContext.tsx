'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { AppUser } from '@/lib/types'

interface UserContextValue {
  userId: number | null
  user: AppUser | null
  users: AppUser[]
  setUser: (user: AppUser) => void
  showPicker: boolean
  setShowPicker: (v: boolean) => void
}

const UserContext = createContext<UserContextValue>({
  userId: null,
  user: null,
  users: [],
  setUser: () => {},
  showPicker: false,
  setShowPicker: () => {},
})

export function useUser() {
  return useContext(UserContext)
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>([])
  const [user, setUserState] = useState<AppUser | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function init() {
      const { data } = await supabase.from('users').select('*').order('id')
      const userList: AppUser[] = data ?? []
      setUsers(userList)

      const storedId = localStorage.getItem('workout_user_id')
      if (storedId) {
        const found = userList.find(u => u.id === Number(storedId))
        if (found) {
          setUserState(found)
          setLoaded(true)
          return
        }
      }
      // No stored user — show picker
      setShowPicker(true)
      setLoaded(true)
    }
    init()
  }, [])

  function setUser(u: AppUser) {
    setUserState(u)
    localStorage.setItem('workout_user_id', String(u.id))
    setShowPicker(false)
  }

  if (!loaded) return null

  return (
    <UserContext.Provider value={{ userId: user?.id ?? null, user, users, setUser, showPicker, setShowPicker }}>
      {children}
    </UserContext.Provider>
  )
}
