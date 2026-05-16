'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plan } from '@/lib/types'
import { getLocalDate, getMondayOfWeek, relativeDate } from '@/lib/utils'

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

export default function RecipesPage() {
  const router = useRouter()
  const [recipes, setRecipes] = useState<Plan[]>([])
  const [lastSessionByRecipe, setLastSessionByRecipe] = useState<Record<number, string>>({})
  const [weekDoneRecipes, setWeekDoneRecipes] = useState<Set<number>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  useEffect(() => {
    if (confirmDelete !== null) {
      requestAnimationFrame(() => {
        document.getElementById(`recipe-card-${confirmDelete}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  }, [confirmDelete])

  useEffect(() => {
    async function load() {
      const monday = getMondayOfWeek()
      const [{ data: recipeData }, { data: sessionData }] = await Promise.all([
        supabase.from('plans').select('*').order('sort_order'),
        supabase.from('sessions').select('plan_id, date').not('plan_id', 'is', null).order('date', { ascending: false }),
      ])
      setRecipes(recipeData ?? [])
      const lastByRecipe: Record<number, string> = {}
      const weekDone = new Set<number>()
      for (const s of sessionData ?? []) {
        if (!s.plan_id) continue
        if (!lastByRecipe[s.plan_id]) lastByRecipe[s.plan_id] = s.date
        if (s.date >= monday) weekDone.add(s.plan_id)
      }
      setLastSessionByRecipe(lastByRecipe)
      setWeekDoneRecipes(weekDone)
    }
    load()
  }, [])

  async function deleteRecipe(recipeId: number) {
    await supabase.from('plans').delete().eq('id', recipeId)
    setRecipes(prev => prev.filter(r => r.id !== recipeId))
    setConfirmDelete(null)
  }

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      <h1 className="text-3xl font-bold mb-2" style={{ color: C.text }}>My Recipes</h1>
      <div className="h-1 w-12 rounded-full mb-6" style={{ backgroundColor: PLAN_ACCENT }} />

      {recipes.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-semibold mb-2" style={{ color: C.text }}>Your cookbook is empty.</p>
          <p className="text-sm mb-6" style={{ color: C.muted }}>
            Let&apos;s write the first recipe.
          </p>
          <Link
            href="/recipes/new"
            className="inline-block px-6 py-3 rounded-2xl font-semibold"
            style={{ backgroundColor: PLAN_ACCENT, color: C.text }}
          >
            Create your first recipe
          </Link>
        </div>
      ) : (
        <>
          {recipes.map(recipe => {
            const lastDate = lastSessionByRecipe[recipe.id]
            const doneTW = weekDoneRecipes.has(recipe.id)
            const isDeleting = confirmDelete === recipe.id
            return (
              <div
                key={recipe.id}
                id={`recipe-card-${recipe.id}`}
                className="rounded-2xl mb-4 overflow-hidden"
                style={{ backgroundColor: C.card, borderLeft: `3px solid ${PLAN_ACCENT}` }}
              >
                <div
                  className="p-4 flex items-center justify-between cursor-pointer active:opacity-80"
                  onClick={() => !isDeleting && router.push(`/recipes/${recipe.id}`)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-lg" style={{ color: doneTW ? C.muted : C.text }}>{recipe.name}</p>
                      {recipe.type === 'circuit' && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${PLAN_ACCENT}25`, color: PLAN_ACCENT }}>
                          Circuit
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                      {lastDate ? `Last cook: ${relativeDate(lastDate)}` : 'Not cooked yet'}
                    </p>
                  </div>
                  {doneTW
                    ? <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: `${C.success}22`, color: C.success }}>Done ✓</span>
                    : <span style={{ color: C.muted, fontSize: 22 }}>›</span>
                  }
                </div>
                {isDeleting ? (
                  <div className="px-4 pb-4">
                    <p className="text-sm mb-3" style={{ color: C.text }}>Delete &ldquo;{recipe.name}&rdquo;? Past cooks are kept.</p>
                    <div className="flex gap-3">
                      <button onClick={() => deleteRecipe(recipe.id)} className="flex-1 py-2.5 rounded-xl font-semibold" style={{ backgroundColor: C.danger, color: C.text }}>Delete</button>
                      <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl" style={{ border: `1px solid ${C.border}`, color: C.muted }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(recipe.id)} className="text-xs py-2 px-4 pb-3" style={{ color: C.muted }}>
                    Delete
                  </button>
                )}
              </div>
            )
          })}

          <div className="flex justify-end mb-2">
            <Link href="/recipes/new" className="text-sm font-semibold px-4 py-2 rounded-full active:opacity-80"
              style={{ border: `1px solid ${PLAN_ACCENT}`, color: PLAN_ACCENT }}>
              + New recipe
            </Link>
          </div>

          <div className="pt-4 mt-2" style={{ borderTop: `1px solid ${C.border}` }}>
            <Link href="/recipes/rate" className="flex items-center gap-3 active:opacity-80">
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: C.text }}>Rate my cooking</p>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>Claude reviews your last 6 weeks and suggests changes</p>
              </div>
              <span className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.border}`, color: C.muted }}>Review</span>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
