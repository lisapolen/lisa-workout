'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Exercise, SetLog } from '@/lib/types'
import { getLocalDate, parseTargetReps, getEasterEggs, markEasterEgg } from '@/lib/utils'

const BLOCK_ACCENT: Record<string, string> = {
  'Lower Body': '#C4714A',
  'Upper Body': '#6B9E8F',
  'Cardio':     '#C4A44A',
  'Core':       '#9E8B6B',
  'Recovery':   '#8A7FA8',
}

const REST_TARGET: Record<string, number> = {
  'Lower Body': 120,
  'Upper Body': 90,
  'Core':       60,
}

type SessionConfig =
  | { type: 'block'; blockId: number }
  | { type: 'plan'; planId: number }

interface UseSetLoggerConfig {
  session: SessionConfig
  exercise: Exercise | null
  blockName: string
  lastWeight: number | null | undefined
}

export function useSetLogger({ session, exercise, blockName, lastWeight }: UseSetLoggerConfig) {
  const [completedSets, setCompletedSets] = useState<SetLog[]>([])
  const [currentSet, setCurrentSet] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showOverloadPrompt, setShowOverloadPrompt] = useState(false)
  const [overloadShimmered, setOverloadShimmered] = useState(false)
  const [restStartTime, setRestStartTime] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const prevRestReady = useRef(false)
  const [undoableSetId, setUndoableSetId] = useState<number | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [animatingSetId, setAnimatingSetId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; accent: string } | null>(null)

  // Rest timer tick
  useEffect(() => {
    if (!restStartTime) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - restStartTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [restStartTime])

  // Vibrate when rest period completes
  useEffect(() => {
    const restTarget = REST_TARGET[blockName] ?? 90
    const ready = elapsed >= restTarget && restStartTime !== null
    if (ready && !prevRestReady.current) navigator.vibrate?.(100)
    prevRestReady.current = ready
  }, [elapsed, blockName, restStartTime])

  function sessionKey(today: string): string {
    return session.type === 'block'
      ? `session_${session.blockId}_${today}`
      : `plan_session_${session.planId}_${today}`
  }

  function feelingKey(today: string): string {
    return session.type === 'block'
      ? `feeling_${session.blockId}_${today}`
      : `feeling_plan_${session.planId}_${today}`
  }

  async function getOrCreateSession(): Promise<number> {
    const today = getLocalDate()
    const key = sessionKey(today)
    const stored = localStorage.getItem(key)
    if (stored) return Number(stored)
    const feeling = localStorage.getItem(feelingKey(today)) ?? null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = session.type === 'block'
      ? { date: today, block_id: session.blockId, feeling }
      : { date: today, plan_id: session.planId, block_id: null, feeling }
    const { data, error } = await supabase.from('sessions').insert(payload).select('id').single()
    if (error || !data) throw new Error('Could not create session')
    localStorage.setItem(key, String(data.id))
    return data.id
  }

  async function runOverloadCheck(ex: Exercise, loggedWeight: number, currentSessionId: string | null) {
    const targetReps = parseTargetReps(ex.reps)
    if (targetReps === 0) return
    const dismissKey = `overload_dismissed_${ex.id}_${loggedWeight}`
    if (localStorage.getItem(dismissKey)) return
    const { data: allSets } = await supabase
      .from('sets_log').select('session_id, weight, reps').eq('exercise_id', ex.id)
      .not('weight', 'is', null).order('completed_at', { ascending: false }).limit(100)
    if (!allSets) return
    const prevSessions: Record<number, { weight: number; reps: number | null }[]> = {}
    for (const s of allSets) {
      if (currentSessionId && String(s.session_id) === currentSessionId) continue
      if (!prevSessions[s.session_id]) prevSessions[s.session_id] = []
      prevSessions[s.session_id].push({ weight: Number(s.weight), reps: s.reps })
    }
    const prevIds = Object.keys(prevSessions)
    if (prevIds.length < 2) return
    const qualified = prevIds.slice(0, 2).every(sid =>
      prevSessions[Number(sid)].every(s => s.weight === loggedWeight && (s.reps ?? 0) >= targetReps)
    )
    if (qualified) {
      setShowOverloadPrompt(true)
      navigator.vibrate?.([50, 30, 50, 30, 100])
      const eggs = JSON.parse(localStorage.getItem('easter_eggs') || '{}')
      if (!eggs.first_overload) {
        eggs.first_overload = true
        localStorage.setItem('easter_eggs', JSON.stringify(eggs))
        setToast({ message: "Getting stronger. It's working.", accent: '#6B8F6B' })
      }
    }
  }

  function maybeFireEasterEgg(loggedWeight: number | null) {
    const eggs = getEasterEggs()
    const hour = new Date().getHours()
    const today = getLocalDate()
    const blockAccent = BLOCK_ACCENT[blockName] ?? '#C4714A'

    if (!eggs.first_set && lastWeight === null && completedSets.length === 0) {
      markEasterEgg('first_set')
      setToast({ message: 'And so it begins.', accent: blockAccent })
      return
    }
    if (!eggs[`early_bird_${today}`] && hour < 6) {
      markEasterEgg(`early_bird_${today}`)
      setToast({ message: 'Up before the sun.', accent: blockAccent })
      return
    }
    if (!eggs[`night_owl_${today}`] && hour >= 21) {
      markEasterEgg(`night_owl_${today}`)
      setToast({ message: 'Night owl gains.', accent: blockAccent })
      return
    }
    if (loggedWeight === 135 && !eggs.plates_135) {
      markEasterEgg('plates_135')
      setToast({ message: 'A plate on each side.', accent: blockAccent })
      return
    }
    if (loggedWeight === 225 && !eggs.plates_225) {
      markEasterEgg('plates_225')
      setToast({ message: 'Two plates. Respect.', accent: blockAccent })
      return
    }
    if (loggedWeight === 315 && !eggs.plates_315) {
      markEasterEgg('plates_315')
      setToast({ message: 'Three plates. Seriously.', accent: blockAccent })
      return
    }
    if (loggedWeight === 100 && !eggs.round_100) {
      markEasterEgg('round_100')
      setToast({ message: 'Nice round number.', accent: blockAccent })
      return
    }
  }

  async function logSet(weight: string, reps: string) {
    if (!exercise || saving) return
    const isBodyweight = exercise.starting_weight === 'Bodyweight'
    if (!isBodyweight && !weight) return
    if (!reps) return
    setSaving(true)
    setError('')
    try {
      const sessionId = await getOrCreateSession()
      const loggedWeight = isBodyweight ? null : Number(weight)
      const { data, error: insertError } = await supabase
        .from('sets_log')
        .insert({ session_id: sessionId, exercise_id: exercise.id, set_number: currentSet, weight: loggedWeight, reps: Number(reps) })
        .select().single()
      if (insertError) throw insertError

      setCompletedSets(prev => [...prev, data])
      setCurrentSet(prev => prev + 1)

      navigator.vibrate?.(50)
      setAnimatingSetId(data.id)
      setTimeout(() => setAnimatingSetId(null), 400)

      setUndoableSetId(data.id)
      if (undoTimer.current) clearTimeout(undoTimer.current)
      undoTimer.current = setTimeout(() => setUndoableSetId(null), 8000)

      setRestStartTime(Date.now())
      setElapsed(0)

      maybeFireEasterEgg(loggedWeight)

      if (loggedWeight != null) {
        const currentSessionId = localStorage.getItem(sessionKey(getLocalDate()))
        await runOverloadCheck(exercise, loggedWeight, currentSessionId)
      }
    } catch {
      setError('Failed to save — check connection')
    } finally {
      setSaving(false)
    }
  }

  async function undoSet() {
    if (!undoableSetId) return
    await supabase.from('sets_log').delete().eq('id', undoableSetId)
    setCompletedSets(prev => prev.filter(s => s.id !== undoableSetId))
    setCurrentSet(prev => prev - 1)
    setUndoableSetId(null)
    setRestStartTime(null)
    if (undoTimer.current) clearTimeout(undoTimer.current)
  }

  function dismissOverload(exerciseId: number, currentWeight: string) {
    localStorage.setItem(`overload_dismissed_${exerciseId}_${Number(currentWeight)}`, '1')
    setShowOverloadPrompt(false)
  }

  return {
    completedSets, setCompletedSets,
    currentSet, setCurrentSet,
    saving, error,
    showOverloadPrompt, overloadShimmered, setOverloadShimmered,
    restStartTime, elapsed,
    undoableSetId, animatingSetId,
    toast, setToast,
    logSet, undoSet, dismissOverload,
    runOverloadCheck,
    sessionKey,
  }
}
