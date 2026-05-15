'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Block, Exercise, SetLog } from '@/lib/types'
import NeckSafetyModal from '@/components/NeckSafetyModal'

const BLOCK_ACCENT: Record<string, string> = {
  'Lower Body': '#3B82F6',
  'Upper Body': '#818CF8',
  'Core':       '#34D399',
}

// ─── Cardio ─────────────────────────────────────────────────────────────────

const CARDIO_TYPES = [
  { key: 'interval_run', label: 'Interval Run' },
  { key: 'sustained_run', label: 'Sustained Run' },
  { key: 'zone2', label: 'Zone 2' },
] as const

type CardioType = 'interval_run' | 'sustained_run' | 'zone2'

const PROTOCOLS: Record<CardioType, React.ReactNode> = {
  interval_run: (
    <div className="space-y-2 text-sm">
      <p className="font-semibold text-white">Protocol</p>
      <p style={{ color: '#9CA3AF' }}>5 min warmup @ 5.0 MPH</p>
      <p style={{ color: '#9CA3AF' }}>5x &mdash; 1 min @ 6.5&#8209;7.0 MPH / 2 min @ 5.0 MPH</p>
      <p style={{ color: '#9CA3AF' }}>5 min cool-down @ 5.0 MPH</p>
      <p className="mt-2 text-xs" style={{ color: '#3B82F6' }}>HR peaks in the 170s are fine here</p>
    </div>
  ),
  sustained_run: (
    <div className="space-y-2 text-sm">
      <p className="font-semibold text-white">Protocol</p>
      <p style={{ color: '#9CA3AF' }}>25&#8209;30 min @ 5.4 MPH steady state</p>
    </div>
  ),
  zone2: (
    <div className="space-y-2 text-sm">
      <p className="font-semibold text-white">Protocol</p>
      <p style={{ color: '#9CA3AF' }}>Treadmill: 6&#8209;8% incline @ 3.5&#8209;4.0 MPH</p>
      <p style={{ color: '#9CA3AF' }}>Peloton: easy ride</p>
      <div className="rounded-xl p-3 mt-3" style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid #EF4444' }}>
        <p className="font-bold text-base" style={{ color: '#EF4444' }}>HR CEILING: STAY UNDER 145 BPM</p>
        <p className="text-xs mt-1" style={{ color: '#FCA5A5' }}>If you hit 145, slow down. Target zone: 130&#8209;140 BPM.</p>
      </div>
      <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
        On high allergy/asthma days: back off pace, do not chase the HR number.
      </p>
    </div>
  ),
}

