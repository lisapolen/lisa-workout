'use client'

interface Props {
  onClose: () => void
}

const C = {
  card:   '#252018',
  item:   '#2E2820',
  text:   '#F5F0E8',
  muted:  '#A89880',
  accent: '#C4714A',
  danger: '#C4514A',
}

export default function NeckSafetyModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: C.card }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold" style={{ color: C.danger }}>Neck Safety Reference</h2>
          <button
            onClick={onClose}
            className="text-3xl leading-none w-10 h-10 flex items-center justify-center"
            style={{ color: C.muted }}
          >
            &times;
          </button>
        </div>

        <div className="mb-5">
          <p className="font-bold uppercase text-xs tracking-widest mb-2" style={{ color: C.danger }}>NEVER do these</p>
          <ul className="space-y-2">
            {[
              'Overhead press',
              'Kettlebells',
              'Upright rows',
              'Behind-neck pulldown',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold" style={{ backgroundColor: 'rgba(196,81,74,0.1)', border: `1px solid ${C.danger}`, color: '#E0A09A' }}>
                <span className="text-xl" style={{ color: C.danger }}>&times;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-5">
          <p className="font-bold uppercase text-xs tracking-widest mb-2" style={{ color: C.accent }}>Always remember</p>
          <ul className="space-y-2" style={{ color: C.muted }}>
            <li className="rounded-xl px-4 py-3" style={{ backgroundColor: C.item }}>Lat pulldown: to collarbone only, never behind neck</li>
            <li className="rounded-xl px-4 py-3" style={{ backgroundColor: C.item }}>Stop immediately if your neck engages</li>
            <li className="rounded-xl px-4 py-3" style={{ backgroundColor: C.item }}>Face pulls: optional, light weight only</li>
          </ul>
        </div>

        <div>
          <p className="font-bold uppercase text-xs tracking-widest mb-2" style={{ color: C.muted }}>Daily management</p>
          <p className="rounded-xl px-4 py-3" style={{ backgroundColor: C.item, color: C.muted }}>Chin tucks</p>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full font-bold text-lg rounded-xl py-4"
          style={{ backgroundColor: C.item, color: C.text }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}
