'use client'

interface Props {
  onClose: () => void
}

export default function NeckSafetyModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: '#1A1A1A' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold" style={{ color: '#EF4444' }}>Neck Safety Reference</h2>
          <button
            onClick={onClose}
            className="text-3xl leading-none w-10 h-10 flex items-center justify-center"
            style={{ color: '#9CA3AF' }}
          >
            x
          </button>
        </div>

        <div className="mb-5">
          <p className="font-bold uppercase text-xs tracking-widest mb-2" style={{ color: '#EF4444' }}>NEVER do these</p>
          <ul className="space-y-2">
            {[
              'Overhead press',
              'Kettlebells',
              'Upright rows',
              'Behind-neck pulldown',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', color: '#FCA5A5' }}>
                <span className="text-xl" style={{ color: '#EF4444' }}>x</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-5">
          <p className="font-bold uppercase text-xs tracking-widest mb-2" style={{ color: '#3B82F6' }}>Always remember</p>
          <ul className="space-y-2" style={{ color: '#9CA3AF' }}>
            <li className="rounded-xl px-4 py-3" style={{ backgroundColor: '#262626' }}>Lat pulldown: to collarbone only, never behind neck</li>
            <li className="rounded-xl px-4 py-3" style={{ backgroundColor: '#262626' }}>Stop immediately if your neck engages</li>
            <li className="rounded-xl px-4 py-3" style={{ backgroundColor: '#262626' }}>Face pulls: optional, light weight only</li>
          </ul>
        </div>

        <div>
          <p className="font-bold uppercase text-xs tracking-widest mb-2" style={{ color: '#6B7280' }}>Daily management</p>
          <p className="rounded-xl px-4 py-3" style={{ backgroundColor: '#262626', color: '#9CA3AF' }}>Chin tucks</p>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full text-white font-bold text-lg rounded-xl py-4"
          style={{ backgroundColor: '#262626' }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}
