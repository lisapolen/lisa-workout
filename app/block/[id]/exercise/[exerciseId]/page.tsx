'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Exercise, SetLog } from '@/lib/types'
import NeckSafetyModal from '@/components/NeckSafetyModal'

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

  useEffect(() => {
    async function load() {
      const { data: ex } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .single()
      if (!ex) return
      setExercise(ex)

      // Check if upper body block
      const { data: blk } = await supabase
        .from('blocks')
        .select('name')
        .eq('id', ex.block_id)
        .single()
      if (blk?.name === 'Upper Body') setIsUpperBody(true)

      // Last logged weight
      const { data: lastSet } = await supabase
        .from('sets_log')
        .select('weight')
        .eq('exercise_id', exerciseId)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      setLastWeight(lastSet?.weight ?? null)
      if (lastSet?.weight != null) setWeight(String(lastSet.weight))
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

  async function logSet() {
    if (!exercise || saving) return
    const isBodyweight = exercise.starting_weight === 'Bodyweight'
    if (!isBodyweight && !weight) return
    if (!reps) return

    setSaving(true)
    setError('')
    try {
      const sessionId = await getOrCreateSession()
      const { data, error: insertError } = await supabase
        .from('sets_log')
        .insert({
          session_id: sessionId,
          exercise_id: exerciseId,
          set_number: currentSet,
          weight: isBodyweight ? null : Number(weight),
          reps: Number(reps),
        })
        .select()
        .single()

      if (insertError) throw insertError
      setCompletedSets(prev => [...prev, data])
      setReps('')
      setCurrentSet(prev => prev + 1)
    } catch {
      setError('Failed to save — check connection')
    } finally {
      setSaving(false)
    }
  }

  if (!exercise) {
    return <div className="flex items-center justify-center h-screen text-zinc-400">Loading...</div>
  }

  const isBodyweight = exercise.starting_weight === 'Bodyweight'
  const allDone = currentSet > (exercise.sets ?? 0)

  return (
    <div className="px-4 pt-6 pb-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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

      {/* Exercise info */}
      <h1 className="text-2xl font-bold mb-1">{exercise.name}</h1>
      <p className="text-zinc-400 mb-4">Target: {exercise.sets} &times; {exercise.reps}</p>

      {/* Neck flag */}
      {exercise.neck_flag && (
        <div className="bg-red-950 border border-red-700 rounded-xl p-3 mb-4">
          <p className="text-red-400 font-semibold text-sm">
            Neck-flagged — go light, stop if neck engages
          </p>
        </div>
      )}

      {/* Last weight */}
      <div className="bg-zinc-900 rounded-xl p-4 mb-5 border border-zinc-800">
        {isBodyweight ? (
          <p className="text-zinc-400">Bodyweight exercise</p>
        ) : lastWeight != null ? (
          <p className="text-lg">
            Last time: <span className="text-amber-400 font-bold text-xl">{lastWeight} lbs</span>
          </p>
        ) : (
          <p className="text-zinc-400">No previous weight &mdash; enter today&apos;s weight</p>
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
          <p className="text-zinc-400 mb-4 text-lg font-medium">
            Set {currentSet} of {exercise.sets}
          </p>

          {!isBodyweight && (
            <div className="mb-4">
              <label className="text-zinc-400 text-sm mb-2 block">Weight (lbs)</label>
              <input
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                className="w-full bg-zinc-800 rounded-xl text-4xl font-bold text-center py-5 border-2 border-zinc-700 focus:border-amber-400 outline-none"
                placeholder="0"
              />
            </div>
          )}

          <div className="mb-6">
            <label className="text-zinc-400 text-sm mb-2 block">Reps</label>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={e => setReps(e.target.value)}
              className="w-full bg-zinc-800 rounded-xl text-4xl font-bold text-center py-5 border-2 border-zinc-700 focus:border-amber-400 outline-none"
              placeholder="0"
            />
          </div>

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          <button
            onClick={logSet}
            disabled={saving || (!isBodyweight && !weight) || !reps}
            className="w-full bg-amber-400 text-black font-bold text-2xl rounded-2xl py-5 disabled:opacity-40 active:opacity-80"
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
