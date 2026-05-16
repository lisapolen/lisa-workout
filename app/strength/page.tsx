'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Block, Plan } from '@/lib/types'
import { getMondayOfWeek, relativeDate } from '@/lib/utils'
import { useUser } from '@/lib/context/UserContext'

const C = {
  bg:      '#1C1814',
  card:    '#2D2520',
  border:  '#3A3228',
  text:    '#F5F0E8',
  muted:   '#C4B098',
  accent:  '#C4714A',
  success: '#6B8F6B',
}

const PLAN_ACCENT = '#A87FA8'

const BLOCK_ACCENT: Record<string, string> = {
  'Lower Body': '#C4714A',
  'Upper Body': '#6B9E8F',
  'Core':       '#9E8B6B',
  'Recovery':   '#8A7FA8',
}

export default function StrengthPage() {
  const router = useRouter()
  const { userId } = useUser()
  const [plans, setPlans] = useState<Plan[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [lastSessionByPlan, setLastSessionByPlan] = useState<Record<number, string>>({})
  const [lastSessionByBlock, setLastSessionByBlock] = useState<Record<number, string>>({})
  const [weekDonePlans, setWeekDonePlans] = useState<Set<number>>(new Set())
  const [weekDoneBlocks, setWeekDoneBlocks] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!userId) return
    async function load() {
      const monday = getMondayOfWeek()
      const [
        { data: plansData },
        { data: blocksData },
        { data: planSessions },
        { data: blockSessions },
      ] = await Promise.all([
        supabase.from('plans').select('*').eq('user_id', userId).order('sort_order'),
        supabase.from('blocks').select('*').neq('type', 'cardio').order('sort_order'),
        supabase.from('sessions').select('plan_id, date').not('plan_id', 'is', null).eq('user_id', userId).order('date', { ascending: false }),
        supabase.from('sessions').select('block_id, date').not('block_id', 'is', null).eq('user_id', userId).order('date', { ascending: false }),
      ])

      if (plansData) setPlans(plansData)
      if (blocksData) setBlocks(blocksData)

      const byPlan: Record<number, string> = {}
      const weekDonePlansSet = new Set<number>()
      for (const s of planSessions ?? []) {
        if (!s.plan_id) continue
        if (!byPlan[s.plan_id]) byPlan[s.plan_id] = s.date
        if (s.date >= monday) weekDonePlansSet.add(s.plan_id)
      }
      setLastSessionByPlan(byPlan)
      setWeekDonePlans(weekDonePlansSet)

      const byBlock: Record<number, string> = {}
      const weekDoneBlocksSet = new Set<number>()
      for (const s of blockSessions ?? []) {
        if (!s.block_id) continue
        if (!byBlock[s.block_id]) byBlock[s.block_id] = s.date
        if (s.date >= monday) weekDoneBlocksSet.add(s.block_id)
      }
      setLastSessionByBlock(byBlock)
      setWeekDoneBlocks(weekDoneBlocksSet)
    }
    load()
  }, [userId])

  const sortedPlans = [...plans].sort((a, b) => {
    const da = lastSessionByPlan[a.id] ?? ''
    const db = lastSessionByPlan[b.id] ?? ''
    if (da && db) return db.localeCompare(da)
    if (da) return -1
    if (db) return 1
    return a.name.localeCompare(b.name)
  })
  const visiblePlans = sortedPlans.slice(0, 3)
  const hasMore = sortedPlans.length > 3

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      <button onClick={() => router.push('/')} className="text-sm mb-5" style={{ color: C.muted }}>
        &lsaquo; Home
      </button>
      <h1 className="text-3xl font-bold mb-6" style={{ color: C.text }}>Strength</h1>

      {/* Recipes */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.muted }}>My Recipes</p>
          <Link href="/recipes/new" className="text-xs font-semibold" style={{ color: PLAN_ACCENT }}>+ New</Link>
        </div>

        {plans.length === 0 ? (
          <div className="rounded-2xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            <p className="text-sm mb-3" style={{ color: C.muted }}>No recipes yet. Build one from the blocks below.</p>
            <Link href="/recipes/new" className="text-xs font-semibold" style={{ color: PLAN_ACCENT }}>
              Create a recipe &rarr;
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {visiblePlans.map(plan => {
                const done = weekDonePlans.has(plan.id)
                const last = lastSessionByPlan[plan.id]
                return (
                  <Link
                    key={plan.id}
                    href={`/recipes/${plan.id}`}
                    className="flex items-center gap-3 p-4 rounded-2xl active:opacity-80"
                    style={{ backgroundColor: C.card, borderLeft: `3px solid ${PLAN_ACCENT}` }}
                  >
                    <div className="flex-1">
                      <p className="font-bold" style={{ color: done ? C.muted : C.text }}>{plan.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                        {last ? `Last: ${relativeDate(last)}` : 'Not yet cooked'}
                      </p>
                    </div>
                    {done && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${C.success}22`, color: C.success }}>
                        Done ✓
                      </span>
                    )}
                    <span className="text-2xl leading-none" style={{ color: C.muted }}>&rsaquo;</span>
                  </Link>
                )
              })}
            </div>
            {hasMore && (
              <Link href="/recipes" className="text-xs mt-2 block text-right" style={{ color: C.muted }}>
                See all recipes &rarr;
              </Link>
            )}
          </>
        )}
      </div>

      {/* Blocks */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: C.muted }}>Blocks</p>
        <div className="flex flex-col gap-3">
          {blocks.map(block => {
            const done = weekDoneBlocks.has(block.id)
            const last = lastSessionByBlock[block.id]
            const accent = BLOCK_ACCENT[block.name] ?? C.accent
            return (
              <Link
                key={block.id}
                href={`/block/${block.id}`}
                className="flex items-center gap-3 p-4 rounded-2xl active:opacity-80"
                style={{ backgroundColor: C.card, borderLeft: `3px solid ${accent}` }}
              >
                <div className="flex-1">
                  <p className="font-bold" style={{ color: done ? C.muted : C.text }}>{block.name}</p>
                  {last && (
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>Last: {relativeDate(last)}</p>
                  )}
                </div>
                {done && <span className="text-sm font-bold" style={{ color: C.success }}>✓</span>}
                <span className="text-2xl leading-none" style={{ color: C.muted }}>&rsaquo;</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
