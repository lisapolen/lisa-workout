'use client'
import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { Exercise, CardioLog, VO2maxLog, WalkLog } from '@/lib/types'
import { getLocalDate } from '@/lib/utils'
import { useUser } from '@/lib/context/UserContext'

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

const BLOCK_ACCENT: Record<string, string> = {
  'Lower Body': '#C4714A',
  'Upper Body': '#6B9E8F',
  'Cardio':     '#C4A44A',
  'Core':       '#9E8B6B',
  'Recovery':   '#8A7FA8',
}

// Fallback color by block type for calendar
const TYPE_COLOR: Record<string, string> = {
  strength: '#C4714A',
  cardio:   '#C4A44A',
  core:     '#9E8B6B',
  recovery: '#8A7FA8',
}

const TYPE_PRIORITY: Record<string, number> = {
  strength: 4,
  cardio:   3,
  core:     2,
  recovery: 1,
}

type Tab = 'strength' | 'cardio' | 'vo2max'

const VO2_MIN = 23
const VO2_MAX = 40
function vo2Pct(value: number): number {
  return Math.max(0, Math.min(100, ((value - VO2_MIN) / (VO2_MAX - VO2_MIN)) * 100))
}

const CARDIO_COLORS: Record<string, string> = {
  interval_run: C.accent,
  sustained_run: '#8B7355',
  zone2:         C.success,
}
const CARDIO_LABELS: Record<string, string> = {
  interval_run: 'Interval Run',
  sustained_run: 'Sustained Run',
  zone2:         'Zone 2',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────

function CalendarGrid() {
  const { userId } = useUser()
  const [sessionMap, setSessionMap] = useState<Record<string, string>>({}) // date → color

  useEffect(() => {
    if (!userId) return
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 83)
    const cutoffStr = dateStr(cutoff)

    supabase
      .from('sessions')
      .select('date, blocks(name, type)')
      .gte('date', cutoffStr)
      .not('block_id', 'is', null)
      .eq('user_id', userId)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, { color: string; priority: number }> = {}
        data.forEach((s: any) => {
          const bname = s.blocks?.name as string | undefined
          const btype = s.blocks?.type as string | undefined
          if (!s.date || !btype) return
          const color = bname ? (BLOCK_ACCENT[bname] ?? TYPE_COLOR[btype] ?? C.muted) : (TYPE_COLOR[btype] ?? C.muted)
          const priority = TYPE_PRIORITY[btype] ?? 0
          if (!map[s.date] || priority > map[s.date].priority) {
            map[s.date] = { color, priority }
          }
        })
        const colorMap: Record<string, string> = {}
        Object.entries(map).forEach(([d, v]) => { colorMap[d] = v.color })
        setSessionMap(colorMap)
      })
  }, [])

  // Build 12 weeks of dates (Mon–Sun), oldest first
  const weeks: Date[][] = []
  const today = new Date()
  const todayStr = dateStr(today)
  // Find most recent Monday
  const startMonday = new Date(today)
  const dow = startMonday.getDay()
  startMonday.setDate(startMonday.getDate() - (dow === 0 ? 6 : dow - 1))
  // Go back 11 more weeks
  startMonday.setDate(startMonday.getDate() - 77)

  for (let w = 0; w < 12; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(startMonday)
      day.setDate(startMonday.getDate() + w * 7 + d)
      week.push(day)
    }
    weeks.push(week)
  }

  return (
    <div className="rounded-2xl p-4 mb-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
      <p className="text-xs uppercase tracking-wider mb-3" style={{ color: C.muted }}>Last 12 weeks</p>
      <div className="flex flex-col gap-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex items-center gap-1.5">
            <span className="text-xs w-12 flex-shrink-0" style={{ color: C.border }}>
              {week[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <div className="flex gap-1.5 flex-1">
              {week.map((day, di) => {
                const ds = dateStr(day)
                const color = sessionMap[ds]
                const isToday = ds === todayStr
                const isFuture = day > today
                return (
                  <div
                    key={di}
                    className="flex-1 rounded-sm"
                    style={{
                      height: 14,
                      backgroundColor: isFuture ? 'transparent' : (color ?? C.border),
                      opacity: isFuture ? 0 : 1,
                      outline: isToday ? `1px solid ${C.muted}` : 'none',
                    }}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 flex-wrap">
        {Object.entries(BLOCK_ACCENT).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs" style={{ color: C.muted }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Strength tab ─────────────────────────────────────────────────────────────

function StrengthTab() {
  const { userId } = useUser()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [history, setHistory] = useState<{ date: string; weight: number }[]>([])
  const [overloadCount, setOverloadCount] = useState<number | null>(null)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('blocks')
      .select('id')
      .in('type', ['strength', 'core'])
      .then(({ data: blockRows }) => {
        if (!blockRows || blockRows.length === 0) return
        const ids = blockRows.map((b: any) => b.id)
        supabase
          .from('exercises')
          .select('*')
          .in('block_id', ids)
          .order('block_id')
          .order('sort_order')
          .then(async ({ data }) => {
            if (data && data.length > 0) {
              setExercises(data)
              setSelected(data[0].id)

              // Overload milestone count: exercises heavier in last 4 weeks vs 9-12 weeks ago
              const now = new Date()
              const recentCutoff = dateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 28))
              const oldStart = dateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 84))
              const oldEnd = dateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 63))

              const exIds = data.map((e: Exercise) => e.id)
              const [{ data: recentSets }, { data: oldSets }] = await Promise.all([
                supabase.from('sets_log').select('exercise_id, weight').in('exercise_id', exIds)
                  .gte('completed_at', recentCutoff).not('weight', 'is', null),
                supabase.from('sets_log').select('exercise_id, weight').in('exercise_id', exIds)
                  .gte('completed_at', oldStart).lte('completed_at', oldEnd).not('weight', 'is', null),
              ])

              const recentMax: Record<number, number> = {}
              const oldMax: Record<number, number> = {}
              recentSets?.forEach((s: any) => {
                recentMax[s.exercise_id] = Math.max(recentMax[s.exercise_id] ?? 0, Number(s.weight))
              })
              oldSets?.forEach((s: any) => {
                oldMax[s.exercise_id] = Math.max(oldMax[s.exercise_id] ?? 0, Number(s.weight))
              })

              const count = exIds.filter((id: number) =>
                recentMax[id] !== undefined && oldMax[id] !== undefined && recentMax[id] > oldMax[id]
              ).length
              setOverloadCount(count)
            }
          })
      })
  }, [])

  useEffect(() => {
    if (!selected || !userId) return
    supabase
      .from('sets_log')
      .select('weight, completed_at, sessions!inner(date)')
      .eq('exercise_id', selected)
      .eq('sessions.user_id', userId)
      .not('weight', 'is', null)
      .order('completed_at')
      .then(({ data }) => {
        if (!data) return
        const byDate: Record<string, number> = {}
        data.forEach((row: any) => {
          const d = row.sessions?.date ?? row.completed_at?.split('T')[0]
          if (d && row.weight > (byDate[d] ?? 0)) byDate[d] = row.weight
        })
        setHistory(Object.entries(byDate).map(([date, weight]) => ({ date, weight })).sort((a, b) => a.date.localeCompare(b.date)))
      })
  }, [selected])

  const selectedEx = exercises.find(e => e.id === selected)

  return (
    <div>
      {overloadCount !== null && overloadCount > 0 && (
        <div className="rounded-xl px-4 py-3 mb-4" style={{ backgroundColor: 'rgba(107,143,107,0.12)', border: `1px solid ${C.success}` }}>
          <p className="text-sm font-semibold" style={{ color: C.success }}>
            {overloadCount} {overloadCount === 1 ? 'exercise is' : 'exercises are'} heavier than 12 weeks ago
          </p>
        </div>
      )}

      <div className="mb-4">
        <label className="text-sm mb-2 block" style={{ color: C.muted }}>Exercise</label>
        <select
          value={selected ?? ''}
          onChange={e => setSelected(Number(e.target.value))}
          className="w-full rounded-xl p-3 text-base outline-none"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.text }}
        >
          {exercises.map(ex => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>
      </div>

      {selectedEx?.name === 'Seated Leg Press' && (
        <div className="rounded-xl px-4 py-2 mb-4" style={{ backgroundColor: 'rgba(196,113,74,0.1)', border: `1px solid ${C.accent}` }}>
          <p className="text-xs font-semibold" style={{ color: C.accent }}>Bone density proxy &mdash; primary progressive overload indicator</p>
        </div>
      )}

      {history.length > 0 ? (
        <div className="rounded-2xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-sm mb-3" style={{ color: C.muted }}>
            Weight over last {history.length} sessions &mdash; {selectedEx?.name}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 11 }} />
              <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8 }}
                labelStyle={{ color: C.muted }}
                itemStyle={{ color: C.text }}
                labelFormatter={(label) => typeof label === 'string' ? fmt(label) : String(label)}
                formatter={(v) => [`${v} lbs`, 'Weight']}
              />
              <Line type="monotone" dataKey="weight" stroke={C.accent} strokeWidth={2} dot={{ fill: C.accent, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.muted }}>
          No data yet for this exercise
        </div>
      )}
    </div>
  )
}

