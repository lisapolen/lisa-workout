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
  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(text) as GeneratedPlan
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json()
    let plan: GeneratedPlan
    try {
      plan = await callClaude(body)
    } catch (e) {
      console.error('generate-recipe first attempt failed:', e)
      plan = await callClaude(body)
    }
    return NextResponse.json(plan)
  } catch (e) {
    console.error('generate-recipe failed:', e)
    return NextResponse.json({ error: 'Failed to generate recipe' }, { status: 500 })
  }
}
