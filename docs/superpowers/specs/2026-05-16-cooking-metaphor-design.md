# Cooking Metaphor Redesign — Design Spec (Part A)
**Date:** 2026-05-16
**Status:** Approved

---

## Overview

Rebrand the workout app around a cooking metaphor throughout. Exercises become **ingredients**, workout plans become **recipes**, doing a workout becomes **cooking**. This is a UI/UX rename — the database schema mostly stays intact. The main new feature is a full-screen **Cooking mode** that replaces the per-exercise logger with a single guided session experience.

Part B (ingredient library seeding: 10 per cuisine with descriptions and video links) is a separate spec.

---

## Terminology Map

| Current | New | Notes |
|---|---|---|
| Exercise | Ingredient | DB column stays `exercises` |
| Block | Category | UI label only — Lower Body, Upper Body, Core, Cardio, Recovery stay as-is |
| Equipment/style (new) | Cuisine | New field on exercises — Free Weights, Kettlebell, Weight Machine, Mat Work, Bodyweight, Bands |
| Plan | Recipe | DB table stays `plans` |
| Plan builder | Recipe builder | |
| Start / Just start | Cook | |
| Session | Cook (noun) | "Your last cook was Tuesday" |
| Session history / Progress | Kitchen Log | |
| Generate a plan | Generate a recipe | |
| Audit my program | Rate my cooking | |
| "My Plans" (nav) | Recipes | |

---

## Schema Changes

```sql
-- Add cuisine to exercises (equipment/style)
ALTER TABLE public.exercises ADD COLUMN cuisine text;

-- Add recipe type and rounds to plans
ALTER TABLE public.plans ADD COLUMN type text NOT NULL DEFAULT 'straight';
ALTER TABLE public.plans ADD COLUMN rounds integer NOT NULL DEFAULT 3;

-- Track set outcome in sets_log
ALTER TABLE public.sets_log ADD COLUMN status text NOT NULL DEFAULT 'done';
-- status values: 'done' | 'skipped' | 'partial'
```

Cuisine values (predefined, stored as plain text):
`Free Weights` | `Kettlebell` | `Weight Machine` | `Mat Work` | `Bodyweight` | `Bands`

Recipe type values: `straight` | `circuit`

---

## Route Restructuring

| Old route | New route |
|---|---|
| `/plans` | `/recipes` |
| `/plans/new` | `/recipes/new` |
| `/plans/[planId]` | `/recipes/[id]` |
| `/plans/[planId]/exercise/[exerciseId]` | **removed** — replaced by cooking mode |
| `/plans/audit` | `/recipes/rate` |
| `/generate-plan` | `/generate-recipe` |

Old `/plans/*` URLs redirect to `/recipes/*` via Next.js redirects in `next.config.ts`.

The per-exercise logger (`/plans/[planId]/exercise/[exerciseId]`) is **replaced** by the new cooking mode page (`/recipes/[id]/cook`). The cooking mode manages the entire session in one page.

---

## New Files

| File | Purpose |
|---|---|
| `app/recipes/page.tsx` | Recipe library (renamed from plans) |
| `app/recipes/new/page.tsx` | Recipe builder (adds type + cuisine display) |
| `app/recipes/[id]/page.tsx` | Recipe detail — feeling gate + Cook button |
| `app/recipes/[id]/cook/page.tsx` | **New** — full-screen cooking mode |
| `app/recipes/rate/page.tsx` | Rate my cooking (renamed from audit) |
| `app/generate-recipe/page.tsx` | Generate a recipe (renamed) |

---

## Modified Files

| File | Change |
|---|---|
| `app/page.tsx` | Terminology + home screen recipe surfacing |
| `app/block/[id]/page.tsx` | "Exercises" → "Ingredients", cuisine badge on each card |
| `app/block/[id]/exercise/[exerciseId]/page.tsx` | Terminology + cooking puns in motivational messages |
| `components/BottomNav.tsx` | Plans → Recipes, Progress → Kitchen Log |
| `lib/types.ts` | Add `cuisine`, `type`, `rounds` to types; `status` to SetLog |
| `next.config.ts` | Redirects from `/plans/*` to `/recipes/*` |

---

## Feature Details

### Recipe Library (`/recipes`)

Same as current plans page. Changes:
- Heading: "My Recipes"
- Cards: show recipe type badge ("Circuit" pill if `type === 'circuit'`)
- Empty state: *"Your cookbook is empty. Let's write the first recipe."*
- "Rate my cooking" entry below divider (was "Audit my program")
- "Generate a recipe" entry card on home screen (was "Generate a plan")

### Recipe Builder (`/recipes/new`)

Adds to existing plan builder:
- **Recipe type toggle** below the name field: "Straight Sets" | "Circuit" — default Straight Sets
- **Rounds picker** (appears when Circuit selected): number input, default 3
- Ingredients in the picker show cuisine badge (small pill) if cuisine is set
- Save button: "Save recipe"

### Recipe Detail (`/recipes/[id]`)

Same as current plan detail page. Changes:
- Feeling gate stays (same 3-card UI)
- "Cook" button replaces old exercise card links — one big CTA that opens cooking mode
- Show recipe type ("Circuit · 3 rounds" subtitle or "Straight sets")
- Exercise list shown as read-only preview (no individual exercise links)
- Delete: "Delete recipe"

