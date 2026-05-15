'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Block, VO2maxLog } from '@/lib/types'

const BLOCK_STYLE: Record<string, string> = {
  strength: 'bg-blue-950/60 border-blue-800',
  cardio:   'bg-red-950/60 border-red-800',
  core:     'bg-green-950/60 border-green-800',
  recovery: 'bg-teal-950/60 border-teal-800',
}

const BLOCK_LABEL: Record<string, string> = {
  strength: 'Strength',
  cardio:   'Cardio',
  core:     'Core',
  recovery: 'Recovery',
}

// VO2max clinical scale
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

  useEffect(() => {
    async function load() {
      const [{ data: blocksData }, { data: vo2Data }, { data: sessionData }] = await Promise.all([
        supabase.from('blocks').select('*').order('sort_order'),
        supabase.from('vo2max_log').select('*').order('date', { ascending: false }).limit(1),
        supabase.from('sessions').select('id, date, blocks(name)').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])

      if (blocksData) setBlocks(blocksData)
      if (vo2Data?.[0]) setVo2max(vo2Data[0])

      if (!sessionData) {
        setLastSession(false)
        return
      }

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

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <div className="px-4 pt-8 max-w-lg mx-auto">
      <p className="text-zinc-400 text-sm">{dateStr}</p>
      <h1 className="text-3xl font-bold mt-1 mb-6">What are you doing today?</h1>

      {/* Block cards */}
      <div className="flex flex-col gap-3 mb-6">
        {blocks.map((block, i) => (
          <Link
            key={block.id}
            href={`/block/${block.id}`}
            className={`flex items-center gap-4 p-5 rounded-2xl border ${BLOCK_STYLE[block.type] ?? 'bg-zinc-900 border-zinc-700'} active:opacity-80`}
          >
            <div className="flex-1">
              <p className="text-xs text-zinc-400 uppercase tracking-wider mb-0.5">
                Block {i + 1} &middot; {BLOCK_LABEL[block.type]}
              </p>
              <p className="text-xl font-bold">{block.name}</p>
            </div>
            <span className="text-zinc-400 text-3xl leading-none">&rsaquo;</span>
          </Link>
        ))}
      </div>

      {/* VO2max widget */}
      {vo2max && (
        <div className="bg-zinc-900 rounded-2xl p-5 mb-4 border border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-zinc-200">VO&#x2082;max</h2>
            <span className="text-xs text-zinc-500">Updated {relativeDate(vo2max.date)}</span>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-5xl font-bold">{vo2max.value}</span>
            <span className="text-zinc-400">/ 34 goal</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-3 mb-1">
            <div
              className="bg-amber-400 h-3 rounded-full transition-all"
              style={{ width: `${vo2Pct(Number(vo2max.value)).toFixed(1)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-zinc-500">23 (low)</span>
            <span className="text-xs text-amber-400">Target: 34</span>
            <span className="text-xs text-zinc-500">40 (athlete)</span>
          </div>
        </div>
      )}

      {/* Last session */}
      {lastSession === false ? (
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 text-center">
          <p className="text-zinc-400">No sessions logged yet &mdash; get started!</p>
        </div>
      ) : lastSession ? (
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Last session</p>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-lg font-semibold">{lastSession.block_name}</p>
            <p className="text-zinc-400 text-sm">{relativeDate(lastSession.date)}</p>
          </div>
          {lastSession.exercises.length > 0 && (
            <div className="space-y-1.5">
              {lastSession.exercises.map((ex, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-zinc-300 text-sm">{ex.name}</span>
                  <span className="text-amber-400 text-sm font-semibold">
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
