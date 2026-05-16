# AI Plan Generation — Design Spec
**Date:** 2026-05-15
**Status:** Approved

---

## Overview

Two distinct AI-powered features added to the workout tracker:

1. **Generate a plan** — "What should I do today?" — home screen entry point, Claude Haiku, fast
2. **Audit my program** — "How is my overall training going?" — Plans page entry point, Claude Sonnet, periodic

Both call the Anthropic API via Next.js API routes. Cost is negligible for a single-user personal app (~$0.001–$0.01 per call).

---

## Feature 1: Generate a Plan

### Entry Point
A subtle dashed card on the home screen, positioned below the saved plans section:

```
Not sure? Generate a plan        Go →
Claude picks based on what you've done recently
```

Purple accent (`#A87FA8`), dark background (`#1E1826`), dashed border. Compact — less visual weight than a plan card.

### Flow
1. User taps "Go →"
2. Navigates to `/generate-plan` — page immediately fires POST to `/api/generate-plan`
3. Loading state shown while Claude responds (~1–2 seconds, Haiku)
4. Result displayed: rationale callout + plan name + exercises grouped by block + three actions
5. User chooses: **Save as plan** | **Just start** | **Generate another**

### Actions
- **Save as plan** — inserts into `plans` + `plan_exercises`, navigates to `/plans/[id]`
- **Just start** — same insert (exercise logger requires a plan record), navigates directly to `/plans/[id]` skipping the confirmation step
- **Generate another** — re-fires the API call, replaces current result

### Result Screen (`app/generate-plan/page.tsx`)
- Back button → home
- Purple-bordered rationale callout (one sentence explaining why this selection)
- Plan name (Claude-generated, e.g. "Upper & Core Day")
- Exercise list grouped by block type, each showing sets × reps
- Three action buttons stacked: filled Save, outline Just start, text Generate another

### API Route: `POST /api/generate-plan`

**Request body (assembled client-side from Supabase):**
```json
{
  "exercises": [{ "id": 1, "name": "Bench Press", "block": "Upper Body", "sets": 3, "reps": "8-10" }],
  "recentSessions": [{ "date": "2026-05-13", "feeling": "great", "exercises": [{ "id": 1, "sets": 3 }] }],
  "existingPlanNames": ["Plan A", "Push Day"],
  "today": "2026-05-15",
  "dayOfWeek": "Thursday"
}
```

**Data window:** last 14 days of sessions. No weights sent — not needed for selection logic.

**Model:** `claude-haiku-4-5-20251001`

**System prompt:**
```
You are a personal trainer for a single user. Given their exercise library and recent
workout history, suggest a balanced workout plan for today. Avoid exercises from
muscle groups worked in the last 48 hours. Balance push/pull and include core if it
has been neglected. Pick 5–8 exercises. Respond in JSON only — no prose, no markdown.
```

**Response schema:**
```json
{
  "name": "Upper & Core Day",
  "rationale": "Your lower body was worked 2 days ago. Upper body and core haven't been hit since Monday.",
  "exercises": [
    { "id": 4, "sets": 3, "reps": "8-10" },
    { "id": 7, "sets": 3, "reps": "10-12" }
  ]
}
```

Exercise `id` values are drawn from the exercise library provided — no fuzzy matching needed. Saving inserts these IDs directly into `plan_exercises`.

---

## Feature 2: Audit My Program

### Entry Point
On the Plans page (`/plans`), below the "+ New plan" pill and a horizontal divider:

```
Audit my program                          Review
Claude reviews your last 6 weeks and suggests changes
```

Quiet treatment — muted text, small "Review" button with border. This is a periodic action, not a frequent one.

### Flow
1. User taps "Review"
2. Navigates to `/plans/audit` — page immediately fires POST to `/api/audit-program`
3. Loading state shown while Claude responds (~3–5 seconds, Sonnet)
4. Result: observations + suggested new plan
5. User chooses: **Save this plan** | **Dismiss**

### Actions
- **Save this plan** — inserts into `plans` + `plan_exercises`, navigates to `/plans/[id]`
- **Dismiss** — navigates back to `/plans`

Existing plans are never modified — the audit only ever adds a new plan to the rotation.

