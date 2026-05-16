'use client'

const C = {
  card:   '#2D2520',
  border: '#3A3228',
  text:   '#F5F0E8',
  muted:  '#C4B098',
}

export interface StepperProps {
  label: string
  value: string
  onChange: (v: string) => void
  step: number
  min?: number
  unit?: string
}

export function Stepper({ label, value, onChange, step, min = 0, unit }: StepperProps) {
  function adjust(delta: number) {
    const current = parseFloat(value) || 0
    const next = Math.max(min, Math.round((current + delta) * 100) / 100)
    onChange(String(next))
  }

  return (
    <div>
      <label className="text-sm mb-2 block" style={{ color: C.muted }}>
        {label}{unit && <span className="ml-1" style={{ color: C.border }}>({unit})</span>}
      </label>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onPointerDown={() => adjust(-step)}
          className="w-16 rounded-2xl text-3xl font-bold flex items-center justify-center select-none active:opacity-70"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.text }}
        >
          -
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 rounded-xl text-4xl font-bold text-center py-4 outline-none"
          style={{ backgroundColor: C.card, border: `2px solid ${C.border}`, color: C.text }}
        />
        <button
          type="button"
          onPointerDown={() => adjust(step)}
          className="w-16 rounded-2xl text-3xl font-bold flex items-center justify-center select-none active:opacity-70"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.text }}
        >
          +
        </button>
      </div>
    </div>
  )
}
