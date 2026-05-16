export interface Block {
  id: number
  name: string
  type: 'strength' | 'cardio' | 'core' | 'recovery'
  description: string | null
  sort_order: number
}

export interface Exercise {
  id: number
  block_id: number
  name: string
  sets: number | null
  reps: string | null
  starting_weight: string | null
  notes: string | null
  neck_flag: boolean
  sort_order: number
}

export interface Session {
  id: number
  date: string
  block_id: number | null
  notes: string | null
  feeling: string | null
  created_at: string
}

export interface WalkLog {
  id: number
  date: string
  created_at: string
}

export interface SetLog {
  id: number
  session_id: number
  exercise_id: number
  set_number: number
  weight: number | null
  reps: number | null
  completed_at: string
}

export interface CardioLog {
  id: number
  date: string
  session_id: number | null
  type: 'interval_run' | 'sustained_run' | 'zone2'
  subtype: 'treadmill' | 'peloton' | null
  duration_minutes: number | null
  avg_hr: number | null
  notes: string | null
  created_at: string
}

export interface VO2maxLog {
  id: number
  date: string
  value: number
  source: 'manual' | 'apple_watch'
  created_at: string
}
