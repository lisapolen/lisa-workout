'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Exercise, Plan } from '@/lib/types'
import { getLocalDate } from '@/lib/utils'

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
const PLAN_ACCENT = '#A87FA8'

const REST_TARGET: Record<string, number> = {
  'Lower Body': 120,
  'Upper Body': 90,
  'Core': 60,
}
const ROUND_REST = 90

const ROUND_PUNS = ['simmer down', 'letting it rest', 'marinating']

const COOK_PUNS = [
  'Keep the heat up.',
  'Good technique, chef.',
  "You're cooking now.",
  'Muscle memory forming.',
  'Every rep counts.',
  "Don't skip the prep work.",
  'Low and slow builds strength.',
  'Finishing strong.',
  "That's the recipe.",
]

type SetStatus = 'done' | 'skipped' | 'partial'
type Phase = 'cooking' | 'rest' | 'round-complete' | 'done'

interface ExerciseWithBlock extends Exercise {
  blockName: string
}

export default function CookPage() {
  const params = useParams()
  const router = useRouter()
  const recipeId = Number(params.id)

  const [recipe, setRecipe] = useState<Plan | null>(null)
  const [exercises, setExercises] = useState<ExerciseWithBlock[]>([])
  const [lastWeights, setLastWeights] = useState<Record<number, number | null>>({})
  const [loading, setLoading] = useState(true)

  // Cooking position
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [setNumber, setSetNumber] = useState(1)
  const [currentRound, setCurrentRound] = useState(1)

  // Set tracking (for progress circles)
  const [setsLoggedByExercise, setSetsLoggedByExercise] = useState<Record<number, number>>({})
  const totalSetsLogged = useRef(0)

  // Phase state machine
  const [phase, setPhase] = useState<Phase>('cooking')
  const [restElapsed, setRestElapsed] = useState(0)
  const restStartRef = useRef<number | null>(null)
  const [roundPun, setRoundPun] = useState('')
  const [roundJustCompleted, setRoundJustCompleted] = useState(0)

  const [saving, setSaving] = useState(false)

  // Partial picker
  const [showPartial, setShowPartial] = useState(false)
  const [partialWeightAdj, setPartialWeightAdj] = useState(0)
  const [partialRepsAdj, setPartialRepsAdj] = useState(0)

  // Pun toast
  const [pun, setPun] = useState<string | null>(null)

  // Load recipe + exercises + last weights
  useEffect(() => {
    async function load() {
      const [{ data: recipeData }, { data: planExData }] = await Promise.all([
        supabase.from('plans').select('*').eq('id', recipeId).single(),
        supabase.from('plan_exercises')
          .select('sort_order, exercises(*, blocks(name))')
          .eq('plan_id', recipeId)
          .order('sort_order'),
      ])
      if (recipeData) setRecipe(recipeData)
      if (planExData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const exList: ExerciseWithBlock[] = planExData.map((pe: any) => ({
          ...pe.exercises,
          blockName: pe.exercises?.blocks?.name ?? '',
        })).filter(Boolean)
        setExercises(exList)
        const weights: Record<number, number | null> = {}
        await Promise.all(exList.map(async (ex) => {
          const { data } = await supabase
            .from('sets_log').select('weight').eq('exercise_id', ex.id)
            .not('weight', 'is', null).order('completed_at', { ascending: false }).limit(1).maybeSingle()
          weights[ex.id] = data?.weight ?? null
        }))
        setLastWeights(weights)
      }
      setLoading(false)
    }
    load()
  }, [recipeId])

  // Rest timer tick
  useEffect(() => {
    if (phase !== 'rest' && phase !== 'round-complete') return
    const interval = setInterval(() => {
      if (restStartRef.current) setRestElapsed(Math.floor((Date.now() - restStartRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [phase])

  // Auto-advance from straight-sets rest
  useEffect(() => {
    if (phase !== 'rest') return
    const ex = exercises[exerciseIndex]
    const target = REST_TARGET[ex?.blockName ?? ''] ?? 90
    if (restElapsed >= target) advanceAfterRest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restElapsed, phase])

  // Auto-advance from circuit round-complete rest
  useEffect(() => {
    if (phase !== 'round-complete') return
    if (restElapsed >= ROUND_REST) advanceAfterRound()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restElapsed, phase])

  function startRest() {
    restStartRef.current = Date.now()
    setRestElapsed(0)
    setPhase('rest')
  }

  function advanceAfterRest() {
    setPhase('cooking')
    restStartRef.current = null
  }

  function advanceAfterRound() {
    setCurrentRound(r => r + 1)
    setExerciseIndex(0)
    setSetNumber(1)
    setPhase('cooking')
    restStartRef.current = null
  }

  async function getOrCreateSession(): Promise<number> {
    const today = getLocalDate()
    const key = `plan_session_${recipeId}_${today}`
    const stored = localStorage.getItem(key)
    if (stored) return Number(stored)
    const feeling = localStorage.getItem(`feeling_plan_${recipeId}_${today}`) ?? null
    const { data, error } = await supabase
      .from('sessions').insert({ date: today, plan_id: recipeId, block_id: null, feeling })
      .select('id').single()
    if (error || !data) throw new Error('Could not create session')
    localStorage.setItem(key, String(data.id))
    return data.id
  }

  async function logCurrentSet(status: SetStatus, weightOverride?: number | null, repsOverride?: number | null) {
    if (saving || exercises.length === 0) return
    setSaving(true)
    const ex = exercises[exerciseIndex]
    const isBodyweight = ex.starting_weight === 'Bodyweight'
    const weight = status === 'skipped' ? null
      : weightOverride !== undefined ? weightOverride
      : isBodyweight ? null
      : (lastWeights[ex.id] ?? null)
    const targetReps = parseInt((ex.reps ?? '10').replace(/[^0-9]/g, '')) || 10
    const reps = status === 'skipped' ? null
      : repsOverride !== undefined ? repsOverride
      : targetReps

    try {
      const sessionId = await getOrCreateSession()
      await supabase.from('sets_log').insert({
        session_id: sessionId,
        exercise_id: ex.id,
        set_number: setNumber,
        weight,
        reps,
        status,
      })
      navigator.vibrate?.(50)

      setSetsLoggedByExercise(prev => ({ ...prev, [ex.id]: (prev[ex.id] ?? 0) + 1 }))
      totalSetsLogged.current += 1

      // Cooking pun every 20 sets
      if (totalSetsLogged.current % 20 === 0) {
        const p = COOK_PUNS[Math.floor(Math.random() * COOK_PUNS.length)]
        setPun(p)
        setTimeout(() => setPun(null), 3000)
      }

      if (recipe?.type === 'circuit') {
        advanceCircuit()
      } else {
        advanceStraight(ex)
      }
    } catch {
      // Set still advances on error to avoid blocking the workout
    } finally {
      setSaving(false)
    }
  }

  function advanceStraight(ex: ExerciseWithBlock) {
    const totalSets = ex.sets ?? 3
    if (setNumber < totalSets) {
      setSetNumber(n => n + 1)
      startRest()
    } else {
      const nextIndex = exerciseIndex + 1
      if (nextIndex >= exercises.length) {
        setPhase('done')
      } else {
        setExerciseIndex(nextIndex)
        setSetNumber(1)
        setPhase('cooking')
      }
    }
  }

  function advanceCircuit() {
    const nextIndex = exerciseIndex + 1
    if (nextIndex < exercises.length) {
      setExerciseIndex(nextIndex)
    } else {
      if (!recipe) return
      const totalRounds = recipe.rounds ?? 3
      if (currentRound < totalRounds) {
        setRoundJustCompleted(currentRound)
        setRoundPun(ROUND_PUNS[currentRound % ROUND_PUNS.length])
        restStartRef.current = Date.now()
        setRestElapsed(0)
        setPhase('round-complete')
      } else {
        setPhase('done')
      }
    }
  }

  function handlePartialConfirm() {
    const ex = exercises[exerciseIndex]
    const isBodyweight = ex.starting_weight === 'Bodyweight'
    const baseWeight = isBodyweight ? null : (lastWeights[ex.id] ?? null)
    const weight = baseWeight !== null ? Math.max(0, baseWeight + partialWeightAdj) : null
    const targetReps = parseInt((ex.reps ?? '10').replace(/[^0-9]/g, '')) || 10
    const reps = Math.max(1, targetReps + partialRepsAdj)
    setShowPartial(false)
    setPartialWeightAdj(0)
    setPartialRepsAdj(0)
    logCurrentSet('partial', weight, reps)
  }

  // ─── Loading ───
  if (loading || !recipe) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ backgroundColor: C.bg }}>
        <p className="text-sm" style={{ color: C.muted }}>Reading the cookbook...</p>
      </div>
    )
  }

  const currentEx = exercises[exerciseIndex]
  const totalSetsForEx = currentEx?.sets ?? 3
  const isCircuit = recipe.type === 'circuit'
  const setsLoggedForCurrent = setsLoggedByExercise[currentEx?.id ?? -1] ?? 0

  // ─── Recipe complete ───
  if (phase === 'done') {
    const isFirstCook = !localStorage.getItem(`cooked_${recipeId}`)
    const cookCount = Number(localStorage.getItem(`cook_count_${recipeId}`) ?? 0) + 1
    if (isFirstCook) localStorage.setItem(`cooked_${recipeId}`, '1')
    localStorage.setItem(`cook_count_${recipeId}`, String(cookCount))
    const completionMsg = isFirstCook
      ? "First cook. It'll get easier — and harder — from here."
      : cookCount % 10 === 0 ? "This one's in your rotation." : null

    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6" style={{ backgroundColor: C.bg }}>
        <p className="text-4xl font-bold mb-3" style={{ color: PLAN_ACCENT }}>Recipe complete.</p>
        {completionMsg && <p className="text-sm text-center mb-6" style={{ color: C.muted }}>{completionMsg}</p>}
        <p className="text-sm" style={{ color: C.muted }}>
          {Object.values(setsLoggedByExercise).reduce((a, b) => a + b, 0)} sets · done
        </p>
        <button onClick={() => router.push('/recipes')}
          className="mt-10 px-8 py-4 rounded-2xl font-bold text-lg active:opacity-80"
          style={{ backgroundColor: PLAN_ACCENT, color: C.text }}>
          Back to Kitchen
        </button>
      </div>
    )
  }

  // ─── Round complete (circuit) ───
  if (phase === 'round-complete') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6" style={{ backgroundColor: C.bg }}>
        <p className="text-5xl font-bold mb-2" style={{ color: PLAN_ACCENT }}>Round {roundJustCompleted}</p>
        <p className="text-xl mb-10" style={{ color: C.muted }}>— {roundPun}.</p>
        <p className="text-4xl font-bold tabular-nums" style={{ color: C.text }}>
          {Math.max(0, ROUND_REST - restElapsed)}s
        </p>
        <p className="text-xs mt-2" style={{ color: C.muted }}>next round starts automatically</p>
      </div>
    )
  }

  // ─── Rest (straight sets) ───
  if (phase === 'rest') {
    const restTarget = REST_TARGET[exercises[exerciseIndex]?.blockName ?? ''] ?? 90
    const restLabel = restElapsed >= 120 ? "The pot's been on a while." : 'Rest'
    const timeLeft = Math.max(0, restTarget - restElapsed)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6" style={{ backgroundColor: C.bg }}>
        <p className="text-sm mb-8" style={{ color: C.muted }}>{restLabel}</p>
        <p className="text-6xl font-bold tabular-nums mb-4" style={{ color: timeLeft === 0 ? PLAN_ACCENT : C.text }}>
          {timeLeft}s
        </p>
        {timeLeft === 0 && (
          <button onClick={advanceAfterRest}
            className="mt-4 px-6 py-3 rounded-xl font-semibold active:opacity-80"
            style={{ backgroundColor: PLAN_ACCENT, color: C.text }}>
            Continue
          </button>
        )}
      </div>
    )
  }

  // ─── Main cooking screen ───
  const lastWeight = lastWeights[currentEx?.id ?? -1]
  const displayWeight = lastWeight != null ? `${lastWeight} lb`
    : currentEx?.starting_weight === 'Bodyweight' ? 'Bodyweight' : '—'
  const displayReps = currentEx?.reps ?? '—'

  return (
    <div className="relative flex flex-col min-h-screen" style={{ backgroundColor: C.bg }}>

      {/* Progress indicator */}
      <div className="px-4 pt-8 pb-4 text-center">
        {isCircuit ? (
          <p className="text-sm" style={{ color: C.muted }}>
            Round {currentRound} of {recipe.rounds} &nbsp;·&nbsp; {exerciseIndex + 1} of {exercises.length}
          </p>
        ) : (
          <>
            <p className="text-sm mb-2" style={{ color: C.muted }}>
              Set {setNumber} of {totalSetsForEx}
            </p>
            <div className="flex gap-2 justify-center">
              {Array.from({ length: totalSetsForEx }).map((_, i) => (
                <span key={i} className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: i < setsLoggedForCurrent ? PLAN_ACCENT : C.border }} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Exercise name + weight/reps */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <p className="text-5xl font-bold leading-tight mb-4" style={{ color: C.text }}>
          {currentEx?.name}
        </p>
        <p className="text-sm" style={{ color: C.muted }}>
          {displayWeight} &nbsp;·&nbsp; {displayReps}
        </p>
        {pun && (
          <p className="text-xs mt-6 italic" style={{ color: PLAN_ACCENT }}>{pun}</p>
        )}
      </div>

      {/* Big tap — set done */}
      <button
        onClick={() => logCurrentSet('done')}
        disabled={saving}
        className="mx-4 mb-4 rounded-3xl py-14 font-bold text-2xl active:opacity-70 disabled:opacity-40 transition-opacity"
        style={{ backgroundColor: PLAN_ACCENT, color: C.text }}
      >
        {saving ? '...' : 'Set done'}
      </button>

      {/* Skip (left) / Partial (right) */}
      <div className="flex justify-between px-10 pb-12">
        <button onClick={() => logCurrentSet('skipped')} disabled={saving}
          className="text-sm py-2 disabled:opacity-40" style={{ color: C.muted }}>
          Skip
        </button>
        <button
          onClick={() => { setShowPartial(true); setPartialWeightAdj(0); setPartialRepsAdj(0) }}
          disabled={saving}
          className="text-sm py-2 disabled:opacity-40" style={{ color: C.muted }}>
          Partial
        </button>
      </div>

      {/* Partial picker overlay */}
      {showPartial && (
        <div className="absolute inset-0 flex items-center justify-center px-4"
          style={{ backgroundColor: `${C.bg}ee` }}>
          <div className="w-full rounded-3xl p-6" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            <p className="font-bold text-lg mb-5 text-center" style={{ color: C.text }}>How much did you do?</p>

            {currentEx?.starting_weight !== 'Bodyweight' && (
              <div className="mb-5">
                <p className="text-xs mb-2" style={{ color: C.muted }}>Weight</p>
                <div className="flex gap-2 flex-wrap">
                  {[0, -5, -10, -15].map(adj => (
                    <button key={adj} onClick={() => setPartialWeightAdj(adj)}
                      className="px-3 py-2 rounded-xl text-sm font-semibold"
                      style={{
                        backgroundColor: partialWeightAdj === adj ? PLAN_ACCENT : C.bg,
                        border: `1px solid ${partialWeightAdj === adj ? PLAN_ACCENT : C.border}`,
                        color: C.text,
                      }}>
                      {adj === 0 ? 'As planned' : `${adj} lb`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <p className="text-xs mb-2" style={{ color: C.muted }}>Reps</p>
              <div className="flex gap-2 flex-wrap">
                {[0, -1, -2, -3].map(adj => (
                  <button key={adj} onClick={() => setPartialRepsAdj(adj)}
                    className="px-3 py-2 rounded-xl text-sm font-semibold"
                    style={{
                      backgroundColor: partialRepsAdj === adj ? PLAN_ACCENT : C.bg,
                      border: `1px solid ${partialRepsAdj === adj ? PLAN_ACCENT : C.border}`,
                      color: C.text,
                    }}>
                    {adj === 0 ? 'As planned' : `${adj}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowPartial(false)}
                className="flex-1 py-3 rounded-xl" style={{ border: `1px solid ${C.border}`, color: C.muted }}>
                Cancel
              </button>
              <button onClick={handlePartialConfirm}
                className="flex-1 py-3 rounded-xl font-semibold active:opacity-80"
                style={{ backgroundColor: PLAN_ACCENT, color: C.text }}>
                Log partial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
