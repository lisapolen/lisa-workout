'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plan } from '@/lib/types'
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

function relativeDate(iso: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(iso); d.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  return `${diff} days ago`
}

function getMondayOfWeek(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function PlansPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [lastSessionByPlan, setLastSessionByPlan] = useState<Record<number, string>>({})
  const [weekDonePlans, setWeekDonePlans] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  useEffect(() => {
    if (confirmDelete !== null) {
      requestAnimationFrame(() => {
        document.getElementById(`plan-card-${confirmDelete}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  }, [confirmDelete])

  async function load() {
    const monday = getMondayOfWeek()
    const [{ data: planData }, { data: sessionData }] = await Promise.all([
      supabase.from('plans').select('*').order('sort_order'),
      supabase.from('sessions').select('plan_id, date').not('plan_id', 'is', null).order('date', { ascending: false }),
    ])
    setPlans(planData ?? [])

    const lastByPlan: Record<number, string> = {}
    const weekDone = new Set<number>()
    for (const s of sessionData ?? []) {
      if (!s.plan_id) continue
      if (!lastByPlan[s.plan_id]) lastByPlan[s.plan_id] = s.date
      if (s.date >= monday) weekDone.add(s.plan_id)
    }
    setLastSessionByPlan(lastByPlan)
    setWeekDonePlans(weekDone)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deletePlan(planId: number) {
    await supabase.from('plans').delete().eq('id', planId)
    setConfirmDelete(null)
    load()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64" style={{ color: C.muted }}>Loading...</div>
  }

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      <button onClick={() => router.push('/')} className="text-sm mb-4" style={{ color: C.muted }}>
        &lsaquo; Home
      </button>
      <h1 className="text-3xl font-bold mb-2" style={{ color: C.text }}>My Plans</h1>
      <div className="h-1 w-12 rounded-full mb-6" style={{ backgroundColor: PLAN_ACCENT }} />

      {plans.length === 0 ? (
        <div className="rounded-2xl p-8 text-center mb-6" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <p className="font-semibold mb-2" style={{ color: C.text }}>No plans yet</p>
          <p className="text-sm mb-6" style={{ color: C.muted }}>
            Save a mix of exercises from your blocks as a named Plan — like Push Day or Plan A — then rotate through 2–3 plans across the week.
          </p>
          <Link
            href="/plans/new"
            className="inline-block px-6 py-3 rounded-xl font-semibold"
            style={{ backgroundColor: PLAN_ACCENT, color: C.text }}
          >
            Create your first plan
          </Link>
        </div>
      ) : (
        <>
        <div className="flex flex-col gap-3 mb-6">
          {plans.map(plan => {
            const lastDate = lastSessionByPlan[plan.id]
            const doneTW = weekDonePlans.has(plan.id)
            const isDeleting = confirmDelete === plan.id
            return (
              <div
                key={plan.id}
                id={`plan-card-${plan.id}`}
                className="rounded-2xl p-5"
                style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${PLAN_ACCENT}` }}
              >
                {isDeleting ? (
                  <div>
                    <p className="font-semibold mb-3" style={{ color: C.text }}>Delete &ldquo;{plan.name}&rdquo;?</p>
                    <p className="text-sm mb-4" style={{ color: C.muted }}>This removes the plan template. Past session logs are kept.</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => deletePlan(plan.id)}
                        className="flex-1 py-2.5 rounded-xl font-semibold"
                        style={{ backgroundColor: C.danger, color: C.text }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="flex-1 py-2.5 rounded-xl font-semibold"
                        style={{ border: `1px solid ${C.border}`, color: C.muted }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Link href={`/plans/${plan.id}`} className="flex-1 active:opacity-80">
                      <p className="text-xl font-bold mb-0.5" style={{ color: C.text }}>{plan.name}</p>
                      <p className="text-sm" style={{ color: C.muted }}>
                        {lastDate ? `Last done: ${relativeDate(lastDate)}` : 'Never done'}
                      </p>
                    </Link>
                    <div className="flex flex-col items-end gap-1.5">
                      {doneTW && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${C.success}22`, color: C.success }}>
                          Done ✓
                        </span>
                      )}
                      <button
                        onClick={() => setConfirmDelete(plan.id)}
                        className="text-xs py-2 px-2"
                        style={{ color: C.muted }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-end mb-2">
          <Link
            href="/plans/new"
            className="text-sm font-semibold px-4 py-2 rounded-full active:opacity-80"
            style={{ border: `1px solid ${PLAN_ACCENT}`, color: PLAN_ACCENT }}
          >
            + New plan
          </Link>
        </div>
        <div className="pt-4 mt-2" style={{ borderTop: `1px solid ${C.border}` }}>
          <Link
            href="/plans/audit"
            className="flex items-center gap-3 active:opacity-80"
          >
            <div className="flex-1">
              <p className="font-semibold text-sm" style={{ color: C.text }}>Audit my program</p>
              <p className="text-xs mt-0.5" style={{ color: C.muted }}>Claude reviews your last 6 weeks and suggests changes</p>
            </div>
            <span className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.border}`, color: C.muted }}>
              Review
            </span>
          </Link>
        </div>
        </>
      )}
    </div>
  )
}