function CardioView({ blockId }: { blockId: number }) {
  const [selected, setSelected] = useState<CardioType | null>(null)
  const [subtype, setSubtype] = useState<'treadmill' | 'peloton'>('treadmill')
  const [duration, setDuration] = useState('')
  const [avgHr, setAvgHr] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  async function save() {
    if (!selected || saving) return
    setSaving(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: session } = await supabase
        .from('sessions')
        .insert({ date: today, block_id: blockId, notes: `${selected} — ${duration} min` })
        .select('id')
        .single()

      await supabase.from('cardio_log').insert({
        date: today,
        session_id: session?.id ?? null,
        type: selected,
        subtype: selected === 'zone2' ? subtype : null,
        duration_minutes: duration ? Number(duration) : null,
        avg_hr: avgHr ? Number(avgHr) : null,
        notes: notes || null,
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="text-center py-16">
        <p className="text-5xl mb-4">&#10003;</p>
        <p className="text-2xl font-bold text-green-400 mb-2">Session logged!</p>
        <button onClick={() => router.push('/')} className="mt-6 text-white font-bold text-lg rounded-xl py-4 px-8" style={{ backgroundColor: '#1A1A1A' }}>
          Home
        </button>
      </div>
    )
  }

  return (
    <div>
      {!selected ? (
        <div className="flex flex-col gap-3">
          <p className="mb-2" style={{ color: '#9CA3AF' }}>Choose session type:</p>
          {CARDIO_TYPES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className="w-full rounded-2xl p-5 text-left text-xl font-bold text-white active:opacity-80"
              style={{ backgroundColor: '#1A1A1A', border: '1px solid #374151' }}
            >
              {label}
              <span className="float-right font-normal text-2xl" style={{ color: '#9CA3AF' }}>&rsaquo;</span>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button onClick={() => setSelected(null)} className="mb-4 text-sm" style={{ color: '#9CA3AF' }}>
            &lsaquo; Change type
          </button>
          <h2 className="text-xl font-bold mb-4 text-white">
            {CARDIO_TYPES.find(t => t.key === selected)?.label}
          </h2>

          <div className="rounded-2xl p-4 mb-5" style={{ backgroundColor: '#1A1A1A', border: '1px solid #374151' }}>
            {PROTOCOLS[selected]}
          </div>

          {selected === 'zone2' && (
            <div className="mb-4">
              <p className="text-sm mb-2" style={{ color: '#9CA3AF' }}>Equipment</p>
              <div className="flex gap-3">
                {(['treadmill', 'peloton'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubtype(s)}
                    className="flex-1 py-3 rounded-xl font-semibold text-lg border-2 transition-colors"
                    style={subtype === s
                      ? { borderColor: '#3B82F6', color: '#3B82F6' }
                      : { borderColor: '#374151', color: '#9CA3AF' }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm mb-2 block" style={{ color: '#9CA3AF' }}>Duration (minutes)</label>
              <input
                type="number"
                inputMode="numeric"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                placeholder="30"
                className="w-full rounded-xl text-2xl font-bold text-center p-4 outline-none text-white"
                style={{ backgroundColor: '#1A1A1A', border: '2px solid #374151' }}
              />
            </div>
            <div>
              <label className="text-sm mb-2 block" style={{ color: '#9CA3AF' }}>Avg HR (bpm)</label>
              <input
                type="number"
                inputMode="numeric"
                value={avgHr}
                onChange={e => setAvgHr(e.target.value)}
                placeholder="135"
                className="w-full rounded-xl text-2xl font-bold text-center p-4 outline-none text-white"
                style={{ backgroundColor: '#1A1A1A', border: '2px solid #374151' }}
              />
            </div>
            <div>
              <label className="text-sm mb-2 block" style={{ color: '#9CA3AF' }}>Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl p-4 outline-none resize-none text-base text-white"
                style={{ backgroundColor: '#1A1A1A', border: '2px solid #374151' }}
                placeholder="How did it feel?"
              />
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full text-white font-bold text-2xl rounded-xl py-5 disabled:opacity-40 active:opacity-80"
            style={{ backgroundColor: '#3B82F6' }}
          >
            {saving ? 'Saving...' : 'Log Session'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Recovery ────────────────────────────────────────────────────────────────

const RECOVERY_OPTIONS = ['Easy Peloton ride', 'Long dog walk', 'Stretching']

function RecoveryView({ blockId }: { blockId: number }) {
  const [checked, setChecked] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  function toggle(item: string) {
    setChecked(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item])
  }

  async function save() {
    if (saving) return
    setSaving(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const summary = checked.length ? checked.join(', ') : 'Recovery'
      await supabase.from('sessions').insert({
        date: today,
        block_id: blockId,
        notes: notes ? `${summary} — ${notes}` : summary,
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="text-center py-16">
        <p className="text-5xl mb-4">&#10003;</p>
        <p className="text-2xl font-bold text-green-400 mb-2">Recovery logged!</p>
        <button onClick={() => router.push('/')} className="mt-6 text-white font-bold text-lg rounded-xl py-4 px-8" style={{ backgroundColor: '#1A1A1A' }}>
          Home
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6">
        {RECOVERY_OPTIONS.map(item => (
          <button
            key={item}
            onClick={() => toggle(item)}
            className="flex items-center gap-4 p-5 rounded-2xl border-2 text-left text-lg font-semibold transition-colors"
            style={checked.includes(item)
              ? { borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)', color: '#fff' }
              : { borderColor: '#374151', backgroundColor: '#1A1A1A', color: '#9CA3AF' }}
          >
            <span
              className="w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-sm font-bold"
              style={checked.includes(item)
                ? { borderColor: '#3B82F6', backgroundColor: '#3B82F6', color: '#fff' }
                : { borderColor: '#374151' }}
            >
              {checked.includes(item) && '✓'}
            </span>
            {item}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <label className="text-sm mb-2 block" style={{ color: '#9CA3AF' }}>Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-xl p-4 outline-none resize-none text-base text-white"
          style={{ backgroundColor: '#1A1A1A', border: '2px solid #374151' }}
          placeholder="How did it feel?"
        />
      </div>

      <button
        onClick={save}
        disabled={saving || checked.length === 0}
        className="w-full text-white font-bold text-2xl rounded-xl py-5 disabled:opacity-40 active:opacity-80"
        style={{ backgroundColor: '#3B82F6' }}
      >
        {saving ? 'Saving...' : 'Log Recovery'}
      </button>
    </div>
  )
}

// ─── Strength / Core ─────────────────────────────────────────────────────────

function StrengthView({
  exercises,
  lastWeights,
  blockId,
  isUpperBody,
  accentColor,
}: {
  exercises: Exercise[]
  lastWeights: Record<number, number | null>
  blockId: number
  isUpperBody: boolean
  accentColor: string
}) {
  const [showNeck, setShowNeck] = useState(false)

  return (
    <div>
      {isUpperBody && (
        <button
          onClick={() => setShowNeck(true)}
          className="mb-4 flex items-center gap-2 text-sm font-semibold"
          style={{ color: '#EF4444' }}
        >
          <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold" style={{ borderColor: '#EF4444' }}>!</span>
          Neck Safety Reference
        </button>
      )}

      <div className="flex flex-col gap-3">
        {exercises.map(ex => {
          const lastW = lastWeights[ex.id]
          const isBodyweight = ex.starting_weight === 'Bodyweight'
          return (
            <Link
              key={ex.id}
              href={`/block/${blockId}/exercise/${ex.id}`}
              className="rounded-2xl p-5 active:opacity-80"
              style={{
                backgroundColor: '#1A1A1A',
                borderLeft: `3px solid ${accentColor}`,
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-lg font-bold text-white">{ex.name}</p>
                    {ex.neck_flag && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid #EF4444', color: '#EF4444' }}>
                        NECK
                      </span>
                    )}
                    {isUpperBody && !ex.neck_flag && (
                      <button
                        onClick={(e) => { e.preventDefault(); setShowNeck(true) }}
                        className="w-5 h-5 rounded-full border text-xs flex items-center justify-center leading-none"
                        style={{ borderColor: '#EF4444', color: '#EF4444' }}
                      >
                        !
                      </button>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: '#9CA3AF' }}>{ex.sets} &times; {ex.reps}</p>
                </div>
                <div className="text-right ml-4">
                  {isBodyweight ? (
                    <p className="text-sm" style={{ color: '#9CA3AF' }}>Bodyweight</p>
                  ) : lastW !== null && lastW !== undefined ? (
                    <p className="font-bold" style={{ color: '#3B82F6' }}>{lastW} lbs</p>
                  ) : ex.starting_weight ? (
                    <p className="text-sm" style={{ color: '#9CA3AF' }}>{ex.starting_weight}</p>
                  ) : (
                    <p className="text-xs" style={{ color: '#6B7280' }}>No weight yet</p>
                  )}
                  <span className="text-2xl leading-none" style={{ color: '#6B7280' }}>&rsaquo;</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {showNeck && <NeckSafetyModal onClose={() => setShowNeck(false)} />}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BlockPage() {
  const params = useParams()
  const router = useRouter()
  const blockId = Number(params.id)

  const [block, setBlock] = useState<Block | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [lastWeights, setLastWeights] = useState<Record<number, number | null>>({})

  useEffect(() => {
    async function load() {
      const { data: blockData } = await supabase
        .from('blocks')
        .select('*')
        .eq('id', blockId)
        .single()
      if (blockData) setBlock(blockData)

      if (blockData?.type === 'strength' || blockData?.type === 'core') {
        const { data: exData } = await supabase
          .from('exercises')
          .select('*')
          .eq('block_id', blockId)
          .order('sort_order')

        if (exData) {
          setExercises(exData)
          const ids = exData.map((e: Exercise) => e.id)
          const { data: sets } = await supabase
            .from('sets_log')
            .select('exercise_id, weight, completed_at')
            .in('exercise_id', ids)
            .order('completed_at', { ascending: false })
            .limit(200)

          const map: Record<number, number | null> = {}
          sets?.forEach((s: { exercise_id: number; weight: number | null }) => {
            if (!(s.exercise_id in map)) map[s.exercise_id] = s.weight
          })
          setLastWeights(map)
        }
      }
    }
    load()
  }, [blockId])

  if (!block) {
    return <div className="flex items-center justify-center h-64" style={{ color: '#9CA3AF' }}>Loading...</div>
  }

  const isUpperBody = block.name === 'Upper Body'
  const accentColor = BLOCK_ACCENT[block.name] ?? '#3B82F6'

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <button onClick={() => router.push('/')} className="text-sm mb-4 flex items-center gap-1" style={{ color: '#9CA3AF' }}>
        &lsaquo; Home
      </button>
      <h1 className="text-3xl font-bold mb-6 text-white">{block.name}</h1>

      {(block.type === 'strength' || block.type === 'core') && (
        <StrengthView
          exercises={exercises}
          lastWeights={lastWeights}
          blockId={blockId}
          isUpperBody={isUpperBody}
          accentColor={accentColor}
        />
      )}
      {block.type === 'cardio' && <CardioView blockId={blockId} />}
      {block.type === 'recovery' && <RecoveryView blockId={blockId} />}
    </div>
  )
}
