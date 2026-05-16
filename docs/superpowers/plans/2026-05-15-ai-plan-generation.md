# AI Plan Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two Claude-powered features — "Generate a plan" (home screen, Haiku) and "Audit my program" (Plans page, Sonnet) — that suggest workouts and flag training patterns.

**Architecture:** Two Next.js API routes call Anthropic with Supabase data assembled client-side. Results render on dedicated pages (`/generate-plan`, `/plans/audit`). Generated plans save into the existing `plans` + `plan_exercises` tables — no schema changes.

**Tech Stack:** Next.js 16 App Router, `@anthropic-ai/sdk`, Supabase client, TypeScript, Tailwind v4

---

## Task 1: Install SDK and configure API key

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `.env.local`

- [ ] **Step 1: Install the Anthropic SDK**

```bash
cd C:/Users/lpole/lisa-workout
npm install @anthropic-ai/sdk
```

Expected: `added 1 package` (or similar), no errors.

- [ ] **Step 2: Add API key placeholder to .env.local**

Open `.env.local` and add this line (the actual key goes here — get it from platform.anthropic.com):

```
ANTHROPIC_API_KEY=your-key-here
```

- [ ] **Step 3: Verify build still passes**

```bash
npm run build
```

Expected: clean build, all routes listed, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Install @anthropic-ai/sdk"
```

---

## Task 2: Generate plan API route

**Files:**
- Create: `app/api/generate-plan/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/generate-plan/route.ts` with this content:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ExerciseInput {
  id: number
  name: string
  block: string
  sets: number | null
  reps: string | null
}

interface SessionInput {
  date: string
  feeling: string | null
  exercises: { id: number; sets: number }[]
}

interface RequestBody {
  exercises: ExerciseInput[]
  recentSessions: SessionInput[]
  existingPlanNames: string[]
  today: string
  dayOfWeek: string
}

interface GeneratedExercise {
  id: number
  sets: number
  reps: string
}

interface GeneratedPlan {
  name: string
  rationale: string
  exercises: GeneratedExercise[]
}

const SYSTEM_PROMPT = `You are a personal trainer for a single user. Given their exercise library and recent workout history, suggest a balanced workout plan for today. Avoid exercises from muscle groups worked in the last 48 hours. Balance push/pull and include core if it has been neglected. Pick 5–8 exercises from the provided library only — use their exact IDs. Respond in JSON only — no prose, no markdown. Schema: { "name": string, "rationale": string, "exercises": [{ "id": number, "sets": number, "reps": string }] }`

async function callClaude(body: RequestBody): Promise<GeneratedPlan> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Exercise library: ${JSON.stringify(body.exercises)}\n\nRecent sessions (last 14 days): ${JSON.stringify(body.recentSessions)}\n\nExisting plan names to avoid duplicating: ${body.existingPlanNames.join(', ') || 'none'}\n\nToday is ${body.dayOfWeek}, ${body.today}.\n\nRespond with a single JSON object:`,
    }],
  })
  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return JSON.parse(text) as GeneratedPlan
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json()
    let plan: GeneratedPlan
    try {
      plan = await callClaude(body)
    } catch {
      // Retry once on parse/API failure
      plan = await callClaude(body)
    }
    return NextResponse.json(plan)
  } catch {
    return NextResponse.json({ error: 'Failed to generate plan' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: clean build, `/api/generate-plan` listed as a dynamic route.

- [ ] **Step 3: Commit**

```bash
git add app/api/generate-plan/route.ts
git commit -m "Add generate-plan API route (Haiku)"
```

---

## Task 3: Audit program API route

**Files:**
- Create: `app/api/audit-program/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/audit-program/route.ts` with this content:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ExerciseInput {
  id: number
  name: string
  block: string
  sets: number | null
  reps: string | null
}

interface SessionExercise {
  id: number
  sets: number
  reps: number | null
}

interface SessionInput {
  date: string
  feeling: string | null
  exercises: SessionExercise[]
}

interface ExistingPlan {
  name: string
  exercises: number[]
}

interface RequestBody {
  exercises: ExerciseInput[]
  sessions: SessionInput[]
  existingPlans: ExistingPlan[]
  today: string
}

interface Observation {
  text: string
  severity: 'red' | 'amber' | 'green'
}

interface AuditPlan {
  name: string
  description: string
  exercises: { id: number; sets: number; reps: string }[]
}

interface AuditResult {
  observations: Observation[]
  plan: AuditPlan
}

const SYSTEM_PROMPT = `You are a personal trainer reviewing a client's 6-week training history. Identify 2–4 specific patterns: muscle groups neglected, routines gone stale, imbalances, or things working well. Then suggest one new plan (5–8 exercises) that specifically addresses the gaps you identified. The suggested plan should complement existing plans, not duplicate them. Use only exercise IDs from the provided library. Respond in JSON only — no prose, no markdown. Schema: { "observations": [{ "text": string, "severity": "red" | "amber" | "green" }], "plan": { "name": string, "description": string, "exercises": [{ "id": number, "sets": number, "reps": string }] } }`

async function callClaude(body: RequestBody): Promise<AuditResult> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Exercise library: ${JSON.stringify(body.exercises)}\n\nSessions (last 6 weeks): ${JSON.stringify(body.sessions)}\n\nExisting plans: ${JSON.stringify(body.existingPlans)}\n\nToday: ${body.today}\n\nRespond with a single JSON object:`,
    }],
  })
  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return JSON.parse(text) as AuditResult
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json()
    let result: AuditResult
    try {
      result = await callClaude(body)
    } catch {
      // Retry once on parse/API failure
      result = await callClaude(body)
    }
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to audit program' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: clean build, `/api/audit-program` listed as a dynamic route.

- [ ] **Step 3: Commit**

```bash
git add app/api/audit-program/route.ts
git commit -m "Add audit-program API route (Sonnet)"
```

---

## Task 4: Generate plan result page

**Files:**
- Create: `app/generate-plan/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/generate-plan/page.tsx` with this content:

```typescript
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

export default function GeneratePlanPage() {
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

    const [
      { data: exData },
      { data: plansData },
      { data: sessionsData },
    ] = await Promise.all([
      supabase.from('exercises').select('id, name, sets, reps, blocks(name)').order('sort_order'),
      supabase.from('plans').select('name'),
      supabase.from('sessions').select('id, date, feeling').gte('date', cutoffStr).order('date', { ascending: false }),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exercises = (exData ?? []).map((e: any) => ({
      id: e.id, name: e.name, block: e.blocks?.name ?? '', sets: e.sets, reps: e.reps,
    }))

    const map: Record<number, { name: string; block: string }> = {}
    exercises.forEach(e => { map[e.id] = { name: e.name, block: e.block } })
    setNameMap(map)

    const sessionIds = (sessionsData ?? []).map((s: any) => s.id)
    let setsRows: any[] = []
    if (sessionIds.length > 0) {
      const { data } = await supabase.from('sets_log').select('session_id, exercise_id').in('session_id', sessionIds)
      setsRows = data ?? []
    }

    const recentSessions = (sessionsData ?? []).map((s: any) => {
      const counts: Record<number, number> = {}
      setsRows.filter((r: any) => r.session_id === s.id).forEach((r: any) => {
        counts[r.exercise_id] = (counts[r.exercise_id] || 0) + 1
      })
      return {
        date: s.date, feeling: s.feeling,
        exercises: Object.entries(counts).map(([id, sets]) => ({ id: Number(id), sets })),
      }
    })

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return {
      exercises,
      recentSessions,
      existingPlanNames: (plansData ?? []).map((p: any) => p.name),
      today,
      dayOfWeek: days[new Date().getDay()],
    }
  }

  async function generate() {
    setLoading(true); setError(''); setPlan(null)
    try {
      const payload = await buildPayload()
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPlan(data)
    } catch {
      setError('Could not generate a plan — check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { generate() }, [])

  async function savePlan(dest: 'library' | 'start') {
    if (!plan || saving) return
    setSaving(true)
    try {
      const { data: saved, error: planErr } = await supabase
        .from('plans').insert({ name: plan.name, sort_order: 0 }).select('id').single()
      if (planErr || !saved) throw new Error()
      await supabase.from('plan_exercises').insert(
        plan.exercises.map((ex, i) => ({ plan_id: saved.id, exercise_id: ex.id, sort_order: i }))
      )
      router.push(dest === 'library' ? '/plans' : `/plans/${saved.id}`)
    } catch {
      setError('Failed to save — try again')
      setSaving(false)
    }
  }

  // Group exercises by block for display
  const grouped: Record<string, Array<GeneratedExercise & { name: string }>> = {}
  if (plan) {
    for (const ex of plan.exercises) {
      const info = nameMap[ex.id]
      const block = info?.block ?? 'Other'
      if (!grouped[block]) grouped[block] = []
      grouped[block].push({ ...ex, name: info?.name ?? `Exercise ${ex.id}` })
    }
  }

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      <button onClick={() => router.push('/')} className="py-3 pr-6 pl-1 text-sm mb-4" style={{ color: C.muted }}>
        &lsaquo; Back
      </button>

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div
            className="w-12 h-12 rounded-full border-2 animate-spin"
            style={{ borderColor: `${PLAN_ACCENT}40`, borderTopColor: PLAN_ACCENT }}
          />
          <p className="text-sm" style={{ color: C.muted }}>Claude is picking your workout...</p>
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-16">
          <p className="mb-5" style={{ color: C.muted }}>{error}</p>
          <button
            onClick={generate}
            className="px-6 py-3 rounded-xl font-semibold"
            style={{ backgroundColor: PLAN_ACCENT, color: C.text }}
          >
            Try again
          </button>
        </div>
      )}

      {plan && !loading && (
        <>
          {/* Rationale */}
          <div className="rounded-r-xl p-3 mb-5" style={{ borderLeft: `3px solid ${PLAN_ACCENT}`, backgroundColor: '#1E1826' }}>
            <p className="text-sm" style={{ color: C.muted }}>{plan.rationale}</p>
          </div>

          <h1 className="text-2xl font-bold mb-1" style={{ color: C.text }}>{plan.name}</h1>
          <p className="text-sm mb-5" style={{ color: C.muted }}>{plan.exercises.length} exercises &middot; suggested by Claude</p>

          {/* Exercise list */}
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
            <button
              onClick={() => savePlan('library')}
              disabled={saving}
              className="w-full font-bold text-xl rounded-xl py-5 disabled:opacity-40 active:opacity-80"
              style={{ backgroundColor: PLAN_ACCENT, color: C.text }}
            >
              {saving ? 'Saving...' : 'Save as plan'}
            </button>
            <button
              onClick={() => savePlan('start')}
              disabled={saving}
              className="w-full font-bold text-xl rounded-xl py-5 disabled:opacity-40 active:opacity-80"
              style={{ border: `1px solid ${PLAN_ACCENT}`, color: PLAN_ACCENT, backgroundColor: 'transparent' }}
            >
              Just start
            </button>
            <button
              onClick={generate}
              disabled={saving}
              className="text-sm py-2 disabled:opacity-40"
              style={{ color: C.muted }}
            >
              Generate another
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: clean build, `/generate-plan` listed as a static route.

- [ ] **Step 3: Commit**

```bash
git add app/generate-plan/page.tsx
git commit -m "Add generate plan result page"
```

---

## Task 5: Audit result page

**Files:**
- Create: `app/plans/audit/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/plans/audit/page.tsx` with this content:

```typescript
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
const SEV_COLOR: Record<string, string> = {
  red:   '#C4514A',
  amber: '#C4A44A',
  green: '#6B8F6B',
}

interface AuditExercise { id: number; sets: number; reps: string }
interface Observation { text: string; severity: 'red' | 'amber' | 'green' }
interface AuditPlan { name: string; description: string; exercises: AuditExercise[] }
interface AuditResult { observations: Observation[]; plan: AuditPlan }

export default function AuditPage() {
  const router = useRouter()
  const [result, setResult] = useState<AuditResult | null>(null)
  const [nameMap, setNameMap] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function buildPayload() {
    const today = getLocalDate()
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 42) // 6 weeks
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const [
      { data: exData },
      { data: plansData },
      { data: planExData },
      { data: sessionsData },
    ] = await Promise.all([
      supabase.from('exercises').select('id, name, sets, reps, blocks(name)').order('sort_order'),
      supabase.from('plans').select('id, name'),
      supabase.from('plan_exercises').select('plan_id, exercise_id'),
      supabase.from('sessions').select('id, date, feeling').gte('date', cutoffStr).order('date', { ascending: false }),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exercises = (exData ?? []).map((e: any) => ({
      id: e.id, name: e.name, block: e.blocks?.name ?? '', sets: e.sets, reps: e.reps,
    }))

    const map: Record<number, string> = {}
    exercises.forEach(e => { map[e.id] = e.name })
    setNameMap(map)

    const existingPlans = (plansData ?? []).map((p: any) => ({
      name: p.name,
      exercises: (planExData ?? []).filter((pe: any) => pe.plan_id === p.id).map((pe: any) => pe.exercise_id),
    }))

    const sessionIds = (sessionsData ?? []).map((s: any) => s.id)
    let setsRows: any[] = []
    if (sessionIds.length > 0) {
      const { data } = await supabase
        .from('sets_log').select('session_id, exercise_id, reps').in('session_id', sessionIds)
      setsRows = data ?? []
    }

    const sessions = (sessionsData ?? []).map((s: any) => {
      const counts: Record<number, { sets: number; reps: number | null }> = {}
      setsRows.filter((r: any) => r.session_id === s.id).forEach((r: any) => {
        if (!counts[r.exercise_id]) counts[r.exercise_id] = { sets: 0, reps: r.reps }
        counts[r.exercise_id].sets++
      })
      return {
        date: s.date, feeling: s.feeling,
        exercises: Object.entries(counts).map(([id, v]) => ({ id: Number(id), sets: v.sets, reps: v.reps })),
      }
    })

    return { exercises, sessions, existingPlans, today }
  }

  async function runAudit() {
    setLoading(true); setError(''); setResult(null)
    try {
      const payload = await buildPayload()
      const res = await fetch('/api/audit-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch {
      setError('Could not run audit — check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { runAudit() }, [])

  async function savePlan() {
    if (!result || saving) return
    setSaving(true)
    try {
      const { data: saved, error: planErr } = await supabase
        .from('plans').insert({ name: result.plan.name, sort_order: 0 }).select('id').single()
      if (planErr || !saved) throw new Error()
      await supabase.from('plan_exercises').insert(
        result.plan.exercises.map((ex, i) => ({ plan_id: saved.id, exercise_id: ex.id, sort_order: i }))
      )
      router.push('/plans')
    } catch {
      setError('Failed to save — try again')
      setSaving(false)
    }
  }

  const SHOW_LIMIT = 4

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      <button onClick={() => router.push('/plans')} className="py-3 pr-6 pl-1 text-sm mb-4" style={{ color: C.muted }}>
        &lsaquo; Plans
      </button>
      <h1 className="text-2xl font-bold mb-1" style={{ color: C.text }}>Program audit</h1>

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div
            className="w-12 h-12 rounded-full border-2 animate-spin"
            style={{ borderColor: `${PLAN_ACCENT}40`, borderTopColor: PLAN_ACCENT }}
          />
          <p className="text-sm" style={{ color: C.muted }}>Reviewing your last 6 weeks...</p>
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-16">
          <p className="mb-5" style={{ color: C.muted }}>{error}</p>
          <button
            onClick={runAudit}
            className="px-6 py-3 rounded-xl font-semibold"
            style={{ backgroundColor: PLAN_ACCENT, color: C.text }}
          >
            Try again
          </button>
        </div>
      )}

      {result && !loading && (
        <>
          <p className="text-sm mb-5" style={{ color: C.muted }}>Based on your last 6 weeks</p>

          {/* Observations */}
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: C.muted }}>
            What Claude noticed
          </p>
          <div className="flex flex-col gap-2 mb-6">
            {result.observations.map((obs, i) => (
              <div
                key={i}
                className="rounded-xl p-3"
                style={{ backgroundColor: C.card, borderLeft: `3px solid ${SEV_COLOR[obs.severity] ?? PLAN_ACCENT}` }}
              >
                <p className="text-sm" style={{ color: C.text }}>{obs.text}</p>
              </div>
            ))}
          </div>

          {/* Suggested plan */}
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: C.muted }}>
            Suggested new plan
          </p>
          <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${PLAN_ACCENT}` }}>
            <p className="font-bold text-lg mb-1" style={{ color: C.text }}>{result.plan.name}</p>
            <p className="text-xs mb-3" style={{ color: C.muted }}>{result.plan.description}</p>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
              {result.plan.exercises.slice(0, SHOW_LIMIT).map(ex => (
                <div key={ex.id} className="flex justify-between py-1.5">
                  <span className="text-sm" style={{ color: C.text }}>{nameMap[ex.id] ?? `Exercise ${ex.id}`}</span>
                  <span className="text-sm" style={{ color: C.muted }}>{ex.sets} &times; {ex.reps}</span>
                </div>
              ))}
              {result.plan.exercises.length > SHOW_LIMIT && (
                <p className="text-xs mt-1" style={{ color: C.muted }}>
                  + {result.plan.exercises.length - SHOW_LIMIT} more
                </p>
              )}
            </div>
          </div>

          {error && <p className="text-sm mb-3" style={{ color: C.danger }}>{error}</p>}

          <div className="flex flex-col gap-3">
            <button
              onClick={savePlan}
              disabled={saving}
              className="w-full font-bold text-xl rounded-xl py-5 disabled:opacity-40 active:opacity-80"
              style={{ backgroundColor: PLAN_ACCENT, color: C.text }}
            >
              {saving ? 'Saving...' : 'Save this plan'}
            </button>
            <button
              onClick={() => router.push('/plans')}
              className="text-sm py-2"
              style={{ color: C.muted }}
            >
              Dismiss
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: clean build, `/plans/audit` listed as a dynamic route.

- [ ] **Step 3: Commit**

```bash
git add app/plans/audit/page.tsx
git commit -m "Add program audit result page"
```

---

## Task 6: Home screen entry point

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add Link to imports if not already present**

`app/page.tsx` already imports `Link` from `next/link`. No change needed.

- [ ] **Step 2: Add the generate plan card after the plans section**

In `app/page.tsx`, find the closing `{/* Plans section */}` block (the one that ends with the `</div>` after `<Link href="/plans" ...>Manage →</Link>`). Add the generate card immediately after it:

```tsx
      {/* Generate a plan entry point */}
      <Link
        href="/generate-plan"
        className="flex items-center gap-3 rounded-2xl p-4 mb-5 active:opacity-80"
        style={{ backgroundColor: '#1E1826', border: '1px dashed #A87FA860', borderLeft: '3px solid #A87FA8' }}
      >
        <div className="flex-1">
          <p className="font-semibold text-sm" style={{ color: C.text }}>Not sure? Generate a plan</p>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>Claude picks based on what you&apos;ve done recently</p>
        </div>
        <span className="text-sm font-bold" style={{ color: '#A87FA8' }}>Go &rarr;</span>
      </Link>
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "Add Generate a plan entry point to home screen"
```

---

## Task 7: Plans page entry points

**Files:**
- Modify: `app/plans/page.tsx`

- [ ] **Step 1: Replace the full-width "+ New plan" button with a pill**

Find this block in `app/plans/page.tsx`:

```tsx
        <Link
          href="/plans/new"
          className="block w-full text-center py-4 rounded-2xl font-semibold text-lg active:opacity-80"
          style={{ backgroundColor: PLAN_ACCENT, color: C.text }}
        >
          + New plan
        </Link>
```

Replace with:

```tsx
        <div className="flex justify-end mb-2">
          <Link
            href="/plans/new"
            className="text-sm font-semibold px-4 py-2 rounded-full active:opacity-80"
            style={{ border: `1px solid ${PLAN_ACCENT}`, color: PLAN_ACCENT }}
          >
            + New plan
          </Link>
        </div>
```

- [ ] **Step 2: Add the audit entry point below the plan cards**

Immediately after the `</div>` that closes the `<Link ... + New plan>` block (now the pill wrapper div), add:

```tsx
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
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/plans/page.tsx
git commit -m "Add Audit my program entry point to Plans page"
```

---

## Task 8: Add API key to Vercel and push

**Files:** none

- [ ] **Step 1: Add ANTHROPIC_API_KEY to Vercel**

In the terminal, run:

```bash
vercel env add ANTHROPIC_API_KEY
```

When prompted, paste your Anthropic API key and select all environments (Production, Preview, Development). If the Vercel CLI isn't installed: add the key manually in the Vercel dashboard → Project → Settings → Environment Variables.

Alternatively, if Vercel CLI is unavailable, ask the user to add `ANTHROPIC_API_KEY` in the Vercel dashboard.

- [ ] **Step 2: Final build check**

```bash
npm run build
```

Expected: clean build, routes include `/generate-plan`, `/plans/audit`, `/api/generate-plan`, `/api/audit-program`.

- [ ] **Step 3: Push**

```bash
git push personal master
```

Expected: pushed to remote, Vercel deploy triggered.
