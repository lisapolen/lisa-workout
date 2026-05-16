'use client'
import { useEffect, useState } from 'react'
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

type Feeling = 'great' | 'okay' | 'tired'
const FEELING_OPTIONS: { value: Feeling; label: string; desc: string }[] = [
  { value: 'great', label: 'Great',  desc: 'Energized and ready' },
  { value: 'okay',  label: 'Okay',   desc: "Decent, let's go" },
  { value: 'tired', label: 'Tired',  desc: 'Low energy today' },
]

export default function RecipePage() {
  const params = useParams()
  const router = useRouter()
  const recipeId = Number(params.id)

  const [recipe, setRecipe] = useState<Plan | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [feeling, setFeeling] = useState<Feeling | null>(null)
  const [feelingCheckedIn, setFeelingCheckedIn] = useState(false)
  const [feelingConfirming, setFeelingConfirming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (confirmDelete) {
      requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }))
    }
  }, [confirmDelete])

  useEffect(() => {
    async function load() {
      const today = getLocalDate()
      const [{ data: recipeData }, { data: planExData }] = await Promise.all([
        supabase.from('plans').select('*').eq('id', recipeId).single(),
        supabase.from('plan_exercises').select('sort_order, exercises(*)').eq('plan_id', recipeId).order('sort_order'),
      ])
      if (recipeData) setRecipe(recipeData)
      if (planExData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setExercises(planExData.map((pe: any) => pe.exercises).filter(Boolean))
      }
      const storedFeeling = localStorage.getItem(`feeling_plan_${recipeId}_${today}`) as Feeling | null
      if (storedFeeling) { setFeeling(storedFeeling); setFeelingCheckedIn(true) }
    }
    load()
  }, [recipeId])

  function selectFeeling(f: Feeling) {
    const today = getLocalDate()
    localStorage.setItem(`feeling_plan_${recipeId}_${today}`, f)
    setFeeling(f)
    setFeelingConfirming(true)
    setTimeout(() => { setFeelingConfirming(false); setFeelingCheckedIn(true) }, 700)
  }

  async function deleteRecipe() {
    await supabase.from('plans').delete().eq('id', recipeId)
    router.push('/recipes')
  }

  if (!recipe) return <div className="flex items-center justify-center h-64" style={{ color: C.muted }}>Loading...</div>

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      <button onClick={() => router.push('/recipes')} className="text-sm mb-4" style={{ color: C.muted }}>
        &lsaquo; Recipes
      </button>
      <h1 className="text-3xl font-bold mb-1" style={{ color: C.text }}>{recipe.name}</h1>
      <p className="text-sm mb-2" style={{ color: C.muted }}>
        {recipe.type === 'circuit' ? `Circuit · ${recipe.rounds} rounds` : 'Straight sets'}
      </p>
      <div className="h-1 w-12 rounded-full mb-6" style={{ backgroundColor: PLAN_ACCENT }} />

      {feelingConfirming ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-2xl font-semibold" style={{ color: PLAN_ACCENT }}>Let&apos;s cook.</p>
        </div>
      ) : !feelingCheckedIn ? (
        <div>
          <p className="text-lg font-semibold mb-1" style={{ color: C.text }}>How are you feeling?</p>
          <p className="text-sm mb-6" style={{ color: C.muted }}>Takes a second. Helps the record.</p>
          <div className="flex flex-col gap-3">
            {FEELING_OPTIONS.map(({ value, label, desc }) => (
              <button key={value} onClick={() => selectFeeling(value)}
                className="w-full rounded-2xl p-5 text-left active:opacity-80"
                style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
                <p className="text-xl font-bold" style={{ color: C.text }}>{label}</p>
                <p className="text-sm" style={{ color: C.muted }}>{desc}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Ingredient list — read only */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: C.muted }}>Ingredients</p>
            {exercises.map((ex) => (
              <div key={ex.id} className="flex items-center gap-3 py-3"
                style={{ borderBottom: `1px solid ${C.border}` }}>
                <span className="w-5 h-5 rounded-full border flex-shrink-0" style={{ borderColor: C.border }} />
                <span className="flex-1 font-semibold" style={{ color: C.text }}>{ex.name}</span>
                <span className="text-sm font-bold" style={{ color: C.muted }}>{ex.sets} × {ex.reps}</span>
              </div>
            ))}
          </div>

          {/* Cook button */}
          <button
            onClick={() => router.push(`/recipes/${recipeId}/cook`)}
            className="w-full py-5 rounded-2xl font-bold text-2xl active:opacity-80"
            style={{ backgroundColor: PLAN_ACCENT, color: C.text }}
          >
            Cook →
          </button>

          <div className="mt-10 pt-6" style={{ borderTop: `1px solid ${C.border}` }}>
            {confirmDelete ? (
              <div>
                <p className="text-sm mb-3" style={{ color: C.text }}>Delete &ldquo;{recipe.name}&rdquo;? Past cooks are kept.</p>
                <div className="flex gap-3">
                  <button onClick={deleteRecipe} className="flex-1 py-2.5 rounded-xl font-semibold" style={{ backgroundColor: C.danger, color: C.text }}>Delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl" style={{ border: `1px solid ${C.border}`, color: C.muted }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs py-2 px-2" style={{ color: C.muted }}>
                Delete recipe
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