### Result Screen (`app/plans/audit/page.tsx`)
- Back → Plans
- "Program audit" heading + "Based on your last 6 weeks" subtitle
- Observations section: 2–4 cards, each color-coded by severity:
  - Red (`#C4514A`) — significant gap (muscle group skipped 2+ weeks)
  - Amber (`#C4A44A`) — moderate issue (routine stale, pattern imbalanced)
  - Green (`#6B8F6B`) — positive observation (something working well, keep it)
- Suggested new plan card: plan name, one-sentence description explaining how it addresses the gaps, exercise list (collapsed to first 4 + "X more")
- Save button (filled purple) + Dismiss (text)

### API Route: `POST /api/audit-program`

**Request body:**
```json
{
  "exercises": [{ "id": 1, "name": "Bench Press", "block": "Upper Body", "sets": 3, "reps": "8-10" }],
  "sessions": [{ "date": "2026-04-01", "feeling": "okay", "exercises": [{ "id": 1, "sets": 3, "reps": 8 }] }],
  "existingPlans": [{ "name": "Plan A", "exercises": [1, 4, 7, 12, 15] }],
  "today": "2026-05-15"
}
```

**Data window:** last 6 weeks of sessions. Reps included (unlike generate-plan) so Claude can assess progression patterns.

**Model:** `claude-sonnet-4-6`

**System prompt:**
```
You are a personal trainer reviewing a client's 6-week training history. Identify
2–4 specific patterns: muscle groups neglected, routines gone stale, imbalances,
or things working well. Then suggest one new plan (5–8 exercises) that specifically
addresses the gaps you identified. The suggested plan should complement existing
plans, not duplicate them. Respond in JSON only — no prose, no markdown.
```

**Response schema:**
```json
{
  "observations": [
    { "text": "Core has been skipped for 3 weeks — only 1 session logged", "severity": "red" },
    { "text": "Lower body routine unchanged for 8 sessions", "severity": "amber" },
    { "text": "Upper body push/pull balance is good — keep it", "severity": "green" }
  ],
  "plan": {
    "name": "Plan B — Lower + Core",
    "description": "Adds the core work and hinge pattern your current plans are missing",
    "exercises": [
      { "id": 3, "sets": 3, "reps": "8" },
      { "id": 9, "sets": 3, "reps": "10" }
    ]
  }
}
```

---

## Shared Implementation Details

### API Key
`ANTHROPIC_API_KEY` in `.env.local`. Add to Vercel environment variables via dashboard or `vercel env add`.

### Error Handling
Both result pages handle two failure cases:
- **Network / API error** — inline error message + "Try again" button (re-fires the same call)
- **Malformed JSON response** — retry once automatically; if second attempt also fails, show error + "Try again"

No silent failures. No partial renders of broken data.

### New Files
| File | Purpose |
|---|---|
| `app/api/generate-plan/route.ts` | Anthropic API call for daily plan generation |
| `app/api/audit-program/route.ts` | Anthropic API call for program audit |
| `app/generate-plan/page.tsx` | Loading + result UI for generated plan |
| `app/plans/audit/page.tsx` | Loading + result UI for program audit |

### Modified Files
| File | Change |
|---|---|
| `app/page.tsx` | Add "Generate a plan" entry point card below plans section |
| `app/plans/page.tsx` | Add "+ New plan" pill resize + "Audit my program" entry point |

### Dependencies
Install Anthropic SDK: `npm install @anthropic-ai/sdk`

### No Schema Changes
No new Supabase tables or columns required. Generated plans save into the existing `plans` + `plan_exercises` tables identically to manually built plans.

---

## UX Details

### Loading States
- **Generate a plan:** full-page loading state on `/generate-plan` — pulsing purple card with "Claude is picking your workout..." text
- **Audit:** full-page loading state on `/plans/audit` — "Reviewing your last 6 weeks..."

### Color Usage
All new UI uses the existing plan accent purple (`#A87FA8`). Audit observation severity colors reuse existing palette: `#C4514A` (danger), `#C4A44A` (cardio accent), `#6B8F6B` (success).

### Saving Behavior
Both "Save as plan" and "Just start" insert into `plans` + `plan_exercises`. The only difference is navigation: Save shows the plan page, Just start goes directly to the first exercise. This means "just started" plans appear in the plans list — the user can delete them if they don't want to keep them.
