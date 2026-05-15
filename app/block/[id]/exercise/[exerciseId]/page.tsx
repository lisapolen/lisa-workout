'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Exercise, SetLog } from '@/lib/types'
import NeckSafetyModal from '@/components/NeckSafetyModal'

const C = {
  bg:       '#1C1814',
  card:     '#252018',
  border:   '#3A3228',
  text:     '#F5F0E8',
  muted:    '#A89880',
  accent:   '#C4714A',
  success:  '#6B8F6B',
  danger:   '#C4514A',
}

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

  useEffect(() => {
    async function load() {
      const { data: ex } = await supabase.from('exercises').select('*').eq('id', exerciseId).single()
      if (!ex) return
      setExercise(ex)

      const targetReps = parseTargetReps(ex.reps)
      if (targetReps > 0) setReps(String(targetReps))

      const { data: blk } = await supabase.from('blocks').select('name').eq('id', ex.block_id).single()
      if (blk?.name === 'Upper Body') setIsUpperBody(true)

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
    if (qualified) setShowOverloadPrompt(true)
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
      if (loggedWeight != null) await checkOverload(loggedWeight)
    } catch {
      setError('Failed to save — check connection')
    } finally {
      setSaving(false)
    }
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

  return (
    <div className="px-4 pt-6 pb-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.back()} className="py-2 pr-4 text-sm" style={{ color: C.muted }}>
          &lsaquo; Back
        </button>
        {isUpperBody && (
          <button
            onClick={() => setShowNeck(true)}
            className="w-10 h-10 rounded-full border-2 font-bold text-lg flex items-center justify-center"
            style={{ borderColor: C.danger, color: C.danger }}
          >
            !
          </button>
        )}
      </div>

      {/* Overload prompt */}
      {showOverloadPrompt && (
        <div className="rounded-2xl p-4 mb-4 flex items-start gap-3" style={{ backgroundColor: '#2A3828', borderLeft: `3px solid ${C.success}` }}>
          <span className="text-xl mt-0.5" style={{ color: C.success }}>&#8593;</span>
          <div className="flex-1">
            <p className="font-semibold text-sm" style={{ color: C.text }}>
              Ready to increase weight on {exercise.name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>
              Try adding 2.5&ndash;5 lbs next session
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
      <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
        {isBodyweight ? (
          <p style={{ color: C.muted }}>Bodyweight exercise</p>
        ) : lastWeight != null ? (
          <p className="text-lg" style={{ color: C.text }}>
            Last time: <span className="font-bold text-xl" style={{ color: C.accent }}>{lastWeight} lbs</span>
          </p>
        ) : (
          <p style={{ color: C.muted }}>No previous weight &mdash; enter today&apos;s weight</p>
        )}
      </div>

      {/* Completed sets */}
      {completedSets.length > 0 && (
        <div className="mb-5 space-y-1">
          {completedSets.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
              <span className="w-16 text-sm" style={{ color: C.muted }}>Set {s.set_number}</span>
              <span className="font-semibold" style={{ color: C.text }}>
                {s.weight != null ? `${s.weight} lbs` : 'BW'} &times; {s.reps}
              </span>
              <span className="ml-auto font-bold" style={{ color: C.success }}>&#10003;</span>
            </div>
          ))}
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
            style={{ backgroundColor: C.accent, color: C.text }}
          >
            {saving ? 'Saving...' : 'Done'}
          </button>
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-6xl mb-4" style={{ color: C.success }}>&#10003;</p>
          <p className="text-2xl font-bold mb-1" style={{ color: C.success }}>All sets complete!</p>
          <p className="mb-8" style={{ color: C.muted }}>{exercise.name}</p>
          <button
            onClick={() => router.back()}
            className="w-full font-bold text-xl rounded-xl py-5"
            style={{ border: `1px solid ${C.accent}`, color: C.accent, backgroundColor: 'transparent' }}
          >
            &lsaquo; Back to block
          </button>
        </div>
      )}

      {showNeck && <NeckSafetyModal onClose={() => setShowNeck(false)} />}
    </div>
  )
}