// ─── Cardio tab ───────────────────────────────────────────────────────────────

function CardioTab() {
  const { userId } = useUser()
  const [logs, setLogs] = useState<CardioLog[]>([])
  const [walks, setWalks] = useState<WalkLog[]>([])

  useEffect(() => {
    if (!userId) return
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 28)
    const cutoffStr = dateStr(cutoff)
    Promise.all([
      supabase.from('cardio_log').select('*').gte('date', cutoffStr).eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('walks_log').select('*').gte('date', cutoffStr).eq('user_id', userId).order('date', { ascending: false }),
    ]).then(([{ data: cardioData }, { data: walkData }]) => {
      if (cardioData) setLogs(cardioData)
      if (walkData) setWalks(walkData)
    })
  }, [])

  return (
    <div>
      <div className="flex gap-4 mb-4 text-xs">
        {Object.entries(CARDIO_COLORS).map(([key, color]) => (
          <div key={key} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
            <span style={{ color: C.muted }}>{CARDIO_LABELS[key]}</span>
          </div>
        ))}
      </div>

      {logs.length === 0 ? (
        <div className="rounded-2xl p-8 text-center mb-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.muted }}>
          No cardio logged in the last 4 weeks
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-5">
          {logs.map(log => (
            <div
              key={log.id}
              className="rounded-2xl p-4"
              style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderLeftColor: CARDIO_COLORS[log.type], borderLeftWidth: 4 }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold" style={{ color: CARDIO_COLORS[log.type] }}>
                    {CARDIO_LABELS[log.type]}
                    {log.subtype && <span className="text-sm font-normal ml-1" style={{ color: C.muted }}>({log.subtype})</span>}
                  </p>
                  <p className="text-sm" style={{ color: C.muted }}>{fmt(log.date)}</p>
                </div>
                <div className="text-right">
                  {log.duration_minutes && <p className="font-semibold" style={{ color: C.text }}>{log.duration_minutes} min</p>}
                  {log.avg_hr && <p className="text-sm" style={{ color: C.muted }}>{log.avg_hr} bpm avg</p>}
                </div>
              </div>
              {log.notes && <p className="text-sm mt-2" style={{ color: C.muted }}>{log.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {walks.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: C.muted }}>Walks — last 4 weeks</p>
          <div className="flex flex-col gap-2">
            {walks.map(walk => (
              <div
                key={walk.id}
                className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: C.card, borderLeft: `3px solid #8A7FA8` }}
              >
                <p className="text-sm" style={{ color: C.text }}>{fmt(walk.date)}</p>
                <p className="text-xs font-semibold" style={{ color: '#8A7FA8' }}>Walked</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── VO2max tab ───────────────────────────────────────────────────────────────

function VO2maxTab() {
  const { userId } = useUser()
  const [logs, setLogs] = useState<VO2maxLog[]>([])
  const [newValue, setNewValue] = useState('')
  const [source, setSource] = useState<'manual' | 'apple_watch'>('manual')
  const [saving, setSaving] = useState(false)
  const [zone2Count, setZone2Count] = useState<number | null>(null)

  function loadLogs() {
    if (!userId) return
    supabase
      .from('vo2max_log')
      .select('*')
      .eq('user_id', userId)
      .order('date')
      .then(({ data }) => { if (data) setLogs(data) })
  }

  useEffect(() => {
    if (!userId) return
    loadLogs()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 28)
    supabase
      .from('cardio_log')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'zone2')
      .eq('user_id', userId)
      .gte('date', dateStr(cutoff))
      .then(({ count }) => { if (count !== null) setZone2Count(count) })
  }, [userId])

  async function addEntry() {
    if (!newValue || saving || !userId) return
    setSaving(true)
    await supabase.from('vo2max_log').insert({
      date: getLocalDate(),
      value: Number(newValue),
      source,
      user_id: userId,
    })
    setNewValue('')
    loadLogs()
    setSaving(false)
  }

  const latest = logs[logs.length - 1]

  return (
    <div>
      {latest && (
        <div className="rounded-2xl p-5 mb-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-5xl font-bold" style={{ color: C.text }}>{latest.value}</span>
            <span style={{ color: C.muted }}>/ 34 target</span>
          </div>
          <div className="w-full rounded-full h-3 mb-1" style={{ backgroundColor: C.border }}>
            <div
              className="h-3 rounded-full"
              style={{ width: `${vo2Pct(Number(latest.value)).toFixed(1)}%`, backgroundColor: C.accent }}
            />
          </div>
          <div className="flex justify-between mt-1 mb-3">
            <span className="text-xs" style={{ color: C.muted }}>23 (low)</span>
            <span className="text-xs font-semibold" style={{ color: C.success }}>Target: 34</span>
            <span className="text-xs" style={{ color: C.muted }}>40 (athlete)</span>
          </div>
          <p className="text-xs" style={{ color: C.muted }}>
            {(34 - Number(latest.value)).toFixed(1)} points to goal
            &mdash; Note: Apple Watch may underestimate due to asthma affecting HR at pace
          </p>
        </div>
      )}

      {zone2Count !== null && (
        <div className="rounded-xl px-4 py-3 mb-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-sm" style={{ color: C.text }}>
            Zone 2 sessions (last 4 weeks):{' '}
            <span className="font-bold" style={{ color: C.success }}>{zone2Count}</span>
          </p>
          <p className="text-xs mt-1" style={{ color: C.muted }}>
            Consistent zone 2 is the primary driver of VO&#x2082;max improvement.
          </p>
        </div>
      )}

      {logs.length > 1 && (
        <div className="rounded-2xl p-4 mb-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-sm mb-3" style={{ color: C.muted }}>VO&#x2082;max over time</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={logs} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 11 }} />
              <YAxis domain={[20, 38]} tick={{ fill: C.muted, fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8 }}
                labelStyle={{ color: C.muted }}
                itemStyle={{ color: C.text }}
                labelFormatter={(label) => typeof label === 'string' ? fmt(label) : String(label)}
                formatter={(v) => [v, 'VO\u2082max']}
              />
              <ReferenceLine y={34} stroke={C.accent} strokeDasharray="4 4" label={{ value: 'Goal 34', fill: C.accent, fontSize: 11 }} />
              <Line type="monotone" dataKey="value" stroke={C.success} strokeWidth={2} dot={{ fill: C.success, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-2xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
        <p className="font-semibold mb-3" style={{ color: C.text }}>Log new measurement</p>
        <div className="flex gap-3 mb-3">
          {(['manual', 'apple_watch'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors"
              style={source === s
                ? { borderColor: C.accent, color: C.accent }
                : { borderColor: C.border, color: C.muted }}
            >
              {s === 'manual' ? 'Manual' : 'Apple Watch'}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <input
            type="number"
            inputMode="decimal"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            placeholder="29"
            step="0.1"
            className="flex-1 rounded-xl text-2xl font-bold text-center py-4 border-2 outline-none"
            style={{ backgroundColor: C.card, borderColor: C.border, color: C.text }}
          />
          <button
            onClick={addEntry}
            disabled={saving || !newValue}
            className="font-bold rounded-xl px-6 text-lg disabled:opacity-40 active:opacity-80"
            style={{ backgroundColor: C.accent, color: C.text }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const [tab, setTab] = useState<Tab>('strength')

  return (
    <div className="px-4 pt-8 pb-28 max-w-lg mx-auto">
      <h1 className="text-3xl font-bold mb-5" style={{ color: C.text }}>Progress</h1>

      <CalendarGrid />

      <div className="flex rounded-2xl p-1 mb-6" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
        {(['strength', 'cardio', 'vo2max'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={tab === t
              ? { backgroundColor: C.accent, color: C.text }
              : { color: C.muted }}
          >
            {t === 'vo2max' ? 'VO\u2082max' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'strength' && <StrengthTab />}
      {tab === 'cardio' && <CardioTab />}
      {tab === 'vo2max' && <VO2maxTab />}
    </div>
  )
}
