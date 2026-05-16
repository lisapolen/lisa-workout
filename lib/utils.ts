/** Returns today's date in YYYY-MM-DD using the device's local timezone, not UTC. */
export function getLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Parses the first number from a reps string like "8-12" or "10". Returns 0 if none. */
export function parseTargetReps(repsStr: string | null): number {
  if (!repsStr) return 0
  const match = repsStr.match(/\d+/)
  return match ? parseInt(match[0]) : 0
}

/** Parses the numeric portion of a starting weight string. Returns '' for bodyweight. */
export function parseStartingWeight(sw: string | null): string {
  if (!sw || sw === 'Bodyweight') return ''
  const match = sw.match(/[\d.]+/)
  return match ? match[0] : ''
}

/** Formats elapsed seconds as M:SS. */
export function formatElapsed(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

/** Returns the current easter egg record from localStorage. */
export function getEasterEggs(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem('easter_eggs') || '{}') } catch { return {} }
}

/** Marks an easter egg as fired in localStorage. */
export function markEasterEgg(key: string) {
  const eggs = getEasterEggs()
  eggs[key] = true
  localStorage.setItem('easter_eggs', JSON.stringify(eggs))
}
