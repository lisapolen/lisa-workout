'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Exercise } from '@/lib/types'
import { getLocalDate, parseTargetReps, parseStartingWeight } from '@/lib/utils'
import { useSetLogger } from '@/lib/hooks/useSetLogger'
import { Stepper } from '@/components/Stepper'
import NeckSafetyModal from '@/components/NeckSafetyModal'
import { Toast } from '@/components/Toast'

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

const REST_TARGET: Record<string, number> = {
  'Lower Body': 120,
  'Upper Body': 90,
  'Core':       60,
}

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

export default function SetLoggerPage() {
  const params = useParams()
  const router = useRouter()
  const blockId = Number(params.id)
  const exerciseId = Number(params.exerciseId)

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [blockName, setBlockName] = useState('')
  const [isUpperBody, setIsUpperBody] = useState(false)
  const [lastWeight, setLastWeight] = useState<number | null | undefined>(undefined)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [showNeck, setShowNeck] = useState(false)
  const [motivation] = useState(() => COOK_PUNS[Math.floor(Math.random() * COOK_PUNS.length)])

  const {
    completedSets, setCompletedSets, currentSet, setCurrentSet,
    saving, error,
    showOverloadPrompt, overloadShimmered, setOverloadShimmered,
    restStartTime, elapsed,
    undoableSetId, animatingSetId,
    toast, setToast,
    logSet, undoSet, dismissOverload,
    runOverloadCheck, sessionKey,
  } = useSetLogger({
    session: { type: 'block', blockId },
    exercise,
    blockName,
    lastWeight,
  })

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

      // Resume any sets already logged in today's session
      const today = getLocalDate()
      const storedSessionId = localStorage.getItem(sessionKey(today))
      if (storedSessionId) {
        const { data: existingSets } = await supabase
          .from('sets_log')
          .select('*')
          .eq('session_id', Number(storedSessionId))
          .eq('exercise_id', exerciseId)
          .order('set_number')
        if (existingSets && existingSets.length > 0) {
          setCompletedSets(existingSets)
          setCurrentSet(existingSets[existingSets.length - 1].set_number + 1)
          const lastLoggedWeight = existingSets[existingSets.length - 1].weight
          if (lastLoggedWeight != null) {
            setLastWeight(lastLoggedWeight)
            setWeight(String(lastLoggedWeight))
            return
          }
        }
      }

      const { data: lastSet } = await supabase
        .from('sets_log').select('weight').eq('exercise_id', exerciseId)
        .not('weight', 'is', null).order('completed_at', { ascending: false }).limit(1).maybeSingle()

      if (lastSet?.weight != null) {
        setLastWeight(lastSet.weight)
        setWeight(String(lastSet.weight))
        await runOverloadCheck(ex, lastSet.weight, null)
      } else {
        setLastWeight(null)
        const startingDefault = parseStartingWeight(ex.starting_weight)
        if (startingDefault) setWeight(startingDefault)
      }
    }
    load()
  }, [exerciseId])

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
              You&apos;ve hit target reps at {weight} lbs for 2 sessions. Try adding 2.5–5 lbs next time.
            </p>
          </div>
          <button onClick={() => dismissOverload(exerciseId, weight)} className="text-xl leading-none px-1" style={{ color: C.muted }}>
            &times;
          </button>
        </div>
      )}

      {/* Exercise info */}
      <h1 className="text-2xl font-bold mb-1" style={{ color: C.text }}>{exercise.name}</h1>
      <p className="mb-1" style={{ color: C.muted }}>Target: {exercise.sets} &times; {exercise.reps}</p>
      {exercise.notes && (
        <p className="text-sm italic mb-2" style={{ color: C.muted }}>{exercise.notes}</p>
      )}
      {exercise.description && (
        <p className="text-sm mb-2" style={{ color: C.muted }}>{exercise.description}</p>
      )}
      {exercise.video_url && (
        <a href={exercise.video_url} target="_blank" rel="noopener noreferrer"
          className="text-sm mb-4 inline-block" style={{ color: C.accent }}>
          Watch →
        </a>
      )}
      {!exercise.notes && !exercise.description && <div className="mb-4" />}

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
        <div className="mb-5 rounded-2xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: C.muted }}>Rest</span>
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: restReady ? blockAccent : C.text }}
            >
              {restReady ? 'Ready ✓' : elapsed === 0 ? '0:00' : `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')}`}
            </span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: C.border }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${restPct}%`, backgroundColor: restReady ? blockAccent : C.muted }}
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
            onClick={() => logSet(weight, reps)}
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
