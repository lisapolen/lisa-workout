'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Exercise, Plan } from '@/lib/types'
import { getLocalDate } from '@/lib/utils'
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

const PLAN_ACCENT = '#A87FA8'

type Feeling = 'great' | 'okay' | 'tired'

const FEELING_OPTIONS: { value: Feeling; label: string; desc: string }[] = [
  { value: 'great', label: 'Great',  desc: 'Energized and ready' },
  { value: 'okay',  label: 'Okay',   desc: "Decent, let's go" },
  { value: 'tired', label: 'Tired',  desc: 'Low energy today' },
]

export default function PlanPage() {
  const params = useParams()
  const router = useRouter()
  const planId = Number(params.planId)

  const [plan, setPlan] = useState<Plan | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [lastWeights, setLastWeights] = useState<Record<number, number | null>>({})
  const [completedCounts, setCompletedCounts] = useState<Record<number, number>>({})
  const [feeling, setFeeling] = useState<Feeling | null>(null)
  const [feelingCheckedIn, setFeelingCheckedIn] = useState(false)
  const [feelingConfirming, setFeelingConfirming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (confirmDelete) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      })
    }
  }, [confirmDelete])

  useEffect(() => {
    async function load() {
      const { data: planData } = await supabase.from('plans').select('*').eq('id', planId).single()
      if (planData) setPlan(planData)

      // Check feeling for today
      const today = getLocalDate()
      const storedFeeling = localStorage.getItem(`feeling_plan_${planId}_${today}`) as Feeling | null
      if (storedFeeling) {
        setFeeling(storedFeeling)
        setFeelingCheckedIn(true)
      }

      // Fetch exercises via plan_exercises join
      const { data: planExData } = await supabase
        .from('plan_exercises')
        .select('sort_order, exercises(*)')
        .eq('plan_id', planId)
        .order('sort_order')

      if (planExData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const exList: Exercise[] = planExData.map((pe: any) => pe.exercises).filter(Boolean)
        setExercises(exList)

        const ids = exList.map(e => e.id)
        const weightResults = await Promise.all(
          ids.map(id =>
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
        weightResults.forEach(({ data }) => { if (data) map[data.exercise_id] = data.weight })
        setLastWeights(map)

        // Completion indicators
        const sessionId = localStorage.getItem(`plan_session_${planId}_${today}`)
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
  }, [planId])

  function selectFeeling(f: Feeling) {
    const today = getLocalDate()
    localStorage.setItem(`feeling_plan_${planId}_${today}`, f)
    setFeeling(f)
    setFeelingConfirming(true)
    setTimeout(() => {
      setFeelingConfirming(false)
      setFeelingCheckedIn(true)
    }, 700)
  }

  async function deletePlan() {
    await supabase.from('plans').delete().eq('id', planId)
    router.push('/plans')
  }

  if (!plan) {
    return <div className="flex items-center justify-center h-64" style={{ color: C.muted }}>Loading...</div>
  }

  const needsCheckIn = !feelingCheckedIn

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      <button onClick={() => router.push('/plans')} className="text-sm mb-4" style={{ color: C.muted }}>
        &lsaquo; Plans
      </button>
      <h1 className="text-3xl font-bold mb-2" style={{ color: C.text }}>{plan.name}</h1>
      <div className="h-1 w-12 rounded-full mb-6" style={{ backgroundColor: PLAN_ACCENT }} />

      {feelingConfirming ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-2xl font-semibold" style={{ color: PLAN_ACCENT }}>Let&apos;s go.</p>
        </div>
      ) : needsCheckIn ? (
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
          <StrengthView
            exercises={exercises}
            lastWeights={lastWeights}
            completedCounts={completedCounts}
            linkBuilder={(exId) => {
              const idx = exercises.findIndex(e => e.id === exId)
              return `/plans/${planId}/exercise/${exId}?pos=${idx + 1}&total=${exercises.length}`
            }}
            isUpperBody={false}
            accent={PLAN_ACCENT}
          />

          <div className="mt-10 pt-6" style={{ borderTop: `1px solid ${C.border}` }}>
            {confirmDelete ? (
              <div>
                <p className="text-sm mb-3" style={{ color: C.text }}>Delete &ldquo;{plan.name}&rdquo;? This removes the plan. Past logs are kept.</p>
                <div className="flex gap-3">
                  <button
                    onClick={deletePlan}
                    className="flex-1 py-2.5 rounded-xl font-semibold"
                    style={{ backgroundColor: C.danger, color: C.text }}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2.5 rounded-xl"
                    style={{ border: `1px solid ${C.border}`, color: C.muted }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs py-2 px-2"
                style={{ color: C.muted }}
              >
                Delete plan
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
