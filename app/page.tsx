'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Block } from '@/lib/types'
import { getLocalDate, relativeDate } from '@/lib/utils'
import { Toast } from '@/components/Toast'

const C = {
  bg:      '#1C1814',
  card:    '#2D2520',
  border:  '#3A3228',
  text:    '#F5F0E8',
  muted:   '#C4B098',
  accent:  '#C4714A',
  success: '#6B8F6B',
}

export default function HomePage() {
  const [cardioBlockId, setCardioBlockId] = useState<number | null>(null)
  const [lastStrength, setLastStrength] = useState<string | null>(null)
  const [lastCardio, setLastCardio] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; accent?: string } | null>(null)

  useEffect(() => {
    async function load() {
      const today = getLocalDate()

      const [{ data: blocksData }, { data: sessions }] = await Promise.all([
        supabase.from('blocks').select('*').order('sort_order'),
        supabase.from('sessions').select('block_id, plan_id, date, blocks(type)').order('date', { ascending: false }).limit(50),
      ])

      const cardioBlock = (blocksData ?? []).find((b: Block) => b.type === 'cardio')
      if (cardioBlock) setCardioBlockId(cardioBlock.id)

      const strengthTypes = new Set(['strength', 'core', 'recovery'])
      let foundStrength = false
      let foundCardio = false
      for (const s of sessions ?? []) {
        const t = (s as any).blocks?.type
        if (!foundStrength && (s.plan_id || strengthTypes.has(t))) {
          setLastStrength(s.date)
          foundStrength = true
        }
        if (!foundCardio && t === 'cardio') {
          setLastCardio(s.date)
          foundCardio = true
        }
        if (foundStrength && foundCardio) break
      }

      // First-visit easter egg
      const eggs = JSON.parse(localStorage.getItem('easter_eggs') || '{}')
      if (!eggs.first_open) {
        eggs.first_open = true
        localStorage.setItem('easter_eggs', JSON.stringify(eggs))
        if (today) setToast({ message: "Let's get cooking.", accent: C.accent })
      }
    }
    load()
  }, [])

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="px-4 pt-10 pb-28 max-w-lg mx-auto">
      {toast && <Toast message={toast.message} accent={toast.accent} onDone={() => setToast(null)} />}

      <p className="text-sm mb-1" style={{ color: C.muted }}>{dateStr}</p>
      <h1 className="text-3xl font-bold mb-8" style={{ color: C.text }}>What are you doing today?</h1>

      <div className="flex flex-col gap-4">
        {/* Strength */}
        <Link
          href="/strength"
          className="flex items-center justify-between p-6 rounded-2xl active:opacity-80"
          style={{ backgroundColor: C.card, borderLeft: `3px solid ${C.accent}` }}
        >
          <div>
            <p className="text-2xl font-bold mb-0.5" style={{ color: C.text }}>Strength</p>
            <p className="text-sm" style={{ color: C.muted }}>
              {lastStrength ? `Last: ${relativeDate(lastStrength)}` : 'No sessions yet'}
            </p>
          </div>
          <span className="text-3xl leading-none" style={{ color: C.muted }}>&rsaquo;</span>
        </Link>

        {/* Cardio */}
        {cardioBlockId && (
          <Link
            href={`/block/${cardioBlockId}`}
            className="flex items-center justify-between p-6 rounded-2xl active:opacity-80"
            style={{ backgroundColor: C.card, borderLeft: `3px solid #C4A44A` }}
          >
            <div>
              <p className="text-2xl font-bold mb-0.5" style={{ color: C.text }}>Cardio</p>
              <p className="text-sm" style={{ color: C.muted }}>
                {lastCardio ? `Last: ${relativeDate(lastCardio)}` : 'No sessions yet'}
              </p>
            </div>
            <span className="text-3xl leading-none" style={{ color: C.muted }}>&rsaquo;</span>
          </Link>
        )}
      </div>
    </div>
  )
}
