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

export default function NewPlanPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [allExercises, setAllExercises] = useState<ExerciseWithBlock[]>([])
  const [selected, setSelected] = useState<ExerciseWithBlock[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('exercises')
        .select('*, blocks(name)')
        .order('sort_order')
      if (data) {
        setAllExercises(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.map((ex: any) => ({ ...ex, blockName: ex.blocks?.name ?? '' }))
            .filter((ex: ExerciseWithBlock) => ex.blockName !== '')
        )
      }
    }
    load()
  }, [])

  function toggleExercise(ex: ExerciseWithBlock) {
    setSelected(prev => {
      const exists = prev.find(e => e.id === ex.id)
      if (exists) return prev.filter(e => e.id !== ex.id)
      return [...prev, ex]
    })
  }

  function moveUp(index: number) {
    if (index === 0) return
    setSelected(prev => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  function moveDown(index: number) {
    setSelected(prev => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  async function save() {
    if (!name.trim() || selected.length === 0 || saving) return
    setSaving(true)
    setError('')
    try {
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .insert({ name: name.trim(), sort_order: 0 })
        .select('id')
        .single()
      if (planError || !plan) throw new Error('Could not create plan')

      const planExercises = selected.map((ex, i) => ({
        plan_id: plan.id,
        exercise_id: ex.id,
        sort_order: i,
      }))
      const { error: exError } = await supabase.from('plan_exercises').insert(planExercises)
      if (exError) throw exError

      router.push('/plans')
    } catch {
      setError('Failed to save plan — check connection')
      setSaving(false)
    }
  }

  // Group exercises by block name
  const byBlock: Record<string, ExerciseWithBlock[]> = {}
  for (const ex of allExercises) {
    if (!byBlock[ex.blockName]) byBlock[ex.blockName] = []
    byBlock[ex.blockName].push(ex)
  }
  const selectedIds = new Set(selected.map(e => e.id))
  const canSave = name.trim().length > 0 && selected.length > 0

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      <button onClick={() => router.push('/plans')} className="text-sm mb-4" style={{ color: C.muted }}>
        &lsaquo; Plans
      </button>
      <h1 className="text-3xl font-bold mb-2" style={{ color: C.text }}>New Plan</h1>
      <div className="h-1 w-12 rounded-full mb-6" style={{ backgroundColor: PLAN_ACCENT }} />

      {/* Name */}
      <div className="mb-6">
        <label className="text-sm mb-2 block" style={{ color: C.muted }}>Plan name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Push Day, Plan A, Full Body…"
          className="w-full rounded-xl px-4 py-3 text-xl font-semibold outline-none"
          style={{ backgroundColor: C.card, border: `2px solid ${name ? PLAN_ACCENT : C.border}`, color: C.text }}
        />
      </div>

      {/* Selected list */}
      {selected.length > 0 && (
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: C.muted }}>
            Selected ({selected.length})
          </p>
          <div className="flex flex-col gap-2">
            {selected.map((ex, i) => (
              <div
                key={ex.id}
                className="flex items-center gap-2 rounded-2xl p-4"
                style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${PLAN_ACCENT}` }}
              >
                <div className="flex flex-col gap-1 mr-1">
                  <button
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                    className="text-lg leading-none disabled:opacity-20"
                    style={{ color: C.muted }}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveDown(i)}
                    disabled={i === selected.length - 1}
                    className="text-lg leading-none disabled:opacity-20"
                    style={{ color: C.muted }}
                  >
                    ↓
                  </button>
                </div>
                <div className="flex-1">
                  <p className="font-semibold" style={{ color: C.text }}>{ex.name}</p>
                  <p className="text-xs" style={{ color: C.muted }}>{ex.blockName} · {ex.sets}×{ex.reps}</p>
                </div>
                <button
                  onClick={() => toggleExercise(ex)}
                  className="text-xl px-2"
                  style={{ color: C.muted }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exercise picker */}
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider mb-3" style={{ color: C.muted }}>
          Exercise library
        </p>
        {Object.entries(byBlock).map(([blockName, exercises]) => (
          <div key={blockName} className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.accent }}>
              {blockName}
            </p>
            <div className="flex flex-col gap-2">
              {exercises.map(ex => {
                const isSelected = selectedIds.has(ex.id)
                return (
                  <button
                    key={ex.id}
                    onClick={() => toggleExercise(ex)}
                    className="flex items-center gap-3 rounded-xl p-4 text-left active:opacity-80"
                    style={{
                      backgroundColor: isSelected ? `${PLAN_ACCENT}18` : C.card,
                      border: `1px solid ${isSelected ? PLAN_ACCENT : C.border}`,
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{
                        borderColor: isSelected ? PLAN_ACCENT : C.border,
                        backgroundColor: isSelected ? PLAN_ACCENT : 'transparent',
                        color: C.text,
                      }}
                    >
                      {isSelected ? '✓' : ''}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold" style={{ color: C.text }}>{ex.name}</p>
                      <p className="text-xs" style={{ color: C.muted }}>{ex.sets}×{ex.reps}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Spacer so content isn't hidden behind sticky button */}
      <div className="h-24" />

      {error && <p className="text-sm mb-3" style={{ color: C.danger }}>{error}</p>}

      <div className="fixed bottom-0 left-0 right-0 px-4 pb-safe z-40" style={{ backgroundColor: C.bg }}>
        <div className="max-w-lg mx-auto py-3">
          <button
            onClick={save}
            disabled={!canSave || saving}
            className="w-full py-5 rounded-2xl font-bold text-xl disabled:opacity-40 active:opacity-80"
            style={{ backgroundColor: PLAN_ACCENT, color: C.text }}
          >
            {saving ? 'Saving…' : `Save plan${selected.length > 0 ? ` (${selected.length} exercises)` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