### Cooking Mode (`/recipes/[id]/cook`)

Single page managing the entire session. Replaces the per-exercise logger.

**State managed on this page:**
- Current exercise index
- Current set number (straight sets) or current round + exercise index (circuit)
- Completed sets array with status per set
- Rest timer
- Session record (created on first set logged, same as current)

**Layout:**

```
[progress indicator — top]

[exercise name — large, centered, ~40% of screen]
[weight · reps — small muted text below name]

[big tap zone — remaining center area]
[subtle "Tap when set is done" hint, fades after first use]

[Skip]              [Partial]   ← bottom corners, ghost text
```

**Straight sets flow:**
- Progress: `● ● ○  Bench Press · Set 2 of 3` (filled/empty circles + text)
- Tap → log set as `done`, show rest timer (cooking pun as label), auto-advance after rest
- All sets done → slide to next exercise
- Last exercise all sets done → Recipe complete screen

**Circuit flow:**
- Progress: `Round 2 of 3 · Bench Press (4 of 6)`
- Round number more prominent than exercise position
- Tap → log set as `done`, immediately advance to next exercise in round (no rest between exercises — rest is managed by the circuit pace)
- Last exercise in round → **Round complete screen**: large "Round X — [pun]" + rest timer, auto-dismisses when timer hits zero
- Last round complete → Recipe complete screen

**Partial action:**
- Tapping "Partial" opens a quick-picker overlay (no keyboard):
  - Row of weight adjustments: `–5 lb` `–10 lb` `–15 lb` `as planned`
  - Row of rep adjustments: `–1` `–2` `–3` `as planned`
  - Confirm logs the set as `partial` with adjusted values
  - Pre-populated with last session's weight for this exercise (falls back to exercise default sets/reps)

**Skip action:**
- Single tap → logs set as `skipped`, advances same as done

**Recipe complete screen:**
- Dedicated full-screen (not a modal)
- Summary: total sets, time elapsed, skipped/partial count
- Easter egg: first time = *"First cook. It'll get easier — and harder — from here."*
- 10th time for same recipe = *"This one's in your rotation."*
- CTA: "Back to Kitchen" → `/recipes`

### Kitchen Log (Progress page)

Rename "Progress" → "Kitchen Log" in nav and heading. Individual sessions referred to as "cooks":
- "Your last cook was Tuesday"
- "5 cooks this month"

### Home Screen Updates

- "Generate a recipe" entry card (replaces "Generate a plan")
- Plans nudge card becomes recipe nudge card
- **Most likely recipe surfacing**: if user has recipes, show the recipe cooked most recently at top with a one-tap "Cook →" button (skip if cooked today already)

---

## Cooking Puns & Easter Eggs

### Motivational messages (after logging a set — replaces current MOTIVATION array)
```
"Getting warmer."
"That's one in the pot."
"Keep the heat up."
"Good technique, chef."
"Nice and steady."
"You're cooking now."
"Muscle memory forming."
"No shortcuts in the kitchen."
"Season to taste."
"Every rep counts."
"Don't skip the prep work."
"Low and slow builds strength."
"Finishing strong."
"Almost done cooking."
"That's the recipe."
```

### Round complete labels (circuit mode — rotating)
- "Round X — simmer down."
- "Round X — letting it rest."
- "Round X — marinating."

### Rest timer label (at 2+ minutes)
- Label changes to *"The pot's been on a while."* — auto-reverts when rest ends

### Empty states
- No recipes: *"Your cookbook is empty. Let's write the first recipe."*
- Kitchen Log empty: *"No cooks yet. The kitchen's cold."*

### Special milestones (shown once, stored in localStorage)
- First recipe complete: *"First cook. It'll get easier — and harder — from here."*
- Same recipe completed 10×: *"This one's in your rotation."*
- Personal record: *"New recipe unlocked."* (3-second flash, no modal)

### Loading / error states
- Generate recipe loading: *"Reading the cookbook..."*
- Recipe load error: *"Recipe card got wet. Try again."*
- Rate my cooking — balanced result: *"Balanced macros. Good cook."*

---

## Generate a Recipe Updates

- Rename page `/generate-recipe`, update API route `/api/generate-recipe`
- Loading text: *"Reading the cookbook..."*
- Result: "Generated recipe" instead of "suggested by Claude"
- Save button: "Save recipe" / "Cook now"
- Payload can include cuisine preferences in future (Part B adds cuisine to exercises)

---

## Rate My Cooking Updates

- Route: `/recipes/rate`
- Heading: "Rate my cooking"
- Balanced result message: *"Balanced macros. Good cook."*
- Show skip/partial stats from `sets_log.status` once that data exists

---

## UX Notes (from UX agent review)

- Skip = bottom left, Partial = bottom right — never centered, never equal visual weight to the tap zone
- Partial uses quick-picker (no keyboard)
- Progress circles glanceable from across the room
- Round transitions auto-dismiss — no tap required while catching breath
- "Cookings" as a plural noun is avoided — use "Kitchen Log" and "cook" (singular noun)
- Metaphor is never explained in UI — just used consistently
