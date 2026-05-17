'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Exercise } from '@/lib/types'
import NeckSafetyModal from '@/components/NeckSafetyModal'

const C = {
  card:    '#2D2520',
  border:  '#3A3228',
  text:    '#F5F0E8',
  muted:   '#C4B098',
  success: '#6B8F6B',
  danger:  '#C4514A',
}

export interface StrengthViewProps {
  exercises: Exercise[]
  lastWeights: Record<number, number | null>
  completedCounts: Record<number, number>
  linkBuilder: (exerciseId: number) => string
  isUpperBody: boolean
  accent: string
}

export function StrengthView({
  exercises,
  lastWeights,
  completedCounts,
  linkBuilder,
  isUpperBody,
  accent,
}: StrengthViewProps) {
  const [showNeck, setShowNeck] = useState(false)

  return (
    <div>
      {isUpperBody && (
        <button
          onClick={() => setShowNeck(true)}
          className="mb-4 flex items-center gap-2 text-sm font-semibold py-2"
          style={{ color: C.danger }}
        >
          <span className="w-11 h-11 rounded-full border-2 flex items-center justify-center text-base font-bold flex-shrink-0" style={{ borderColor: C.danger }}>!</span>
          Neck Safety Reference
        </button>
      )}

      <div className="flex flex-col gap-3">
        {exercises.map(ex => {
          const lastW = lastWeights[ex.id]
          const isBodyweight = ex.starting_weight === 'Bodyweight'
          const doneCount = completedCounts[ex.id] ?? 0
          const totalSets = ex.sets ?? 0
          const isComplete = doneCount >= totalSets && totalSets > 0
          const isPartial = doneCount > 0 && !isComplete
          return (
            <Link
              key={ex.id}
              href={linkBuilder(ex.id)}
              className="rounded-2xl p-5 active:opacity-80"
              style={{
                backgroundColor: C.card,
                border: `1px solid ${C.border}`,
                borderLeft: `3px ${isPartial ? 'dashed' : 'solid'} ${accent}`,
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-lg font-bold" style={{ color: C.text }}>{ex.name}</p>
                    {ex.neck_flag && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(196,81,74,0.15)', border: `1px solid ${C.danger}`, color: C.danger }}>
                        NECK
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: C.muted }}>{ex.sets} &times; {ex.reps}</p>
                  {ex.description && (
                    <p className="text-xs mt-1" style={{ color: C.muted }}>{ex.description}</p>
                  )}
                </div>
                <div className="text-right ml-4 flex flex-col items-end gap-1">
                  {isBodyweight ? (
                    <p className="text-sm" style={{ color: C.muted }}>Bodyweight</p>
                  ) : lastW !== null && lastW !== undefined ? (
                    <p className="font-bold" style={{ color: isComplete ? C.success : accent }}>{lastW} lbs</p>
                  ) : ex.starting_weight ? (
                    <p className="text-sm" style={{ color: C.muted }}>{ex.starting_weight}</p>
                  ) : (
                    <p className="text-xs" style={{ color: C.muted }}>No weight yet</p>
                  )}
                  {isComplete && (
                    <span
                      className="text-xs font-bold"
                      style={{ color: C.success, animation: 'pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
                    >
                      ✓ done
                    </span>
                  )}
                  {isPartial && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${accent}25`, color: accent }}
                    >
                      {doneCount}/{totalSets}
                    </span>
                  )}
                  <span className="text-2xl leading-none" style={{ color: C.border }}>&rsaquo;</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {showNeck && <NeckSafetyModal onClose={() => setShowNeck(false)} />}
    </div>
  )
}
