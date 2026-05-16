'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Block, Plan, VO2maxLog } from '@/lib/types'
import { getLocalDate } from '@/lib/utils'
import { Toast } from '@/components/Toast'

const C = {
  bg:      '#1C1814',
  card:    '#2D2520',
  border:  '#3A3228',
  text:    '#F5F0E8',
  muted:   '#C4B098',
  accent:  '#C4714A',
  success: '#6B8F6B',
}

const BLOCK_ACCENT: Record<string, string> = {
  'Lower Body': '#C4714A',
  'Upper Body': '#6B9E8F',
  'Cardio':     '#C4A44A',
  'Core':       '#9E8B6B',
  'Recovery':   '#8A7FA8',
}

const BLOCK_ABBR: Record<string, string> = {
  'Lower Body': 'LB',
  'Upper Body': 'UB',
  'Cardio':     'Car',
  'Core':       'Core',
  'Recovery':   'Rec',
}

const BLOCK_LABEL: Record<string, string> = {
  strength: 'Strength',
  cardio:   'Cardio',
  core:     'Core',
  recovery: 'Recovery',
}

const VO2_MIN = 23
const VO2_MAX = 40
function vo2Pct(value: number): number {
  return Math.max(0, Math.min(100, ((value - VO2_MIN) / (VO2_MAX - VO2_MIN)) * 100))
}

function relativeDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000)
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

