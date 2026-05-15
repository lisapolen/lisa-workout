'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Exercise, SetLog } from '@/lib/types'
import NeckSafetyModal from '@/components/NeckSafetyModal'
import { Toast } from '@/components/Toast'

const C = {
  bg:       '#1C1814',
  card:     '#2D2520',
  border:   '#3A3228',
  text:     '#F5F0E8',
  muted:    '#C4B098',
  accent:   '#C4714A',
  success:  '#6B8F6B',
  danger:   '#C4514A',
}

const BLOCK_ACCENT: Record<string, string> = {
  'Lower Body': '#C4714A',
  'Upper Body': '#6B9E8F',
  'Cardio':     '#C4A44A',
  'Core':       '#9E8B6B',
  'Recovery':   '#8A7FA8',
}

const REST_TARGET: Record<string, number> = {
  'Lower Body': 120,
  'Upper Body': 90,
  'Core':       60,
}

const MOTIVATION = [
  'Strong work today.',
  "That's another one.",
  'Your future self says thanks.',
  'Rest well. You earned it.',
  'Consistency compounds.',
  'Showed up. Did the work.',
  'Nothing fancy. Just progress.',
  'One more block done.',
  'Every set counts.',
  'Keep the habit.',
  "You didn't skip.",
  'Quietly getting stronger.',
  'Stack the days.',
  "That's what it looks like.",
  'No drama. Just done.',
  'Same time next week.',
  'Brick by brick.',
  'The work adds up.',
  'Done is done.',
  'Good session.',
]

function parseTargetReps(repsStr: string | null): number {
  if (!repsStr) return 0
  const match = repsStr.match(/\d+/)
  return match ? parseInt(match[0]) : 0
}

function parseStartingWeight(sw: string | null): string {
  if (!sw || sw === 'Bodyweight') return ''
  const match = sw.match(/[\d.]+/)
  return match ? match[0] : ''
}

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function getEasterEggs(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem('easter_eggs') || '{}') } catch { return {} }
}
function markEasterEgg(key: string) {
  const eggs = getEasterEggs()
  eggs[key] = true
  localStorage.setItem('easter_eggs', JSON.stringify(eggs))
}

interface StepperProps {
  label: string
  value: string
  onChange: (v: string) => void
  step: number
  min?: number
  unit?: string
}

