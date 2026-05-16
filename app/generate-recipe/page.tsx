'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getLocalDate } from '@/lib/utils'

const C = {
  bg:     '#1C1814',
  card:   '#2D2520',
  border: '#3A3228',
  text:   '#F5F0E8',
  muted:  '#C4B098',
  accent: '#C4714A',
}
const PLAN_ACCENT = '#A87FA8'

interface GeneratedExercise { id: number; sets: number; reps: string }
interface GeneratedPlan { name: string; rationale: string; exercises: GeneratedExercise[] }

export default function GenerateRecipePage() {
  const router = useRouter()
  const [plan, setPlan] = useState<GeneratedPlan | null>(null)
  const [nameMap, setNameMap] = useState<Record<number, { name: string; block: string }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function buildPayload() {
    const today = getLocalDate()
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const [{ data: exData }, { data: plansData }, { data: sessionsData }] = await Promise.all([
      supabase.from('exercises').select('id, name, sets, reps, blocks(name)').order('sort_order'),
      supabase.from('plans').select('name'),
      supabase.from('sessions').select('id, date, feeling').gte('date', cutoffStr).order('date', { ascending: false }),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exercises = (exData ?? []).map((e: any) => ({ id: e.id, name: e.name, block: e.blocks?.name ?? '', sets: e.sets, reps: e.reps }))
    const map: Record<number, { name: string; block: string }> = {}
    exercises.forEach(e => { map[e.id] = { name: e.name, block: e.block } })
    setNameMap(map)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionIds = (sessionsData ?? []).map((s: any) => s.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let setsRows: any[] = []
    if (sessionIds.length > 0) {
      const { data } = await supabase.from('sets_log').select('session_id, exercise_id').in('session_id', sessionIds)
      setsRows = data ?? []
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentSessions = (sessionsData ?? []).map((s: any) => {
      const counts: Record<number, number> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setsRows.filter((r: any) => r.session_id === s.id).forEach((r: any) => { counts[r.exercise_id] = (counts[r.exercise_id] || 0) + 1 })
      return { date: s.date, feeling: s.feeling, exercises: Object.entries(counts).map(([id, sets]) => ({ id: Number(id), sets })) }
    })
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { exercises, recentSessions, existingPlanNames: (plansData ?? []).map((p: any) => p.name), today, dayOfWeek: days[new Date().getDay()] }
  }

  async function generate() {
    setLoading(true); setError(''); setPlan(null)
    try {
      const payload = await buildPayload()
      const res = await fetch('/api/generate-recipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPlan(data)
    } catch {
      setError('Could not generate a recipe — check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { generate() }, [])

  async function saveRecipe(dest: 'library' | 'start') {
    if (!plan || saving) return
    setSaving(true)
    try {
      const { data: saved, error: planErr } = await supabase.from('plans').insert({ name: plan.name, sort_order: 0 }).select('id').single()
      if (planErr || !saved) throw new Error()
      await supabase.from('plan_exercises').insert(plan.exercises.map((ex, i) => ({ plan_id: saved.id, exercise_id: ex.id, sort_order: i })))
      router.push(dest === 'library' ? '/recipes' : `/recipes/${saved.id}`)
    } catch {
      setError('Failed to save — try again')
      setSaving(false)
    }
  }

  const grouped: Record<string, Array<GeneratedExercise & { name: string }>> = {}
  if (plan) {
    for (const ex of plan.exercises) {
      const info = nameMap[ex.id]
      const block = info?.block ?? 'Other'
      if (!grouped[block]) grouped[block] = []
      grouped[block].push({ ...ex, name: info?.name ?? `Ingredient ${ex.id}` })
    }
  }

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      <button onClick={() => router.push('/')} className="py-3 pr-6 pl-1 text-sm mb-4" style={{ color: C.muted }}>&lsaquo; Back</button>

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 rounded-full border-2 animate-spin" style={{ borderColor: `${PLAN_ACCENT}40`, borderTopColor: PLAN_ACCENT }} />
          <p className="text-sm" style={{ color: C.muted }}>Reading the cookbook...</p>
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-16">
          <p className="mb-5" style={{ color: C.muted }}>{error}</p>
          <button onClick={generate} className="px-6 py-3 rounded-xl font-semibold" style={{ backgroundColor: PLAN_ACCENT, color: C.text }}>Try again</button>
        </div>
      )}

      {plan && !loading && (
        <>
          <div className="rounded-r-xl p-3 mb-5" style={{ borderLeft: `3px solid ${PLAN_ACCENT}`, backgroundColor: '#1E1826' }}>
            <p className="text-sm" style={{ color: C.muted }}>{plan.rationale}</p>
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: C.text }}>{plan.name}</h1>
          <p className="text-sm mb-5" style={{ color: C.muted }}>{plan.exercises.length} ingredients &middot; generated by Claude</p>
          <div className="mb-6">
            {Object.entries(grouped).map(([block, exercises]) => (
              <div key={block} className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.accent }}>{block}</p>
                {exercises.map(ex => (
                  <div key={ex.id} className="flex justify-between py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: C.text }}>{ex.name}</span>
                    <span style={{ color: C.muted }}>{ex.sets} &times; {ex.reps}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {error && <p className="text-sm mb-3" style={{ color: '#C4514A' }}>{error}</p>}
          <div className="flex flex-col gap-3">
            <button onClick={() => saveRecipe('library')} disabled={saving}
              className="w-full font-bold text-xl rounded-xl py-5 disabled:opacity-40 active:opacity-80"
              style={{ backgroundColor: PLAN_ACCENT, color: C.text }}>
              {saving ? 'Saving...' : 'Save recipe'}
            </button>
            <button onClick={() => saveRecipe('start')} disabled={saving}
              className="w-full font-bold text-xl rounded-xl py-5 disabled:opacity-40 active:opacity-80"
              style={{ border: `1px solid ${PLAN_ACCENT}`, color: PLAN_ACCENT, backgroundColor: 'transparent' }}>
              Just start
            </button>
            <button onClick={generate} disabled={saving} className="text-sm py-2 disabled:opacity-40" style={{ color: C.muted }}>
              Generate another
            </button>
          </div>
        </>
      )}
    </div>
  )
}
