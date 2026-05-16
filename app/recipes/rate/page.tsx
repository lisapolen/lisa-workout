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
  danger: '#C4514A',
}
const PLAN_ACCENT = '#A87FA8'
const SEV_COLOR: Record<string, string> = { red: '#C4514A', amber: '#C4A44A', green: '#6B8F6B' }

interface AuditExercise { id: number; sets: number; reps: string }
interface Observation { text: string; severity: 'red' | 'amber' | 'green' }
interface AuditPlan { name: string; description: string; exercises: AuditExercise[] }
interface AuditResult { observations: Observation[]; plan: AuditPlan }

export default function RateMyCookingPage() {
  const router = useRouter()
  const [result, setResult] = useState<AuditResult | null>(null)
  const [nameMap, setNameMap] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function buildPayload() {
    const today = getLocalDate()
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 42)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const [{ data: exData }, { data: plansData }, { data: planExData }, { data: sessionsData }] = await Promise.all([
      supabase.from('exercises').select('id, name, sets, reps, blocks(name)').order('sort_order'),
      supabase.from('plans').select('id, name'),
      supabase.from('plan_exercises').select('plan_id, exercise_id'),
      supabase.from('sessions').select('id, date, feeling').gte('date', cutoffStr).order('date', { ascending: false }),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exercises = (exData ?? []).map((e: any) => ({ id: e.id, name: e.name, block: e.blocks?.name ?? '', sets: e.sets, reps: e.reps }))
    const map: Record<number, string> = {}
    exercises.forEach(e => { map[e.id] = e.name })
    setNameMap(map)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingPlans = (plansData ?? []).map((p: any) => ({
      name: p.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exercises: (planExData ?? []).filter((pe: any) => pe.plan_id === p.id).map((pe: any) => pe.exercise_id),
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionIds = (sessionsData ?? []).map((s: any) => s.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let setsRows: any[] = []
    if (sessionIds.length > 0) {
      const { data } = await supabase.from('sets_log').select('session_id, exercise_id, reps').in('session_id', sessionIds)
      setsRows = data ?? []
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessions = (sessionsData ?? []).map((s: any) => {
      const counts: Record<number, { sets: number; reps: number | null }> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setsRows.filter((r: any) => r.session_id === s.id).forEach((r: any) => {
        if (!counts[r.exercise_id]) counts[r.exercise_id] = { sets: 0, reps: r.reps }
        counts[r.exercise_id].sets++
      })
      return { date: s.date, feeling: s.feeling, exercises: Object.entries(counts).map(([id, v]) => ({ id: Number(id), sets: v.sets, reps: v.reps })) }
    })
    return { exercises, sessions, existingPlans, today }
  }

  async function runAudit() {
    setLoading(true); setError(''); setResult(null)
    try {
      const payload = await buildPayload()
      const res = await fetch('/api/audit-program', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch {
      setError('Could not rate your cooking — check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { runAudit() }, [])

  async function saveRecipe() {
    if (!result || saving) return
    setSaving(true)
    try {
      const { data: saved, error: planErr } = await supabase.from('plans').insert({ name: result.plan.name, sort_order: 0 }).select('id').single()
      if (planErr || !saved) throw new Error()
      await supabase.from('plan_exercises').insert(result.plan.exercises.map((ex, i) => ({ plan_id: saved.id, exercise_id: ex.id, sort_order: i })))
      router.push('/recipes')
    } catch {
      setError('Failed to save — try again')
      setSaving(false)
    }
  }

  const SHOW_LIMIT = 4

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      <button onClick={() => router.push('/recipes')} className="py-3 pr-6 pl-1 text-sm mb-4" style={{ color: C.muted }}>&lsaquo; Recipes</button>
      <h1 className="text-2xl font-bold mb-1" style={{ color: C.text }}>Rate my cooking</h1>

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 rounded-full border-2 animate-spin" style={{ borderColor: `${PLAN_ACCENT}40`, borderTopColor: PLAN_ACCENT }} />
          <p className="text-sm" style={{ color: C.muted }}>Reviewing your last 6 weeks...</p>
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-16">
          <p className="mb-5" style={{ color: C.muted }}>{error}</p>
          <button onClick={runAudit} className="px-6 py-3 rounded-xl font-semibold" style={{ backgroundColor: PLAN_ACCENT, color: C.text }}>Try again</button>
        </div>
      )}

      {result && !loading && (
        <>
          <p className="text-sm mb-5" style={{ color: C.muted }}>Based on your last 6 weeks</p>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: C.muted }}>What Claude noticed</p>
          <div className="flex flex-col gap-2 mb-6">
            {result.observations.map((obs, i) => (
              <div key={i} className="rounded-xl p-3" style={{ backgroundColor: C.card, borderLeft: `3px solid ${SEV_COLOR[obs.severity] ?? PLAN_ACCENT}` }}>
                <p className="text-sm" style={{ color: C.text }}>{obs.text}</p>
              </div>
            ))}
          </div>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: C.muted }}>Suggested new recipe</p>
          <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${PLAN_ACCENT}` }}>
            <p className="font-bold text-lg mb-1" style={{ color: C.text }}>{result.plan.name}</p>
            <p className="text-xs mb-3" style={{ color: C.muted }}>{result.plan.description}</p>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
              {result.plan.exercises.slice(0, SHOW_LIMIT).map(ex => (
                <div key={ex.id} className="flex justify-between py-1.5">
                  <span className="text-sm" style={{ color: C.text }}>{nameMap[ex.id] ?? `Ingredient ${ex.id}`}</span>
                  <span className="text-sm" style={{ color: C.muted }}>{ex.sets} &times; {ex.reps}</span>
                </div>
              ))}
              {result.plan.exercises.length > SHOW_LIMIT && (
                <p className="text-xs mt-1" style={{ color: C.muted }}>+ {result.plan.exercises.length - SHOW_LIMIT} more</p>
              )}
            </div>
          </div>
          {error && <p className="text-sm mb-3" style={{ color: C.danger }}>{error}</p>}
          <div className="flex flex-col gap-3">
            <button onClick={saveRecipe} disabled={saving}
              className="w-full font-bold text-xl rounded-xl py-5 disabled:opacity-40 active:opacity-80"
              style={{ backgroundColor: PLAN_ACCENT, color: C.text }}>
              {saving ? 'Saving...' : 'Save this recipe'}
            </button>
            <button onClick={() => router.push('/recipes')} className="text-sm py-2" style={{ color: C.muted }}>Dismiss</button>
          </div>
        </>
      )}
    </div>
  )
}
