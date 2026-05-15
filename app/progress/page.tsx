'use client'
import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { Exercise, CardioLog, VO2maxLog } from '@/lib/types'

const C = {
  bg:      '#1C1814',
  card:    '#2D2520',
  border:  '#3A3228',
  text:    '#F5F0E8',
  muted:   '#A89880',
  accent:  '#C4714A',
  success: '#6B8F6B',
  danger:  '#C4514A',
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

// ─── Strength tab ────────────────────────────────────────────────────────────

function StrengthTab() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [history, setHistory] = useState<{ date: string; weight: number }[]>([])

  useEffect(() => {
    supabase
      .from('exercises')
      .select('*')
      .in('block_id', [1, 2, 4])
      .order('block_id')
      .order('sort_order')
      .then(({ data }) => {
        if (data) {
          setExercises(data)
          const lp = data.find((e: Exercise) => e.name === 'Seated Leg Press')
          if (lp) setSelected(lp.id)
        }
      })
  }, [])

  useEffect(() => {
    if (!selected) return
    supabase
      .from('sets_log')
      .select('weight, completed_at, sessions(date)')
      .eq('exercise_id', selected)
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

// ─── Cardio tab ──────────────────────────────────────────────────────────────

function CardioTab() {
  const [logs, setLogs] = useState<CardioLog[]>([])

  useEffect(() => {
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
    supabase
      .from('cardio_log')
      .select('*')
      .gte('date', fourWeeksAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .then(({ data }) => { if (data) setLogs(data) })
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
        <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.muted }}>
          No cardio logged in the last 4 weeks
        </div>
      ) : (
        <div className="flex flex-col gap-3">
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
    </div>
  )
}

// ─── VO2max tab ──────────────────────────────────────────────────────────────

function VO2maxTab() {
  const [logs, setLogs] = useState<VO2maxLog[]>([])
  const [newValue, setNewValue] = useState('')
  const [source, setSource] = useState<'manual' | 'apple_watch'>('manual')
  const [saving, setSaving] = useState(false)

  function loadLogs() {
    supabase
      .from('vo2max_log')
      .select('*')
      .order('date')
      .then(({ data }) => { if (data) setLogs(data) })
  }

  useEffect(() => { loadLogs() }, [])

  async function addEntry() {
    if (!newValue || saving) return
    setSaving(true)
    await supabase.from('vo2max_log').insert({
      date: new Date().toISOString().split('T')[0],
      value: Number(newValue),
      source,
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
          <div className="flex justify-between mt-1 mb-2">
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const [tab, setTab] = useState<Tab>('strength')

  return (
    <div className="px-4 pt-8 max-w-lg mx-auto">
      <h1 className="text-3xl font-bold mb-6" style={{ color: '#F5F0E8' }}>Progress</h1>

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
