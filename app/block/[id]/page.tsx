'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Block, Exercise, SetLog } from '@/lib/types'
import NeckSafetyModal from '@/components/NeckSafetyModal'

const C = {
  bg:      '#1C1814',
  card:    '#2D2520',
  border:  '#3A3228',
  text:    '#F5F0E8',
  muted:   '#C4B098',
  accent:  '#C4714A',
  success: '#6B8F6B',
  danger:  '#C4514A',
}

const BLOCK_ACCENT: Record<string, string> = {
  'Lower Body': '#C4714A',
  'Upper Body': '#6B9E8F',
  'Cardio':     '#C4A44A',
  'Core':       '#9E8B6B',
  'Recovery':   '#8A7FA8',
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
      <p className="font-semibold" style={{ color: C.text }}>Protocol</p>
      <p style={{ color: C.muted }}>5 min warmup @ 5.0 MPH</p>
      <p style={{ color: C.muted }}>5x &mdash; 1 min @ 6.5&#8209;7.0 MPH / 2 min @ 5.0 MPH</p>
      <p style={{ color: C.muted }}>5 min cool-down @ 5.0 MPH</p>
      <p className="mt-2 text-xs" style={{ color: C.accent }}>HR peaks in the 170s are fine here</p>
    </div>
  ),
  sustained_run: (
    <div className="space-y-2 text-sm">
      <p className="font-semibold" style={{ color: C.text }}>Protocol</p>
      <p style={{ color: C.muted }}>25&#8209;30 min @ 5.4 MPH steady state</p>
    </div>
  ),
  zone2: (
    <div className="space-y-2 text-sm">
      <p className="font-semibold" style={{ color: C.text }}>Protocol</p>
      <p style={{ color: C.muted }}>Treadmill: 6&#8209;8% incline @ 3.5&#8209;4.0 MPH</p>
      <p style={{ color: C.muted }}>Peloton: easy ride</p>
      <div className="rounded-xl p-3 mt-3" style={{ backgroundColor: 'rgba(196,81,74,0.12)', border: `1px solid ${C.danger}` }}>
        <p className="font-bold text-base" style={{ color: C.danger }}>HR CEILING: STAY UNDER 145 BPM</p>
        <p className="text-xs mt-1" style={{ color: '#E0A09A' }}>If you hit 145, slow down. Target zone: 130&#8209;140 BPM.</p>
      </div>
      <p className="text-xs mt-2" style={{ color: C.muted }}>
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
        <p className="text-5xl mb-4" style={{ color: C.success, animation: 'checkmark-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>&#10003;</p>
        <p className="text-2xl font-bold mb-2" style={{ color: C.success }}>Session logged!</p>
        <button
          onClick={() => router.push('/')}
          className="mt-6 w-full font-bold text-lg rounded-xl py-4"
          style={{ backgroundColor: C.accent, color: C.text }}
        >
          Back to Home
        </button>
        <button
          onClick={() => router.push('/progress')}
          className="mt-3 w-full text-base py-3"
          style={{ color: C.muted }}
        >
          View Progress
        </button>
      </div>
    )
  }

  return (
    <div>
      {!selected ? (
        <div className="flex flex-col gap-3">
          <p className="mb-2" style={{ color: C.muted }}>Choose session type:</p>
          {CARDIO_TYPES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className="w-full rounded-2xl p-5 text-left text-xl font-bold active:opacity-80"
              style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.text }}
            >
              {label}
              <span className="float-right font-normal text-2xl" style={{ color: C.muted }}>&rsaquo;</span>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button onClick={() => setSelected(null)} className="mb-4 text-sm" style={{ color: C.muted }}>
            &lsaquo; Change type
          </button>
          <h2 className="text-xl font-bold mb-4" style={{ color: C.text }}>
            {CARDIO_TYPES.find(t => t.key === selected)?.label}
          </h2>

          <div className="rounded-2xl p-4 mb-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            {PROTOCOLS[selected]}
          </div>

          {selected === 'zone2' && (
            <div className="mb-4">
              <p className="text-sm mb-2" style={{ color: C.muted }}>Equipment</p>
              <div className="flex gap-3">
                {(['treadmill', 'peloton'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubtype(s)}
                    className="flex-1 py-3 rounded-xl font-semibold text-lg border-2 transition-colors"
                    style={subtype === s
                      ? { borderColor: C.accent, color: C.accent }
                      : { borderColor: C.border, color: C.muted }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm mb-2 block" style={{ color: C.muted }}>Duration (minutes)</label>
              <input
                type="number"
                inputMode="numeric"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                placeholder="30"
                className="w-full rounded-xl text-2xl font-bold text-center p-4 outline-none"
                style={{ backgroundColor: C.card, border: `2px solid ${C.border}`, color: C.text }}
              />
            </div>
            <div>
              <label className="text-sm mb-2 block" style={{ color: C.muted }}>Avg HR (bpm)</label>
              <input
                type="number"
                inputMode="numeric"
                value={avgHr}
                onChange={e => setAvgHr(e.target.value)}
                placeholder="135"
                className="w-full rounded-xl text-2xl font-bold text-center p-4 outline-none"
                style={{ backgroundColor: C.card, border: `2px solid ${C.border}`, color: C.text }}
              />
            </div>
            <div>
              <label className="text-sm mb-2 block" style={{ color: C.muted }}>Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl p-4 outline-none resize-none text-base"
                style={{ backgroundColor: C.card, border: `2px solid ${C.border}`, color: C.text }}
                placeholder="How did it feel?"
              />
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full font-bold text-2xl rounded-xl py-5 disabled:opacity-40 active:opacity-80"
            style={{ backgroundColor: C.accent, color: C.text }}
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
        <p className="text-5xl mb-4" style={{ color: C.success, animation: 'checkmark-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>&#10003;</p>
        <p className="text-2xl font-bold mb-2" style={{ color: C.success }}>Recovery logged!</p>
        <button
          onClick={() => router.push('/')}
          className="mt-6 w-full font-bold text-lg rounded-xl py-4"
          style={{ backgroundColor: C.accent, color: C.text }}
        >
          Back to Home
        </button>
        <button
          onClick={() => router.push('/progress')}
          className="mt-3 w-full text-base py-3"
          style={{ color: C.muted }}
        >
          View Progress
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
              ? { borderColor: C.accent, backgroundColor: 'rgba(196,113,74,0.1)', color: C.text }
              : { borderColor: C.border, backgroundColor: C.card, color: C.muted }}
          >
            <span
              className="w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-sm font-bold"
              style={checked.includes(item)
                ? { borderColor: C.accent, backgroundColor: C.accent, color: C.text }
                : { borderColor: C.border }}
            >
              {checked.includes(item) && '✓'}
            </span>
            {item}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <label className="text-sm mb-2 block" style={{ color: C.muted }}>Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-xl p-4 outline-none resize-none text-base"
          style={{ backgroundColor: C.card, border: `2px solid ${C.border}`, color: C.text }}
          placeholder="How did it feel?"
        />
      </div>

      <button
        onClick={save}
        disabled={saving || checked.length === 0}
        className="w-full font-bold text-2xl rounded-xl py-5 disabled:opacity-40 active:opacity-80"
        style={{ backgroundColor: C.accent, color: C.text }}
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
  completedCounts,
  blockId,
  isUpperBody,
  accent,
}: {
  exercises: Exercise[]
  lastWeights: Record<number, number | null>
  completedCounts: Record<number, number>
  blockId: number
  isUpperBody: boolean
  accent: string
}) {
  const [showNeck, setShowNeck] = useState(false)

  return (
    <div>
      {isUpperBody && (
        <button
          onClick={() => setShowNeck(true)}
          className="mb-4 flex items-center gap-2 text-sm font-semibold py-2"
          style={{ color: C.danger }}
        >
          <span className="w-11 h-11 rounded-full border-2 flex items-center justify-center text-base font-bold flex-shrink-0" style={{ borderColor: C.danger }}>!</span>
          Neck Safety Reference
        </button>
      )}

      <div className="flex flex-col gap-3">
        {exercises.map(ex => {
          const lastW = lastWeights[ex.id]
          const isBodyweight = ex.starting_weight === 'Bodyweight'
          const doneCount = completedCounts[ex.id] ?? 0
          const totalSets = ex.sets ?? 0
          const isComplete = doneCount >= totalSets && totalSets > 0
          const isPartial = doneCount > 0 && !isComplete
          return (
            <Link
              key={ex.id}
              href={`/block/${blockId}/exercise/${ex.id}`}
              className="rounded-2xl p-5 active:opacity-80"
              style={{
                backgroundColor: C.card,
                border: `1px solid ${C.border}`,
                borderLeft: `3px ${isPartial ? 'dashed' : 'solid'} ${accent}`,
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-lg font-bold" style={{ color: C.text }}>{ex.name}</p>
                    {ex.neck_flag && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(196,81,74,0.15)', border: `1px solid ${C.danger}`, color: C.danger }}>
                        NECK
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: C.muted }}>{ex.sets} &times; {ex.reps}</p>
                </div>
                <div className="text-right ml-4 flex flex-col items-end gap-1">
                  {/* Weight always shown if available */}
                  {isBodyweight ? (
                    <p className="text-sm" style={{ color: C.muted }}>Bodyweight</p>
                  ) : lastW !== null && lastW !== undefined ? (
                    <p className="font-bold" style={{ color: isComplete ? C.success : accent }}>{lastW} lbs</p>
                  ) : ex.starting_weight ? (
                    <p className="text-sm" style={{ color: C.muted }}>{ex.starting_weight}</p>
                  ) : (
                    <p className="text-xs" style={{ color: C.muted }}>No weight yet</p>
                  )}
                  {/* Completion state below weight */}
                  {isComplete && (
                    <span
                      className="text-xs font-bold"
                      style={{ color: C.success, animation: 'pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
                    >
                      ✓ done
                    </span>
                  )}
                  {isPartial && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${accent}25`, color: accent }}
                    >
                      {doneCount}/{totalSets}
                    </span>
                  )}
                  <span className="text-2xl leading-none" style={{ color: C.border }}>&rsaquo;</span>
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
  const [completedCounts, setCompletedCounts] = useState<Record<number, number>>({})

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

        // Check today's session for completion indicators
        const today = new Date().toISOString().split('T')[0]
        const sessionId = localStorage.getItem(`session_${blockId}_${today}`)
        if (sessionId) {
          const { data: todaySets } = await supabase
            .from('sets_log')
            .select('exercise_id')
            .eq('session_id', Number(sessionId))
          const counts: Record<number, number> = {}
          todaySets?.forEach((s: { exercise_id: number }) => {
            counts[s.exercise_id] = (counts[s.exercise_id] || 0) + 1
          })
          setCompletedCounts(counts)
        }
      }
    }
    load()
  }, [blockId])

  if (!block) {
    return <div className="flex items-center justify-center h-64" style={{ color: C.muted }}>Loading...</div>
  }

  const isUpperBody = block.name === 'Upper Body'
  const accent = BLOCK_ACCENT[block.name] ?? C.accent

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <button onClick={() => router.push('/')} className="text-sm mb-4 flex items-center gap-1" style={{ color: C.muted }}>
        &lsaquo; Home
      </button>
      <h1 className="text-3xl font-bold mb-2" style={{ color: C.text }}>{block.name}</h1>
      <div className="h-1 w-12 rounded-full mb-6" style={{ backgroundColor: accent }} />

      {(block.type === 'strength' || block.type === 'core') && (
        <StrengthView
          exercises={exercises}
          lastWeights={lastWeights}
          completedCounts={completedCounts}
          blockId={blockId}
          isUpperBody={isUpperBody}
          accent={accent}
        />
      )}
      {block.type === 'cardio' && <CardioView blockId={blockId} />}
      {block.type === 'recovery' && <RecoveryView blockId={blockId} />}
    </div>
  )
}