function daysAgoDate(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function computeStreak(walkDates: string[]): number {
  const dateSet = new Set(walkDates)
  let streak = 0
  const d = new Date()
  while (true) {
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!dateSet.has(ds)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

interface LastSessionInfo {
  date: string
  block_name: string
  exercises: { name: string; weight: number | null; reps: number | null }[]
}

export default function HomePage() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [vo2max, setVo2max] = useState<VO2maxLog | null>(null)
  const [lastSession, setLastSession] = useState<LastSessionInfo | null | false>(undefined as any)
  const [lastSessionByBlock, setLastSessionByBlock] = useState<Record<number, string>>({})

  // Weekly strip
  const [weekDoneBlocks, setWeekDoneBlocks] = useState<Set<number>>(new Set())
  const [weekSessionCount, setWeekSessionCount] = useState(0)
  const [weekCardioCt, setWeekCardioCt] = useState(0)
  const [lastCardioDate, setLastCardioDate] = useState<string | null>(null)

  // Walk
  const [todayWalk, setTodayWalk] = useState(false)
  const [walkStreak, setWalkStreak] = useState(0)
  const [walkLoading, setWalkLoading] = useState(false)

  // Plans
  const [plans, setPlans] = useState<Plan[]>([])
  const [lastSessionByPlan, setLastSessionByPlan] = useState<Record<number, string>>({})
  const [weekDonePlans, setWeekDonePlans] = useState<Set<number>>(new Set())
  const [plansNudgeDismissed, setPlansNudgeDismissed] = useState(true) // true by default to avoid flash

  // Toast
  const [toast, setToast] = useState<{ message: string; accent?: string } | null>(null)

  useEffect(() => {
    async function load() {
      const today = getLocalDate()
      const monday = getMondayOfWeek()
      const sixtyDaysAgo = daysAgoDate(60)

      const oneYearAgo = daysAgoDate(365)

      const [
        { data: blocksData },
        { data: vo2Data },
        { data: sessionData },
        { data: allSessions },
        { data: weekSessions },
        { data: walkToday },
        { data: walkHistory },
        { data: plansData },
        { data: planSessions },
      ] = await Promise.all([
        supabase.from('blocks').select('*').order('sort_order'),
        supabase.from('vo2max_log').select('*').order('date', { ascending: false }).limit(1),
        supabase.from('sessions').select('id, date, block_id, plan_id, blocks(name), plans(name)').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('sessions').select('block_id, date').not('block_id', 'is', null).gte('date', oneYearAgo).order('date', { ascending: false }),
        supabase.from('sessions').select('block_id, blocks(type)').gte('date', monday).not('block_id', 'is', null),
        supabase.from('walks_log').select('*').eq('date', today).maybeSingle(),
        supabase.from('walks_log').select('date').gte('date', sixtyDaysAgo).order('date', { ascending: false }),
        supabase.from('plans').select('*').order('sort_order'),
        supabase.from('sessions').select('plan_id, date').not('plan_id', 'is', null).order('date', { ascending: false }),
      ])

      setPlansNudgeDismissed(!!localStorage.getItem('plans_nudge_dismissed'))
      if (blocksData) setBlocks(blocksData)
      if (vo2Data?.[0]) setVo2max(vo2Data[0])

      // Last session by block
      const byBlock: Record<number, string> = {}
      allSessions?.forEach((s: any) => {
        if (s.block_id && !byBlock[s.block_id]) byBlock[s.block_id] = s.date
      })
      setLastSessionByBlock(byBlock)

      // Last cardio date
      const blockTypeMap: Record<number, string> = {}
      blocksData?.forEach((b: Block) => { blockTypeMap[b.id] = b.type })
      const lastCardio = allSessions?.find((s: any) => s.block_id && blockTypeMap[s.block_id] === 'cardio')
      setLastCardioDate(lastCardio?.date ?? null)

      // Weekly strip
      const doneBlocks = new Set<number>()
      let cardioCt = 0
      weekSessions?.forEach((s: any) => {
        if (s.block_id) doneBlocks.add(s.block_id)
        if ((s.blocks as any)?.type === 'cardio') cardioCt++
      })
      setWeekDoneBlocks(doneBlocks)
      setWeekSessionCount(weekSessions?.length ?? 0)
      setWeekCardioCt(cardioCt)

      // Plans
      if (plansData) setPlans(plansData)
      const byPlan: Record<number, string> = {}
      const weekDonePlansSet = new Set<number>()
      for (const s of planSessions ?? []) {
        if (!s.plan_id) continue
        if (!byPlan[s.plan_id]) byPlan[s.plan_id] = s.date
        if (s.date >= monday) weekDonePlansSet.add(s.plan_id)
      }
      setLastSessionByPlan(byPlan)
      setWeekDonePlans(weekDonePlansSet)

      // Walk
      const walked = !!walkToday
      setTodayWalk(walked)
      const walkDates = (walkHistory ?? []).map((w: any) => w.date as string)
      if (walked && !walkDates.includes(today)) walkDates.unshift(today)
      setWalkStreak(computeStreak(walkDates))

      // First full week easter egg
      if (blocksData && doneBlocks.size === blocksData.length && blocksData.length > 0) {
        const eggs = JSON.parse(localStorage.getItem('easter_eggs') || '{}')
        if (!eggs.first_full_week) {
          eggs.first_full_week = true
          localStorage.setItem('easter_eggs', JSON.stringify(eggs))
          setToast({ message: 'Full week. Every block. First time.', accent: C.success })
        }
      }

      // Last session detail
      if (!sessionData) { setLastSession(false); return }
      const s = sessionData as any
      const { data: setsData } = await supabase
        .from('sets_log')
        .select('exercise_id, weight, reps, exercises(name)')
        .eq('session_id', s.id)
        .order('set_number')

      const seen = new Set<number>()
      const exercises: LastSessionInfo['exercises'] = []
      for (const row of setsData ?? []) {
        const r = row as any
        if (!seen.has(r.exercise_id) && exercises.length < 3) {
          seen.add(r.exercise_id)
          exercises.push({ name: r.exercises?.name ?? '', weight: r.weight, reps: r.reps })
        }
      }
      const sessionName = (s.blocks as any)?.name ?? (s.plans as any)?.name ?? 'Workout'
      setLastSession({ date: s.date, block_name: sessionName, exercises })
    }
    load()
  }, [])

  async function toggleWalk() {
    if (walkLoading) return
    setWalkLoading(true)
    const today = getLocalDate()
    const sixtyDaysAgo = daysAgoDate(60)
    try {
      if (todayWalk) {
        await supabase.from('walks_log').delete().eq('date', today)
        setTodayWalk(false)
        const { data: wh } = await supabase.from('walks_log').select('date').gte('date', sixtyDaysAgo)
        setWalkStreak(computeStreak((wh ?? []).map((w: any) => w.date as string)))
      } else {
        await supabase.from('walks_log').insert({ date: today })
        setTodayWalk(true)
        const { data: wh } = await supabase.from('walks_log').select('date').gte('date', sixtyDaysAgo)
        const walkDates = [...new Set([today, ...(wh ?? []).map((w: any) => w.date as string)])]
        const newStreak = computeStreak(walkDates)
        setWalkStreak(newStreak)

        const eggs = JSON.parse(localStorage.getItem('easter_eggs') || '{}')
        if (newStreak >= 30 && !eggs.walk_streak_30) {
          eggs.walk_streak_30 = true
          localStorage.setItem('easter_eggs', JSON.stringify(eggs))
          setToast({ message: "30 days. That's a habit.", accent: C.success })
        } else if (newStreak >= 7 && !eggs.walk_streak_7) {
          eggs.walk_streak_7 = true
          localStorage.setItem('easter_eggs', JSON.stringify(eggs))
          setToast({ message: 'A week straight. The dog approves.', accent: BLOCK_ACCENT['Recovery'] })
        }
      }
    } finally {
      setWalkLoading(false)
    }
  }

  function getInsight(): string | null {
    const dayOfWeek = new Date().getDay() // 0=Sun, 4=Thu, 5=Fri, 6=Sat
    const isLateWeek = dayOfWeek >= 4 || dayOfWeek === 0
    if (weekCardioCt === 0 && isLateWeek) return "No cardio yet this week — even a Zone 2 walk counts."
    if (lastCardioDate) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const last = new Date(lastCardioDate)
      const diff = Math.floor((today.getTime() - last.getTime()) / 86400000)
      if (diff >= 6) return `It's been ${diff} days since your last cardio session.`
    }
    if (blocks.length > 0 && weekDoneBlocks.size === blocks.length) return "Full week. Every block done."
    if (weekSessionCount >= 4) return `Strong week — ${weekSessionCount} sessions.`
    if (walkStreak >= 7) return "7-day walk streak. That daily movement adds up."
    return null
  }

  const insight = getInsight()
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="px-4 pt-8 pb-28 max-w-lg mx-auto">
      {toast && <Toast message={toast.message} accent={toast.accent} onDone={() => setToast(null)} />}

      <p className="text-sm" style={{ color: C.muted }}>{dateStr}</p>
      <h1 className="text-3xl font-bold mt-1 mb-6" style={{ color: C.text }}>What are you doing today?</h1>

      {/* Block cards */}
      <div className="flex flex-col gap-3 mb-5">
        {blocks.map((block, i) => (
          <Link
            key={block.id}
            href={`/block/${block.id}`}
            className="flex items-center gap-4 p-5 rounded-2xl active:opacity-80"
            style={{ backgroundColor: C.card, borderLeft: `3px solid ${BLOCK_ACCENT[block.name] ?? C.accent}` }}
          >
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: C.muted }}>
                Block {i + 1} &middot; {BLOCK_LABEL[block.type]}
              </p>
              <p className="text-xl font-bold" style={{ color: C.text }}>{block.name}</p>
              {lastSessionByBlock[block.id] && (
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                  Last: {relativeDate(lastSessionByBlock[block.id])}
                </p>
              )}
            </div>
            <span className="text-3xl leading-none" style={{ color: C.muted }}>&rsaquo;</span>
          </Link>
        ))}
      </div>

      {/* Plans nudge — shown once when no plans exist */}
      {plans.length === 0 && !plansNudgeDismissed && (
        <div
          className="rounded-2xl p-4 mb-5 flex items-start gap-3"
          style={{ backgroundColor: '#1E1826', border: '1px solid #A87FA840', borderLeft: '3px solid #A87FA8' }}
        >
          <div className="flex-1">
            <p className="font-semibold text-sm mb-0.5" style={{ color: '#F5F0E8' }}>Mix it up with Plans</p>
            <p className="text-xs" style={{ color: '#C4B098' }}>
              Build a custom workout from exercises across your blocks — like Push Day or Plan A — and rotate through them across the week.
            </p>
            <Link
              href="/recipes/new"
              className="inline-block mt-2 text-xs font-semibold"
              style={{ color: '#A87FA8' }}
            >
              Create a plan →
            </Link>
          </div>
          <button
            onClick={() => {
              localStorage.setItem('plans_nudge_dismissed', '1')
              setPlansNudgeDismissed(true)
            }}
            className="text-xl leading-none px-1 pt-0.5 flex-shrink-0"
            style={{ color: '#C4B098' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Plans section */}
      {plans.length > 0 && (
        <div className="mb-5">
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: C.muted }}>My Recipes</p>
          {/* Most recent recipe quick-start */}
          {(() => {
            const today = getLocalDate()
            const mostRecent = plans.length > 0
              ? plans.reduce((best, p) => {
                  const d = lastSessionByPlan[p.id]
                  if (!d) return best
                  if (!best || d > (lastSessionByPlan[best.id] ?? '')) return p
                  return best
                }, null as typeof plans[0] | null)
              : null
            const cookedToday = mostRecent && lastSessionByPlan[mostRecent.id] === today
            return mostRecent && !cookedToday ? (
              <div className="mb-4 rounded-2xl p-4 flex items-center justify-between"
                style={{ backgroundColor: '#1E1826', border: `1px solid ${C.border}` }}>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: C.muted }}>Cook again</p>
                  <p className="font-bold" style={{ color: C.text }}>{mostRecent.name}</p>
                </div>
                <Link href={`/recipes/${mostRecent.id}`}
                  className="px-4 py-2 rounded-xl font-semibold text-sm active:opacity-80"
                  style={{ backgroundColor: '#A87FA8', color: C.text }}>
                  Cook →
                </Link>
              </div>
            ) : null
          })()}
          <div className="flex flex-col gap-3">
            {plans.map(plan => {
              const done = weekDonePlans.has(plan.id)
              return (
                <Link
                  key={plan.id}
                  href={`/recipes/${plan.id}`}
                  className="flex items-center gap-3 p-5 rounded-2xl active:opacity-80"
                  style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderLeft: '3px solid #A87FA8', opacity: done ? 0.6 : 1 }}
                >
                  <div className="flex-1">
                    <p className="text-xl font-bold" style={{ color: done ? C.muted : C.text }}>{plan.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                      {lastSessionByPlan[plan.id] ? `Last done: ${relativeDate(lastSessionByPlan[plan.id])}` : 'Never done'}
                    </p>
                  </div>
                  {done && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${C.success}22`, color: C.success }}>Done ✓</span>
                  )}
                  <span className="text-3xl leading-none" style={{ color: C.muted }}>&rsaquo;</span>
                </Link>
              )
            })}
          </div>
          <Link href="/recipes" className="text-xs mt-2 block text-right" style={{ color: C.muted }}>Manage →</Link>
        </div>
      )}

      {/* Generate a recipe entry point */}
      <Link
        href="/generate-recipe"
        className="flex items-center gap-3 rounded-2xl p-4 mb-5 active:opacity-80"
        style={{ backgroundColor: '#1E1826', border: '1px dashed #A87FA860', borderLeft: '3px solid #A87FA8' }}
      >
        <div className="flex-1">
          <p className="font-semibold text-sm" style={{ color: C.text }}>Not sure? Generate a recipe</p>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>Claude picks based on what you&apos;ve done recently</p>
        </div>
        <span className="text-sm font-bold" style={{ color: '#A87FA8' }}>Go &rarr;</span>
      </Link>

      {/* Weekly program strip */}
      {blocks.length > 0 && (
        <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <div className="flex justify-around mb-3">
            {blocks.map(block => {
              const done = weekDoneBlocks.has(block.id)
              const color = BLOCK_ACCENT[block.name] ?? C.accent
              return (
                <div key={block.id} className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-9 h-9 rounded-full border-2 flex items-center justify-center transition-colors"
                    style={done
                      ? { backgroundColor: color, borderColor: color }
                      : { borderColor: C.border }}
                  >
                    {done && <span className="text-sm font-bold" style={{ color: C.text }}>✓</span>}
                  </div>
                  <span className="text-xs" style={{ color: done ? color : C.border }}>
                    {BLOCK_ABBR[block.name] ?? block.name.slice(0, 3)}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-center" style={{ color: C.muted }}>
            {weekDoneBlocks.size} of {blocks.length} blocks this week
          </p>
          {plans.length > 0 && weekDonePlans.size > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
              {plans.filter(p => weekDonePlans.has(p.id)).map(p => (
                <span key={p.id} className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#A87FA820', color: '#A87FA8', border: '1px solid #A87FA8' }}>
                  {p.name} ✓
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Walk toggle */}
      <button
        onClick={toggleWalk}
        disabled={walkLoading}
        className="w-full rounded-2xl p-4 mb-2 flex items-center justify-between active:opacity-80 disabled:opacity-60 transition-colors"
        style={{
          backgroundColor: C.card,
          border: `1px solid ${todayWalk ? BLOCK_ACCENT['Recovery'] : C.border}`,
        }}
      >
        <div className="text-left">
          <p className="font-semibold" style={{ color: todayWalk ? BLOCK_ACCENT['Recovery'] : C.text }}>
            {todayWalk ? 'Walked today' : "Log today's walk"}
          </p>
          {walkStreak >= 2 && (
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>{walkStreak}-day streak</p>
          )}
        </div>
        <div
          className="w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
          style={todayWalk
            ? { backgroundColor: BLOCK_ACCENT['Recovery'], borderColor: BLOCK_ACCENT['Recovery'] }
            : { borderColor: C.border }}
        >
          {todayWalk && <span className="text-xs font-bold" style={{ color: C.text }}>✓</span>}
        </div>
      </button>

      {/* Insight line */}
      {insight && (
        <p className="text-sm mb-5 px-1" style={{ color: C.muted }}>{insight}</p>
      )}
      {!insight && <div className="mb-5" />}

      {/* VO2max widget */}
      {vo2max && (
        <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold" style={{ color: C.text }}>VO&#x2082;max</h2>
            <span className="text-xs" style={{ color: C.muted }}>Updated {relativeDate(vo2max.date)}</span>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-5xl font-bold" style={{ color: C.text }}>{vo2max.value}</span>
            <span style={{ color: C.muted }}>/ 34 goal</span>
          </div>
          <div className="w-full rounded-full h-3 mb-1" style={{ backgroundColor: C.border }}>
            <div
              className="h-3 rounded-full transition-all"
              style={{ width: `${vo2Pct(Number(vo2max.value)).toFixed(1)}%`, backgroundColor: C.accent }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs" style={{ color: C.muted }}>23 (low)</span>
            <span className="text-xs font-semibold" style={{ color: C.success }}>Target: 34</span>
            <span className="text-xs" style={{ color: C.muted }}>40 (athlete)</span>
          </div>
        </div>
      )}

      {/* Last session */}
      {lastSession === false ? (
        <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <p style={{ color: C.muted }}>No sessions logged yet &mdash; get started!</p>
        </div>
      ) : lastSession ? (
        <div className="rounded-2xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Last session</p>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-lg font-semibold" style={{ color: C.text }}>{lastSession.block_name}</p>
            <p className="text-sm" style={{ color: C.muted }}>{relativeDate(lastSession.date)}</p>
          </div>
          {lastSession.exercises.length > 0 && (
            <div className="space-y-1.5">
              {lastSession.exercises.map((ex, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: C.muted }}>{ex.name}</span>
                  <span className="text-sm font-semibold" style={{ color: C.accent }}>
                    {ex.weight != null ? `${ex.weight} lbs` : 'BW'} &times; {ex.reps}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
