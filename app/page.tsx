'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Block, VO2maxLog } from '@/lib/types'

const C = {
  bg:        '#1C1814',
  card:      '#2D2520',
  border:    '#3A3228',
  text:      '#F5F0E8',
  muted:     '#C4B098',
  accent:    '#C4714A',
  success:   '#6B8F6B',
}

const BLOCK_ACCENT: Record<string, string> = {
  'Lower Body': '#C4714A',
  'Upper Body': '#6B9E8F',
  'Cardio':     '#C4A44A',
  'Core':       '#9E8B6B',
  'Recovery':   '#8A7FA8',
}

const BLOCK_LABEL: Record<string, string> = {
  strength: 'Strength',
  cardio:   'Cardio',
  core:     'Core',
  recovery: 'Recovery',
}

const VO2_MIN = 23
const VO2_MAX = 40
function vo2Pct(value: number): number {
  return Math.max(0, Math.min(100, ((value - VO2_MIN) / (VO2_MAX - VO2_MIN)) * 100))
}

function relativeDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  return `${diff} days ago`
}

interface LastSessionInfo {
  date: string
  block_name: string
  exercises: { name: string; weight: number | null; reps: number | null }[]
}

export default function HomePage() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [vo2max, setVo2max] = useState<VO2maxLog | null>(null)
  const [lastSession, setLastSession] = useState<LastSessionInfo | null | false>(undefined as any)
  const [lastSessionByBlock, setLastSessionByBlock] = useState<Record<number, string>>({})

  useEffect(() => {
    async function load() {
      const [{ data: blocksData }, { data: vo2Data }, { data: sessionData }, { data: allSessions }] = await Promise.all([
        supabase.from('blocks').select('*').order('sort_order'),
        supabase.from('vo2max_log').select('*').order('date', { ascending: false }).limit(1),
        supabase.from('sessions').select('id, date, blocks(name)').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('sessions').select('block_id, date').not('block_id', 'is', null).order('date', { ascending: false }),
      ])

      if (blocksData) setBlocks(blocksData)
      if (vo2Data?.[0]) setVo2max(vo2Data[0])

      const byBlock: Record<number, string> = {}
      allSessions?.forEach((s: any) => {
        if (s.block_id && !byBlock[s.block_id]) byBlock[s.block_id] = s.date
      })
      setLastSessionByBlock(byBlock)

      if (!sessionData) { setLastSession(false); return }

      const s = sessionData as any
      const { data: setsData } = await supabase
        .from('sets_log')
        .select('exercise_id, weight, reps, exercises(name)')
        .eq('session_id', s.id)
        .order('set_number')

      const seen = new Set<number>()
      const exercises: LastSessionInfo['exercises'] = []
      for (const row of setsData ?? []) {
        const r = row as any
        if (!seen.has(r.exercise_id) && exercises.length < 3) {
          seen.add(r.exercise_id)
          exercises.push({ name: r.exercises?.name ?? '', weight: r.weight, reps: r.reps })
        }
      }
      setLastSession({ date: s.date, block_name: s.blocks?.name ?? 'Workout', exercises })
    }
    load()
  }, [])

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="px-4 pt-8 max-w-lg mx-auto">
      <p className="text-sm" style={{ color: C.muted }}>{dateStr}</p>
      <h1 className="text-3xl font-bold mt-1 mb-6" style={{ color: C.text }}>What are you doing today?</h1>

      {/* Block cards */}
      <div className="flex flex-col gap-3 mb-6">
        {blocks.map((block, i) => (
          <Link
            key={block.id}
            href={`/block/${block.id}`}
            className="flex items-center gap-4 p-5 rounded-2xl active:opacity-80"
            style={{ backgroundColor: C.card, borderLeft: `3px solid ${BLOCK_ACCENT[block.name] ?? C.accent}` }}
          >
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: C.muted }}>
                Block {i + 1} &middot; {BLOCK_LABEL[block.type]}
              </p>
              <p className="text-xl font-bold" style={{ color: C.text }}>{block.name}</p>
              {lastSessionByBlock[block.id] && (
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                  Last: {relativeDate(lastSessionByBlock[block.id])}
                </p>
              )}
            </div>
            <span className="text-3xl leading-none" style={{ color: C.muted }}>&rsaquo;</span>
          </Link>
        ))}
      </div>

      {/* VO2max widget */}
      {vo2max && (
        <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold" style={{ color: C.text }}>VO&#x2082;max</h2>
            <span className="text-xs" style={{ color: C.muted }}>Updated {relativeDate(vo2max.date)}</span>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-5xl font-bold" style={{ color: C.text }}>{vo2max.value}</span>
            <span style={{ color: C.muted }}>/ 34 goal</span>
          </div>
          <div className="w-full rounded-full h-3 mb-1" style={{ backgroundColor: C.border }}>
            <div
              className="h-3 rounded-full transition-all"
              style={{ width: `${vo2Pct(Number(vo2max.value)).toFixed(1)}%`, backgroundColor: C.accent }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs" style={{ color: C.muted }}>23 (low)</span>
            <span className="text-xs font-semibold" style={{ color: C.success }}>Target: 34</span>
            <span className="text-xs" style={{ color: C.muted }}>40 (athlete)</span>
          </div>
        </div>
      )}

      {/* Last session */}
      {lastSession === false ? (
        <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <p style={{ color: C.muted }}>No sessions logged yet &mdash; get started!</p>
        </div>
      ) : lastSession ? (
        <div className="rounded-2xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Last session</p>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-lg font-semibold" style={{ color: C.text }}>{lastSession.block_name}</p>
            <p className="text-sm" style={{ color: C.muted }}>{relativeDate(lastSession.date)}</p>
          </div>
          {lastSession.exercises.length > 0 && (
            <div className="space-y-1.5">
              {lastSession.exercises.map((ex, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: C.muted }}>{ex.name}</span>
                  <span className="text-sm font-semibold" style={{ color: C.accent }}>
                    {ex.weight != null ? `${ex.weight} lbs` : 'BW'} &times; {ex.reps}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
