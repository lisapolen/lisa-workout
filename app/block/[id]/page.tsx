'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Block, Exercise } from '@/lib/types'
import { getLocalDate } from '@/lib/utils'
import NeckSafetyModal from '@/components/NeckSafetyModal'
import { StrengthView } from '@/components/StrengthView'

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

// ─── Cardio ──────────────────────────────────────────────────────────────────

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
  const [zone2Count, setZone2Count] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    const d = new Date()
    d.setDate(d.getDate() - 28)
    const cutoff = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const userId = Number(localStorage.getItem('workout_user_id')) || null
    let q = supabase.from('cardio_log').select('id', { count: 'exact', head: true }).eq('type', 'zone2').gte('date', cutoff)
    if (userId) q = q.eq('user_id', userId)
    q.then(({ count }) => { if (count !== null) setZone2Count(count) })
  }, [])

  async function save() {
    if (!selected || saving) return
    setSaving(true)
    try {
      const today = getLocalDate()
      const userId = Number(localStorage.getItem('workout_user_id')) || null
      const { data: session } = await supabase
        .from('sessions')
        .insert({ date: today, block_id: blockId, notes: `${selected} — ${duration} min`, user_id: userId })
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
        user_id: userId,
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
      {zone2Count !== null && (
        <p className="text-sm mb-4" style={{ color: C.muted }}>
          Zone 2 this month: <span style={{ color: BLOCK_ACCENT['Cardio'], fontWeight: 600 }}>{zone2Count} {zone2Count === 1 ? 'session' : 'sessions'}</span>
        </p>
      )}
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
            disabled={saving || !duration}
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

// ─── Recovery ─────────────────────────────────────────────────────────────────

const BODY_AREAS = [
  'Neck & shoulders',
  'Upper back',
  'Hips & glutes',
  'Quads & hamstrings',
  'Calves & ankles',
] as const

type BodyStatus = 'fine' | 'tight' | 'sore'
type SleepStatus = 'good' | 'okay' | 'poor'

const STATUS_COLORS: Record<BodyStatus, string> = {
  fine:  '#6B8F6B',
  tight: '#C4714A',
  sore:  '#C4514A',
}
const SLEEP_COLORS: Record<SleepStatus, string> = {
  good: '#6B8F6B',
  okay: '#C4B098',
  poor: '#C4514A',
}

function RecoveryView({ blockId }: { blockId: number }) {
  const [bodyStatus, setBodyStatus] = useState<Record<string, BodyStatus | null>>({})
  const [sleep, setSleep] = useState<SleepStatus | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  const anyBodySelected = Object.values(bodyStatus).some(v => v !== null && v !== undefined)
  const canSave = anyBodySelected || sleep !== null

  async function save() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const today = getLocalDate()
      const bodyParts = BODY_AREAS
        .filter(a => bodyStatus[a])
        .map(a => `${a}: ${bodyStatus[a]}`)
        .join(', ')
      const sleepStr = sleep ? `Sleep: ${sleep}` : ''
      const parts = [bodyParts, sleepStr].filter(Boolean).join(' — ')
      const summary = [parts, notes].filter(Boolean).join(' — ') || 'Recovery'

      await supabase.from('sessions').insert({
        date: today,
        block_id: blockId,
        notes: summary,
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
      {/* Body status */}
      <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
        <p className="text-xs uppercase tracking-wider mb-4" style={{ color: C.muted }}>Body check-in</p>
        <div className="flex flex-col gap-4">
          {BODY_AREAS.map(area => {
            const current = bodyStatus[area] ?? null
            return (
              <div key={area}>
                <p className="text-sm mb-2" style={{ color: C.text }}>{area}</p>
                <div className="flex gap-2">
                  {(['fine', 'tight', 'sore'] as BodyStatus[]).map(status => {
                    const active = current === status
                    const color = STATUS_COLORS[status]
                    return (
                      <button
                        key={status}
                        onClick={() => setBodyStatus(prev => ({ ...prev, [area]: active ? null : status }))}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors"
                        style={active
                          ? { backgroundColor: `${color}25`, borderColor: color, color }
                          : { backgroundColor: 'transparent', borderColor: C.border, color: C.muted }}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sleep */}
      <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
        <p className="text-sm mb-3" style={{ color: C.text }}>Sleep last night</p>
        <div className="flex gap-2">
          {(['good', 'okay', 'poor'] as SleepStatus[]).map(s => {
            const active = sleep === s
            const color = SLEEP_COLORS[s]
            return (
              <button
                key={s}
                onClick={() => setSleep(active ? null : s)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
                style={active
                  ? { backgroundColor: `${color}25`, borderColor: color, color }
                  : { backgroundColor: 'transparent', borderColor: C.border, color: C.muted }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="text-sm mb-2 block" style={{ color: C.muted }}>Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-xl p-4 outline-none resize-none text-base"
          style={{ backgroundColor: C.card, border: `2px solid ${C.border}`, color: C.text }}
          placeholder="Anything to note?"
        />
      </div>

      <button
        onClick={save}
        disabled={saving || !canSave}
        className="w-full font-bold text-2xl rounded-xl py-5 disabled:opacity-40 active:opacity-80"
        style={{ backgroundColor: C.accent, color: C.text }}
      >
        {saving ? 'Saving...' : 'Log Recovery'}
      </button>
    </div>
  )
}

// ─── Feeling check-in ─────────────────────────────────────────────────────────

type Feeling = 'great' | 'okay' | 'tired'

const FEELING_OPTIONS: { value: Feeling; label: string; desc: string }[] = [
  { value: 'great', label: 'Great',  desc: 'Energized and ready' },
  { value: 'okay',  label: 'Okay',   desc: 'Decent, let\'s go' },
  { value: 'tired', label: 'Tired',  desc: 'Low energy today' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BlockPage() {
  const params = useParams()
  const router = useRouter()
  const blockId = Number(params.id)

  const [block, setBlock] = useState<Block | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [lastWeights, setLastWeights] = useState<Record<number, number | null>>({})
  const [completedCounts, setCompletedCounts] = useState<Record<number, number>>({})
  const [feeling, setFeeling] = useState<Feeling | null>(null)
  const [feelingCheckedIn, setFeelingCheckedIn] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: blockData } = await supabase
        .from('blocks')
        .select('*')
        .eq('id', blockId)
        .single()
      if (blockData) setBlock(blockData)

      // Check feeling for today
      const today = getLocalDate()
      const storedFeeling = localStorage.getItem(`feeling_${blockId}_${today}`) as Feeling | null
      if (storedFeeling) {
        setFeeling(storedFeeling)
        setFeelingCheckedIn(true)
      }

      if (blockData?.type === 'strength' || blockData?.type === 'core') {
        const { data: exData } = await supabase
          .from('exercises')
          .select('*')
          .eq('block_id', blockId)
          .order('sort_order')

        if (exData) {
          setExercises(exData)
          const ids = exData.map((e: Exercise) => e.id)

          const weightResults = await Promise.all(
            ids.map((id: number) =>
              supabase
                .from('sets_log')
                .select('exercise_id, weight')
                .eq('exercise_id', id)
                .not('weight', 'is', null)
                .order('completed_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            )
          )
          const map: Record<number, number | null> = {}
          weightResults.forEach(({ data }) => {
            if (data) map[data.exercise_id] = data.weight
          })
          setLastWeights(map)
        }

        // Completion indicators
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

  function selectFeeling(f: Feeling) {
    const today = getLocalDate()
    localStorage.setItem(`feeling_${blockId}_${today}`, f)
    setFeeling(f)
    setFeelingCheckedIn(true)
  }

  if (!block) {
    return <div className="flex items-center justify-center h-64" style={{ color: C.muted }}>Loading...</div>
  }

  const isUpperBody = block.name === 'Upper Body'
  const accent = BLOCK_ACCENT[block.name] ?? C.accent
  const needsCheckIn = (block.type === 'strength' || block.type === 'core') && !feelingCheckedIn

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      <button onClick={() => router.push('/')} className="text-sm mb-4 flex items-center gap-1" style={{ color: C.muted }}>
        &lsaquo; Home
      </button>
      <h1 className="text-3xl font-bold mb-2" style={{ color: C.text }}>{block.name}</h1>
      <div className="h-1 w-12 rounded-full mb-6" style={{ backgroundColor: accent }} />

      {needsCheckIn ? (
        <div>
          <p className="text-lg font-semibold mb-1" style={{ color: C.text }}>How are you feeling?</p>
          <p className="text-sm mb-6" style={{ color: C.muted }}>Takes a second. Helps the record.</p>
          <div className="flex flex-col gap-3">
            {FEELING_OPTIONS.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => selectFeeling(value)}
                className="w-full rounded-2xl p-5 text-left active:opacity-80"
                style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
              >
                <p className="text-xl font-bold" style={{ color: C.text }}>{label}</p>
                <p className="text-sm" style={{ color: C.muted }}>{desc}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {(block.type === 'strength' || block.type === 'core') && (
            <StrengthView
              exercises={exercises}
              lastWeights={lastWeights}
              completedCounts={completedCounts}
              linkBuilder={(exId) => `/block/${blockId}/exercise/${exId}`}
              isUpperBody={isUpperBody}
              accent={accent}
            />
          )}
          {block.type === 'cardio' && <CardioView blockId={blockId} />}
          {block.type === 'recovery' && <RecoveryView blockId={blockId} />}
        </>
      )}
    </div>
  )
}
