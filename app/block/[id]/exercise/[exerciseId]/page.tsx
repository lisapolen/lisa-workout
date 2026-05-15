'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Exercise, SetLog } from '@/lib/types'
import NeckSafetyModal from '@/components/NeckSafetyModal'

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
      <label className="text-zinc-400 text-sm mb-2 block">
        {label}{unit && <span className="text-zinc-600 ml-1">({unit})</span>}
      </label>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onPointerDown={() => adjust(-step)}
          className="w-16 rounded-2xl text-3xl font-bold text-white flex items-center justify-center border active:opacity-70 select-none"
          style={{ backgroundColor: '#1A1A1A', borderColor: '#374151' }}
        >
          -
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 rounded-xl text-4xl font-bold text-center py-4 outline-none text-white"
          style={{ backgroundColor: '#1A1A1A', border: '2px solid #374151' }}
        />
        <button
          type="button"
          onPointerDown={() => adjust(step)}
          className="w-16 rounded-2xl text-3xl font-bold text-white flex items-center justify-center border active:opacity-70 select-none"
          style={{ backgroundColor: '#1A1A1A', borderColor: '#374151' }}
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
      const { data: ex } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .single()
      if (!ex) return
      setExercise(ex)

      // Set default reps from target
      const targetReps = parseTargetReps(ex.reps)
      if (targetReps > 0) setReps(String(targetReps))

      // Check if upper body block
      const { data: blk } = await supabase
        .from('blocks')
        .select('name')
        .eq('id', ex.block_id)
        .single()
      if (blk?.name === 'Upper Body') setIsUpperBody(true)

      // Last logged weight (or starting weight as fallback)
      const { data: lastSet } = await supabase
        .from('sets_log')
        .select('weight')
        .eq('exercise_id', exerciseId)
        .not('weight', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

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

    const { data, error } = await supabase
      .from('sessions')
      .insert({ date: today, block_id: blockId })
      .select('id')
      .single()

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
    const currentSessionKey = `session_${blockId}_${today}`
    const currentSessionId = localStorage.getItem(currentSessionKey)

    const { data: allSets } = await supabase
      .from('sets_log')
      .select('session_id, weight, reps')
      .eq('exercise_id', exerciseId)
      .not('weight', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(100)

    if (!allSets) return

    // Group by session, excluding current
    const prevSessions: Record<number, { weight: number; reps: number | null }[]> = {}
    for (const s of allSets) {
      if (String(s.session_id) === currentSessionId) continue
      if (!prevSessions[s.session_id]) prevSessions[s.session_id] = []
      prevSessions[s.session_id].push({ weight: Number(s.weight), reps: s.reps })
    }

    const prevIds = Object.keys(prevSessions)
    if (prevIds.length < 2) return

    // Check last 2 sessions: all sets at same weight, all reps >= target
    const qualified = prevIds.slice(0, 2).every(sid => {
      const sets = prevSessions[Number(sid)]
      return sets.every(s => s.weight === loggedWeight && (s.reps ?? 0) >= targetReps)
    })

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
        .insert({
          session_id: sessionId,
          exercise_id: exerciseId,
          set_number: currentSet,
          weight: loggedWeight,
          reps: Number(reps),
        })
        .select()
        .single()

      if (insertError) throw insertError
      setCompletedSets(prev => [...prev, data])
      setCurrentSet(prev => prev + 1)

      if (loggedWeight != null) {
        await checkOverload(loggedWeight)
      }
    } catch {
      setError('Failed to save — check connection')
    } finally {
      setSaving(false)
    }
  }

  function dismissOverload() {
    const loggedWeight = Number(weight)
    localStorage.setItem(`overload_dismissed_${exerciseId}_${loggedWeight}`, '1')
    setShowOverloadPrompt(false)
  }

  if (!exercise) {
    return <div className="flex items-center justify-center h-screen text-zinc-400">Loading...</div>
  }

  const isBodyweight = exercise.starting_weight === 'Bodyweight'
  const allDone = currentSet > (exercise.sets ?? 0)

  return (
    <div className="px-4 pt-6 pb-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.back()} className="text-zinc-400 py-2 pr-4 text-sm">
          &lsaquo; Back
        </button>
        {isUpperBody && (
          <button
            onClick={() => setShowNeck(true)}
            className="w-10 h-10 rounded-full border-2 border-red-500 text-red-400 font-bold text-lg flex items-center justify-center"
          >
            !
          </button>
        )}
      </div>

      {/* Overload prompt */}
      {showOverloadPrompt && (
        <div className="rounded-2xl p-4 mb-4 flex items-start gap-3" style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid #3B82F6' }}>
          <span className="text-xl mt-0.5" style={{ color: '#3B82F6' }}>&#8593;</span>
          <div className="flex-1">
            <p className="font-semibold text-sm text-white">
              Ready to increase weight on {exercise.name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
              Try adding 2.5&ndash;5 lbs next session
            </p>
          </div>
          <button onClick={dismissOverload} className="text-xl leading-none px-1" style={{ color: '#9CA3AF' }}>
            &times;
          </button>
        </div>
      )}

      {/* Exercise info */}
      <h1 className="text-2xl font-bold mb-1">{exercise.name}</h1>
      <p className="text-zinc-400 mb-4">Target: {exercise.sets} &times; {exercise.reps}</p>

      {/* Neck flag */}
      {exercise.neck_flag && (
        <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444' }}>
          <p className="font-semibold text-sm" style={{ color: '#EF4444' }}>
            Neck-flagged &mdash; go light, stop if neck engages
          </p>
        </div>
      )}

      {/* Last weight */}
      <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: '#1A1A1A' }}>
        {isBodyweight ? (
          <p style={{ color: '#9CA3AF' }}>Bodyweight exercise</p>
        ) : lastWeight != null ? (
          <p className="text-lg text-white">
            Last time: <span className="font-bold text-xl" style={{ color: '#3B82F6' }}>{lastWeight} lbs</span>
          </p>
        ) : (
          <p style={{ color: '#9CA3AF' }}>No previous weight &mdash; enter today&apos;s weight</p>
        )}
      </div>

      {/* Completed sets */}
      {completedSets.length > 0 && (
        <div className="mb-5 space-y-1">
          {completedSets.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-zinc-800">
              <span className="text-zinc-500 w-16 text-sm">Set {s.set_number}</span>
              <span className="text-green-400 font-semibold">
                {s.weight != null ? `${s.weight} lbs` : 'BW'} &times; {s.reps}
              </span>
              <span className="text-green-500 ml-auto">&#10003;</span>
            </div>
          ))}
        </div>
      )}

      {!allDone ? (
        <>
          <p className="text-zinc-400 mb-5 text-lg font-medium">
            Set {currentSet} of {exercise.sets}
          </p>

          {!isBodyweight && (
            <div className="mb-4">
              <Stepper
                label="Weight"
                unit="lbs"
                value={weight}
                onChange={setWeight}
                step={2.5}
              />
            </div>
          )}

          <div className="mb-6">
            <Stepper
              label="Reps"
              value={reps}
              onChange={setReps}
              step={1}
            />
          </div>

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          <button
            onClick={logSet}
            disabled={saving || (!isBodyweight && !weight) || !reps}
            className="w-full text-white font-bold text-2xl rounded-xl py-5 disabled:opacity-40 active:opacity-80"
            style={{ backgroundColor: '#3B82F6' }}
          >
            {saving ? 'Saving...' : 'Done'}
          </button>
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-6xl mb-4">&#10003;</p>
          <p className="text-2xl font-bold text-green-400 mb-1">All sets complete!</p>
          <p className="text-zinc-500 mb-8">{exercise.name}</p>
          <button
            onClick={() => router.back()}
            className="w-full bg-zinc-800 text-white font-bold text-xl rounded-2xl py-5"
          >
            &lsaquo; Back to block
          </button>
        </div>
      )}

      {showNeck && <NeckSafetyModal onClose={() => setShowNeck(false)} />}
    </div>
  )
}
