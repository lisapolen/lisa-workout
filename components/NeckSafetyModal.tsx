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
        className="w-full bg-zinc-900 rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-red-400">Neck Safety Reference</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 text-3xl leading-none w-10 h-10 flex items-center justify-center"
          >
            x
          </button>
        </div>

        <div className="mb-5">
          <p className="text-red-400 font-bold uppercase text-xs tracking-widest mb-2">NEVER do these</p>
          <ul className="space-y-2">
            {[
              'Overhead press',
              'Kettlebells',
              'Upright rows',
              'Behind-neck pulldown',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 bg-red-950/50 border border-red-800 rounded-xl px-4 py-3 text-red-300 font-semibold">
                <span className="text-red-500 text-xl">x</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-5">
          <p className="text-amber-400 font-bold uppercase text-xs tracking-widest mb-2">Always remember</p>
          <ul className="space-y-2 text-zinc-300">
            <li className="bg-zinc-800 rounded-xl px-4 py-3">Lat pulldown: to collarbone only, never behind neck</li>
            <li className="bg-zinc-800 rounded-xl px-4 py-3">Stop immediately if your neck engages</li>
            <li className="bg-zinc-800 rounded-xl px-4 py-3">Face pulls: optional, light weight only</li>
          </ul>
        </div>

        <div>
          <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest mb-2">Daily management</p>
          <p className="bg-zinc-800 rounded-xl px-4 py-3 text-zinc-300">Chin tucks</p>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-zinc-800 text-white font-bold text-lg rounded-2xl py-4"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
