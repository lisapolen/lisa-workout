'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Exercise } from '@/lib/types'

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

interface ExerciseWithBlock extends Exercise {
  blockName: string
}

type RecipeType = 'straight' | 'circuit'

export default function NewRecipePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [recipeType, setRecipeType] = useState<RecipeType>('straight')
  const [rounds, setRounds] = useState(3)
  const [allExercises, setAllExercises] = useState<ExerciseWithBlock[]>([])
  const [selected, setSelected] = useState<ExerciseWithBlock[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('exercises').select('*, blocks(name)').order('sort_order')
      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAllExercises(data.map((ex: any) => ({ ...ex, blockName: ex.blocks?.name ?? '' })).filter((ex: ExerciseWithBlock) => ex.blockName !== ''))
      }
    }
    load()
  }, [])

  function toggleExercise(ex: ExerciseWithBlock) {
    setSelected(prev => prev.find(e => e.id === ex.id) ? prev.filter(e => e.id !== ex.id) : [...prev, ex])
  }

  function moveUp(index: number) {
    if (index === 0) return
    setSelected(prev => { const next = [...prev]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next })
  }

  function moveDown(index: number) {
    setSelected(prev => { if (index >= prev.length - 1) return prev; const next = [...prev]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next })
  }

  async function save() {
    if (!name.trim() || selected.length === 0 || saving) return
    setSaving(true)
    setError('')
    try {
      const { data: recipe, error: recipeError } = await supabase
        .from('plans').insert({ name: name.trim(), sort_order: 0, type: recipeType, rounds }).select('id').single()
      if (recipeError || !recipe) throw new Error()
      await supabase.from('plan_exercises').insert(selected.map((ex, i) => ({ plan_id: recipe.id, exercise_id: ex.id, sort_order: i })))
      router.push('/recipes')
    } catch {
      setError('Failed to save — check connection')
      setSaving(false)
    }
  }

  const byBlock: Record<string, ExerciseWithBlock[]> = {}
  for (const ex of allExercises) {
    if (!byBlock[ex.blockName]) byBlock[ex.blockName] = []
    byBlock[ex.blockName].push(ex)
  }
  const selectedIds = new Set(selected.map(e => e.id))
  const canSave = name.trim().length > 0 && selected.length > 0

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      <button onClick={() => router.push('/recipes')} className="text-sm mb-4" style={{ color: C.muted }}>
        &lsaquo; Recipes
      </button>
      <h1 className="text-3xl font-bold mb-2" style={{ color: C.text }}>New Recipe</h1>
      <div className="h-1 w-12 rounded-full mb-6" style={{ backgroundColor: PLAN_ACCENT }} />

      {/* Name */}
      <div className="mb-5">
        <label className="text-sm mb-2 block" style={{ color: C.muted }}>Recipe name</label>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Push Day, Full Body, Kettlebell Circuit…"
          className="w-full rounded-xl px-4 py-3 text-xl font-semibold outline-none"
          style={{ backgroundColor: C.card, border: `2px solid ${name ? PLAN_ACCENT : C.border}`, color: C.text }}
        />
      </div>

      {/* Recipe type */}
      <div className="mb-5">
        <label className="text-sm mb-2 block" style={{ color: C.muted }}>Recipe type</label>
        <div className="flex gap-2">
          {(['straight', 'circuit'] as RecipeType[]).map(t => (
            <button
              key={t}
              onClick={() => setRecipeType(t)}
              className="flex-1 py-3 rounded-xl font-semibold capitalize"
              style={{
                backgroundColor: recipeType === t ? PLAN_ACCENT : C.card,
                border: `1px solid ${recipeType === t ? PLAN_ACCENT : C.border}`,
                color: recipeType === t ? C.text : C.muted,
              }}
            >
              {t === 'straight' ? 'Straight sets' : 'Circuit'}
            </button>
          ))}
        </div>
        {recipeType === 'circuit' && (
          <div className="flex items-center gap-4 mt-3 px-1">
            <span className="text-sm" style={{ color: C.muted }}>Rounds</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setRounds(r => Math.max(1, r - 1))} className="w-8 h-8 rounded-full font-bold text-lg flex items-center justify-center" style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.text }}>−</button>
              <span className="text-xl font-bold w-6 text-center" style={{ color: C.text }}>{rounds}</span>
              <button onClick={() => setRounds(r => r + 1)} className="w-8 h-8 rounded-full font-bold text-lg flex items-center justify-center" style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.text }}>+</button>
            </div>
          </div>
        )}
      </div>

      {/* Selected */}
      {selected.length > 0 && (
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: C.muted }}>Selected ({selected.length})</p>
          <div className="flex flex-col gap-2">
            {selected.map((ex, i) => (
              <div key={ex.id} className="flex items-center gap-2 rounded-2xl p-4"
                style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${PLAN_ACCENT}` }}>
                <div className="flex flex-col gap-1 mr-1">
                  <button onClick={() => moveUp(i)} disabled={i === 0} className="text-lg leading-none disabled:opacity-20" style={{ color: C.muted }}>↑</button>
                  <button onClick={() => moveDown(i)} disabled={i === selected.length - 1} className="text-lg leading-none disabled:opacity-20" style={{ color: C.muted }}>↓</button>
                </div>
                <div className="flex-1">
                  <p className="font-semibold" style={{ color: C.text }}>{ex.name}</p>
                  <p className="text-xs" style={{ color: C.muted }}>{ex.blockName} · {ex.sets}×{ex.reps}{ex.cuisine ? ` · ${ex.cuisine}` : ''}</p>
                </div>
                <button onClick={() => toggleExercise(ex)} className="text-xl px-2" style={{ color: C.muted }}>&times;</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ingredient picker */}
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider mb-3" style={{ color: C.muted }}>Ingredient library</p>
        {Object.entries(byBlock).map(([blockName, exercises]) => (
          <div key={blockName} className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.accent }}>{blockName}</p>
            <div className="flex flex-col gap-2">
              {exercises.map(ex => {
                const isSelected = selectedIds.has(ex.id)
                return (
                  <button key={ex.id} onClick={() => toggleExercise(ex)}
                    className="flex items-center gap-3 rounded-xl p-4 text-left active:opacity-80"
                    style={{ backgroundColor: isSelected ? `${PLAN_ACCENT}18` : C.card, border: `1px solid ${isSelected ? PLAN_ACCENT : C.border}` }}>
                    <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{ borderColor: isSelected ? PLAN_ACCENT : C.border, backgroundColor: isSelected ? PLAN_ACCENT : 'transparent', color: C.text }}>
                      {isSelected ? '✓' : ''}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold" style={{ color: C.text }}>{ex.name}</p>
                      <p className="text-xs" style={{ color: C.muted }}>{ex.sets}×{ex.reps}{ex.cuisine ? ` · ${ex.cuisine}` : ''}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="h-24" />
      {error && <p className="text-sm mb-3" style={{ color: C.danger }}>{error}</p>}

      <div className="fixed bottom-0 left-0 right-0 px-4 pb-safe z-40" style={{ backgroundColor: C.bg }}>
        <div className="max-w-lg mx-auto py-3">
          <button onClick={save} disabled={!canSave || saving}
            className="w-full py-5 rounded-2xl font-bold text-xl disabled:opacity-40 active:opacity-80"
            style={{ backgroundColor: PLAN_ACCENT, color: C.text }}>
            {saving ? 'Saving…' : `Save recipe${selected.length > 0 ? ` (${selected.length} ingredients)` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
