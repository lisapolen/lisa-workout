'use client'
import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { Exercise, CardioLog, VO2maxLog } from '@/lib/types'

type Tab = 'strength' | 'cardio' | 'vo2max'

const VO2_MIN = 23
const VO2_MAX = 40
function vo2Pct(value: number): number {
  return Math.max(0, Math.min(100, ((value - VO2_MIN) / (VO2_MAX - VO2_MIN)) * 100))
}

const CARDIO_COLORS: Record<string, string> = {
  interval_run: '#f59e0b',
  sustained_run: '#3b82f6',
  zone2:         '#10b981',
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
          // Default to leg press
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
        // Max weight per session date
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
        <label className="text-zinc-400 text-sm mb-2 block">Exercise</label>
        <select
          value={selected ?? ''}
          onChange={e => setSelected(Number(e.target.value))}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-base outline-none"
        >
          {exercises.map(ex => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>
      </div>

      {selectedEx?.name === 'Seated Leg Press' && (
        <div className="bg-blue-950/40 border border-blue-800 rounded-xl px-4 py-2 mb-4">
          <p className="text-blue-300 text-xs font-semibold">Bone density proxy &mdash; primary progressive overload indicator</p>
        </div>
      )}

      {history.length > 0 ? (
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
          <p className="text-zinc-400 text-sm mb-3">
            Weight over last {history.length} sessions &mdash; {selectedEx?.name}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis dataKey="date" tickFormatter={fmt} tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                labelFormatter={(label) => typeof label === 'string' ? fmt(label) : String(label)}
                formatter={(v) => [`${v} lbs`, 'Weight']}
              />
              <Line type="monotone" dataKey="weight" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center text-zinc-500">
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
            <span className="text-zinc-400">{CARDIO_LABELS[key]}</span>
          </div>
        ))}
      </div>

      {logs.length === 0 ? (
        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center text-zinc-500">
          No cardio logged in the last 4 weeks
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map(log => (
            <div
              key={log.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4"
              style={{ borderLeftColor: CARDIO_COLORS[log.type], borderLeftWidth: 4 }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold" style={{ color: CARDIO_COLORS[log.type] }}>
                    {CARDIO_LABELS[log.type]}
                    {log.subtype && <span className="text-zinc-400 text-sm font-normal ml-1">({log.subtype})</span>}
                  </p>
                  <p className="text-zinc-500 text-sm">{fmt(log.date)}</p>
                </div>
                <div className="text-right">
                  {log.duration_minutes && <p className="text-white font-semibold">{log.duration_minutes} min</p>}
                  {log.avg_hr && <p className="text-zinc-400 text-sm">{log.avg_hr} bpm avg</p>}
                </div>
              </div>
              {log.notes && <p className="text-zinc-500 text-sm mt-2">{log.notes}</p>}
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
      {/* Current status */}
      {latest && (
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 mb-5">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-5xl font-bold">{latest.value}</span>
            <span className="text-zinc-400">/ 34 target</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-3 mb-1">
            <div
              className="bg-amber-400 h-3 rounded-full"
              style={{ width: `${vo2Pct(Number(latest.value)).toFixed(1)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 mb-2">
            <span className="text-xs text-zinc-500">23 (low)</span>
            <span className="text-xs text-amber-400">Target: 34</span>
            <span className="text-xs text-zinc-500">40 (athlete)</span>
          </div>
          <p className="text-zinc-500 text-xs">
            {(34 - Number(latest.value)).toFixed(1)} points to goal
            &mdash; Note: Apple Watch may underestimate due to asthma affecting HR at pace
          </p>
        </div>
      )}

      {/* Chart */}
      {logs.length > 1 && (
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-5">
          <p className="text-zinc-400 text-sm mb-3">VO&#x2082;max over time</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={logs} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis dataKey="date" tickFormatter={fmt} tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis domain={[20, 38]} tick={{ fill: '#71717a', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                labelFormatter={(label) => typeof label === 'string' ? fmt(label) : String(label)}
                formatter={(v) => [v, 'VO\u2082max']}
              />
              <ReferenceLine y={34} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Goal 34', fill: '#f59e0b', fontSize: 11 }} />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Log new value */}
      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
        <p className="font-semibold mb-3">Log new measurement</p>
        <div className="flex gap-3 mb-3">
          {(['manual', 'apple_watch'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 ${
                source === s ? 'border-amber-400 text-amber-400' : 'border-zinc-700 text-zinc-400'
              }`}
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
            className="flex-1 bg-zinc-800 rounded-xl text-2xl font-bold text-center py-4 border-2 border-zinc-700 focus:border-amber-400 outline-none"
          />
          <button
            onClick={addEntry}
            disabled={saving || !newValue}
            className="bg-amber-400 text-black font-bold rounded-xl px-6 text-lg disabled:opacity-40 active:opacity-80"
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
      <h1 className="text-3xl font-bold mb-6">Progress</h1>

      {/* Tabs */}
      <div className="flex bg-zinc-900 rounded-2xl p-1 mb-6 border border-zinc-800">
        {(['strength', 'cardio', 'vo2max'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              tab === t ? 'bg-amber-400 text-black' : 'text-zinc-400'
            }`}
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