function Stepper({ label, value, onChange, step, min = 0, unit }: StepperProps) {
  function adjust(delta: number) {
    const current = parseFloat(value) || 0
    const next = Math.max(min, Math.round((current + delta) * 100) / 100)
    onChange(String(next))
  }

  return (
    <div>
      <label className="text-sm mb-2 block" style={{ color: C.muted }}>
        {label}{unit && <span className="ml-1" style={{ color: C.border }}>({unit})</span>}
      </label>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onPointerDown={() => adjust(-step)}
          className="w-16 rounded-2xl text-3xl font-bold flex items-center justify-center select-none active:opacity-70"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.text }}
        >
          -
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 rounded-xl text-4xl font-bold text-center py-4 outline-none"
          style={{ backgroundColor: C.card, border: `2px solid ${C.border}`, color: C.text }}
        />
        <button
          type="button"
          onPointerDown={() => adjust(step)}
          className="w-16 rounded-2xl text-3xl font-bold flex items-center justify-center select-none active:opacity-70"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.text }}
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function SetLoggerPage() {
  const params = useParams()
  const router = useRouter()
  const blockId = Number(params.id)
  const exerciseId = Number(params.exerciseId)

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [blockName, setBlockName] = useState('')
  const [isUpperBody, setIsUpperBody] = useState(false)
  const [lastWeight, setLastWeight] = useState<number | null | undefined>(undefined)
  const [currentSet, setCurrentSet] = useState(1)
  const [completedSets, setCompletedSets] = useState<SetLog[]>([])
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [saving, setSaving] = useState(false)
  const [showNeck, setShowNeck] = useState(false)
  const [error, setError] = useState('')
  const [showOverloadPrompt, setShowOverloadPrompt] = useState(false)
  const [overloadShimmered, setOverloadShimmered] = useState(false)

  // Rest timer
  const [restStartTime, setRestStartTime] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  // Undo
  const [undoableSetId, setUndoableSetId] = useState<number | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Micro-animation
  const [animatingSetId, setAnimatingSetId] = useState<number | null>(null)

  // Toast / easter egg
  const [toast, setToast] = useState<{ message: string; accent: string } | null>(null)

  // Success screen motivation
  const [motivation] = useState(() => MOTIVATION[Math.floor(Math.random() * MOTIVATION.length)])

  useEffect(() => {
    async function load() {
      const { data: ex } = await supabase.from('exercises').select('*').eq('id', exerciseId).single()
      if (!ex) return
      setExercise(ex)

      const targetReps = parseTargetReps(ex.reps)
      if (targetReps > 0) setReps(String(targetReps))

      const { data: blk } = await supabase.from('blocks').select('name').eq('id', ex.block_id).single()
      if (blk?.name) {
        setBlockName(blk.name)
        if (blk.name === 'Upper Body') setIsUpperBody(true)
      }

      const { data: lastSet } = await supabase
        .from('sets_log').select('weight').eq('exercise_id', exerciseId)
        .not('weight', 'is', null).order('completed_at', { ascending: false }).limit(1).maybeSingle()

      if (lastSet?.weight != null) {
        setLastWeight(lastSet.weight)
        setWeight(String(lastSet.weight))
      } else {
        setLastWeight(null)
        const startingDefault = parseStartingWeight(ex.starting_weight)
        if (startingDefault) setWeight(startingDefault)
      }
    }
    load()
  }, [exerciseId])

  // Rest timer tick
  useEffect(() => {
    if (!restStartTime) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - restStartTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [restStartTime])

  async function getOrCreateSession(): Promise<number> {
    const today = new Date().toISOString().split('T')[0]
    const key = `session_${blockId}_${today}`
    const stored = localStorage.getItem(key)
    if (stored) return Number(stored)
    const { data, error } = await supabase.from('sessions').insert({ date: today, block_id: blockId }).select('id').single()
    if (error || !data) throw new Error('Could not create session')
    localStorage.setItem(key, String(data.id))
    return data.id
  }

  async function checkOverload(loggedWeight: number) {
    if (!exercise) return
    const targetReps = parseTargetReps(exercise.reps)
    if (targetReps === 0) return
    const dismissKey = `overload_dismissed_${exerciseId}_${loggedWeight}`
    if (localStorage.getItem(dismissKey)) return
    const today = new Date().toISOString().split('T')[0]
    const currentSessionId = localStorage.getItem(`session_${blockId}_${today}`)
    const { data: allSets } = await supabase
      .from('sets_log').select('session_id, weight, reps').eq('exercise_id', exerciseId)
      .not('weight', 'is', null).order('completed_at', { ascending: false }).limit(100)
    if (!allSets) return
    const prevSessions: Record<number, { weight: number; reps: number | null }[]> = {}
    for (const s of allSets) {
      if (String(s.session_id) === currentSessionId) continue
      if (!prevSessions[s.session_id]) prevSessions[s.session_id] = []
      prevSessions[s.session_id].push({ weight: Number(s.weight), reps: s.reps })
    }
    const prevIds = Object.keys(prevSessions)
    if (prevIds.length < 2) return
    const qualified = prevIds.slice(0, 2).every(sid =>
      prevSessions[Number(sid)].every(s => s.weight === loggedWeight && (s.reps ?? 0) >= targetReps)
    )
    if (qualified) {
      setShowOverloadPrompt(true)
      navigator.vibrate?.([50, 30, 50, 30, 100])
    }
  }

  function maybeFireEasterEgg(loggedWeight: number | null) {
    const eggs = getEasterEggs()
    const hour = new Date().getHours()
    const today = new Date().toISOString().split('T')[0]
    const blockAccent = BLOCK_ACCENT[blockName] ?? C.accent

    if (!eggs.first_set && lastWeight === null && completedSets.length === 0) {
      markEasterEgg('first_set')
      setToast({ message: 'And so it begins.', accent: blockAccent })
      return
    }
    if (!eggs[`early_bird_${today}`] && hour < 6) {
      markEasterEgg(`early_bird_${today}`)
      setToast({ message: 'Up before the sun.', accent: blockAccent })
      return
    }
    if (!eggs[`night_owl_${today}`] && hour >= 21) {
      markEasterEgg(`night_owl_${today}`)
      setToast({ message: 'Night owl gains.', accent: blockAccent })
      return
    }
    if (loggedWeight === 135 && !eggs.plates_135) {
      markEasterEgg('plates_135')
      setToast({ message: 'A plate on each side.', accent: blockAccent })
      return
    }
    if (loggedWeight === 225 && !eggs.plates_225) {
      markEasterEgg('plates_225')
      setToast({ message: 'Two plates. Respect.', accent: blockAccent })
      return
    }
    if (loggedWeight === 315 && !eggs.plates_315) {
      markEasterEgg('plates_315')
      setToast({ message: 'Three plates. Seriously.', accent: blockAccent })
      return
    }
    if (loggedWeight === 100 && !eggs.round_100) {
      markEasterEgg('round_100')
      setToast({ message: 'Nice round number.', accent: blockAccent })
      return
    }
  }

  async function logSet() {
    if (!exercise || saving) return
    const isBodyweight = exercise.starting_weight === 'Bodyweight'
    if (!isBodyweight && !weight) return
    if (!reps) return
    setSaving(true)
    setError('')
    try {
      const sessionId = await getOrCreateSession()
      const loggedWeight = isBodyweight ? null : Number(weight)
      const { data, error: insertError } = await supabase
        .from('sets_log')
        .insert({ session_id: sessionId, exercise_id: exerciseId, set_number: currentSet, weight: loggedWeight, reps: Number(reps) })
        .select().single()
      if (insertError) throw insertError

      setCompletedSets(prev => [...prev, data])
      setCurrentSet(prev => prev + 1)

      // Micro-celebration
      navigator.vibrate?.(50)
      setAnimatingSetId(data.id)
      setTimeout(() => setAnimatingSetId(null), 400)

      // Undo window
      setUndoableSetId(data.id)
      if (undoTimer.current) clearTimeout(undoTimer.current)
      undoTimer.current = setTimeout(() => setUndoableSetId(null), 8000)

      // Rest timer
      setRestStartTime(Date.now())
      setElapsed(0)

      // Easter eggs
      maybeFireEasterEgg(loggedWeight)

      if (loggedWeight != null) await checkOverload(loggedWeight)
    } catch {
      setError('Failed to save — check connection')
    } finally {
      setSaving(false)
    }
  }

  async function undoSet() {
    if (!undoableSetId) return
    await supabase.from('sets_log').delete().eq('id', undoableSetId)
    setCompletedSets(prev => prev.filter(s => s.id !== undoableSetId))
    setCurrentSet(prev => prev - 1)
    setUndoableSetId(null)
    setRestStartTime(null)
    if (undoTimer.current) clearTimeout(undoTimer.current)
  }

  function dismissOverload() {
    localStorage.setItem(`overload_dismissed_${exerciseId}_${Number(weight)}`, '1')
    setShowOverloadPrompt(false)
  }

  if (!exercise) {
    return <div className="flex items-center justify-center h-screen" style={{ color: C.muted }}>Loading...</div>
  }

  const isBodyweight = exercise.starting_weight === 'Bodyweight'
  const allDone = currentSet > (exercise.sets ?? 0)
  const restTarget = REST_TARGET[blockName] ?? 90
  const restPct = Math.min(100, (elapsed / restTarget) * 100)
  const restReady = elapsed >= restTarget
  const blockAccent = BLOCK_ACCENT[blockName] ?? C.accent

  return (
    <div className="px-4 pt-6 pb-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push(`/block/${blockId}`)} className="py-2 pr-4 text-sm" style={{ color: C.muted }}>
          &lsaquo; Back
        </button>
        {isUpperBody && (
          <button
            onClick={() => setShowNeck(true)}
            className="w-11 h-11 rounded-full border-2 font-bold text-lg flex items-center justify-center"
            style={{ borderColor: C.danger, color: C.danger }}
          >
            !
          </button>
        )}
      </div>

      {/* Overload prompt */}
      {showOverloadPrompt && (
        <div
          className="rounded-2xl p-4 mb-4 flex items-start gap-3 overflow-hidden relative"
          style={{ backgroundColor: '#2E3E2C', borderLeft: `3px solid ${C.success}` }}
        >
          {!overloadShimmered && (
            <div
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)',
                animation: 'shimmer 0.8s ease-out forwards',
              }}
              onAnimationEnd={() => setOverloadShimmered(true)}
            />
          )}
          <span className="text-xl mt-0.5" style={{ color: C.success }}>&#8593;</span>
          <div className="flex-1">
            <p className="font-semibold text-sm" style={{ color: C.text }}>
              Getting stronger &mdash; {exercise.name} is ready for more
            </p>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>
              You've hit target reps at {weight} lbs for 2 sessions. Try adding 2.5–5 lbs next time.
            </p>
          </div>
          <button onClick={dismissOverload} className="text-xl leading-none px-1" style={{ color: C.muted }}>
            &times;
          </button>
        </div>
      )}

      {/* Exercise info */}
      <h1 className="text-2xl font-bold mb-1" style={{ color: C.text }}>{exercise.name}</h1>
      <p className="mb-4" style={{ color: C.muted }}>Target: {exercise.sets} &times; {exercise.reps}</p>

      {/* Neck flag */}
      {exercise.neck_flag && (
        <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: 'rgba(196,81,74,0.1)', border: `1px solid ${C.danger}` }}>
          <p className="font-semibold text-sm" style={{ color: C.danger }}>
            Neck-flagged &mdash; go light, stop if neck engages
          </p>
        </div>
      )}

      {/* Last weight */}
      {!allDone && (
        <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          {isBodyweight ? (
            <p style={{ color: C.muted }}>Bodyweight exercise</p>
          ) : lastWeight != null ? (
            <p className="text-lg" style={{ color: C.text }}>
              Last time: <span className="font-bold text-xl" style={{ color: blockAccent }}>{lastWeight} lbs</span>
            </p>
          ) : (
            <p style={{ color: C.muted }}>No previous weight &mdash; enter today&apos;s weight</p>
          )}
        </div>
      )}

      {/* Completed sets */}
      {completedSets.length > 0 && (
        <div className="mb-4 space-y-1">
          {completedSets.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 py-2.5"
              style={{
                borderBottom: `1px solid ${C.border}`,
                animation: animatingSetId === s.id ? 'pulse-row 0.4s ease-out' : undefined,
              }}
            >
              <span className="w-16 text-sm" style={{ color: C.muted }}>Set {s.set_number}</span>
              <span className="font-semibold" style={{ color: C.text }}>
                {s.weight != null ? `${s.weight} lbs` : 'BW'} &times; {s.reps}
              </span>
              <span className="ml-auto font-bold" style={{ color: C.success }}>&#10003;</span>
              {undoableSetId === s.id && (
                <button
                  onClick={undoSet}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{ color: C.muted, border: `1px solid ${C.border}` }}
                >
                  Undo
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rest timer */}
      {restStartTime && !allDone && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs" style={{ color: C.muted }}>Rest</span>
            <span
              className="text-sm font-semibold tabular-nums"
              style={{ color: restReady ? blockAccent : C.muted }}
            >
              {restReady ? 'Ready' : formatElapsed(elapsed)}
            </span>
          </div>
          <div className="h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: C.border }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${restPct}%`, backgroundColor: restReady ? blockAccent : C.border }}
            />
          </div>
        </div>
      )}

      {!allDone ? (
        <>
          <p className="mb-5 text-lg font-medium" style={{ color: C.muted }}>
            Set {currentSet} of {exercise.sets}
          </p>

          {!isBodyweight && (
            <div className="mb-4">
              <Stepper label="Weight" unit="lbs" value={weight} onChange={setWeight} step={2.5} />
            </div>
          )}

          <div className="mb-6">
            <Stepper label="Reps" value={reps} onChange={setReps} step={1} />
          </div>

          {error && <p className="text-sm mb-3" style={{ color: C.danger }}>{error}</p>}

          <button
            onClick={logSet}
            disabled={saving || (!isBodyweight && !weight) || !reps}
            className="w-full font-bold text-2xl rounded-xl py-5 disabled:opacity-40 active:opacity-80"
            style={{ backgroundColor: blockAccent, color: C.text }}
          >
            {saving ? 'Saving...' : 'Done'}
          </button>
        </>
      ) : (
        <div
          className="text-center py-8 rounded-2xl"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${blockAccent}20 0%, transparent 65%)`,
          }}
        >
          <p
            className="text-6xl mb-4"
            style={{
              color: C.success,
              animation: 'checkmark-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
            }}
          >
            &#10003;
          </p>
          <p className="text-2xl font-bold mb-1" style={{ color: C.success }}>All sets complete!</p>
          <p className="mb-5" style={{ color: C.muted }}>{exercise.name}</p>

          {/* Set summary */}
          {completedSets.length > 0 && (
            <div className="rounded-xl p-4 mb-5 text-left" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
              {completedSets.map(s => (
                <div key={s.id} className="flex justify-between py-1.5" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <span className="text-sm" style={{ color: C.muted }}>Set {s.set_number}</span>
                  <span className="text-sm font-semibold" style={{ color: C.text }}>
                    {s.weight != null ? `${s.weight} lbs` : 'BW'} &times; {s.reps}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-sm italic mb-8" style={{ color: C.muted }}>{motivation}</p>

          <button
            onClick={() => router.push(`/block/${blockId}`)}
            className="w-full font-bold text-xl rounded-xl py-5"
            style={{ border: `1px solid ${blockAccent}`, color: blockAccent, backgroundColor: 'transparent' }}
          >
            &lsaquo; Back to block
          </button>
        </div>
      )}

      {showNeck && <NeckSafetyModal onClose={() => setShowNeck(false)} />}

      {toast && (
        <Toast
          message={toast.message}
          accent={toast.accent}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  )
}
