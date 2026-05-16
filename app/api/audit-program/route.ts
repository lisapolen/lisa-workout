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
  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
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
