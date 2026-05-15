'use client'
import { useEffect, useRef, useState } from 'react'

interface ToastProps {
  message: string
  accent?: string
  onDone: () => void
}

export function Toast({ message, accent = '#C4714A', onDone }: ToastProps) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const leave = setTimeout(() => setLeaving(true), 2000)
    const remove = setTimeout(() => onDone(), 2500)
    return () => { clearTimeout(leave); clearTimeout(remove) }
  }, [onDone])

  return (
    <div
      className="fixed left-4 right-4 z-50"
      style={{
        bottom: '5.5rem',
        animation: leaving
          ? 'slide-down-fade 0.4s ease-in forwards'
          : 'slide-up-fade 0.3s ease-out forwards',
      }}
    >
      <div
        className="rounded-2xl px-4 py-3 shadow-lg"
        style={{
          backgroundColor: '#2D2520',
          borderLeft: `3px solid ${accent}`,
          border: '1px solid #3A3228',
          borderLeftColor: accent,
        }}
      >
        <p className="text-sm font-medium" style={{ color: '#F5F0E8' }}>{message}</p>
      </div>
    </div>
  )
}
