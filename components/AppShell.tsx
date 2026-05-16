'use client'
import { ReactNode } from 'react'
import { UserProvider } from '@/lib/context/UserContext'
import UserPicker from '@/components/UserPicker'
import UserAvatar from '@/components/UserAvatar'

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <UserPicker />
      <UserAvatar />
      {children}
    </UserProvider>
  )
}
