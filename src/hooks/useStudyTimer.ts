import { useState, useEffect, useCallback, useRef } from 'react'
import { useStudyStore } from '@/store/useStudyStore'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { addStudyTimeRemote } from '@/lib/supabaseSync'

export const PRESET_SECONDS = {
  '10min': 10 * 60,
  '20min': 20 * 60,
  '30min': 30 * 60,
  '1h': 60 * 60,
  '2h': 2 * 60 * 60
} as const

export type PresetKey = keyof typeof PRESET_SECONDS | 'livre'

export function useStudyTimer() {
  const [isRunning, setIsRunning] = useState(false)
  const [sessionTime, setSessionTime] = useState(0)
  /** Countdown: seconds left. Only used when selectedDuration != null and running. */
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  /** Preset duration in seconds; null = Livre (count-up). */
  const [selectedDuration, setSelectedDurationState] = useState<number | null>(null)

  const addStudyTime = useStudyStore((state) => state.addStudyTime)
  const { session, hasSupabase } = useAuth()
  const userId = session?.user?.id
  const sessionTimeRef = useRef(0)
  sessionTimeRef.current = sessionTime
  const remainingSecondsRef = useRef(0)
  remainingSecondsRef.current = remainingSeconds
  const selectedDurationRef = useRef<number | null>(null)
  selectedDurationRef.current = selectedDuration

  const syncSessionToRemote = useCallback(
    (seconds: number) => {
      if (seconds <= 0 || !hasSupabase || !supabase || !userId) return
      const today = new Date().toISOString().split('T')[0]
      addStudyTimeRemote(supabase, userId, today, seconds).catch((e) => console.error('Sync study time', e))
    },
    [hasSupabase, userId]
  )

  useEffect(() => {
    let interval: number | undefined
    const duration = selectedDurationRef.current

    if (isRunning) {
      if (duration != null) {
        // Countdown mode: decrement every second
        interval = window.setInterval(() => {
          setRemainingSeconds((prev) => (prev <= 1 ? 0 : prev - 1))
        }, 1000)
      } else {
        // Livre: count up
        interval = window.setInterval(() => {
          setSessionTime((prev) => prev + 1)
          addStudyTime(1)
        }, 1000)
      }
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, addStudyTime])

  // When countdown hits 0: add study time, sync, stop
  useEffect(() => {
    if (isRunning && selectedDuration != null && remainingSeconds === 0) {
      addStudyTime(selectedDuration)
      syncSessionToRemote(selectedDuration)
      setIsRunning(false)
    }
  }, [isRunning, selectedDuration, remainingSeconds, addStudyTime, syncSessionToRemote])

  const setSelectedDuration = useCallback((seconds: number | null) => {
    setSelectedDurationState(seconds)
    if (seconds != null) {
      setRemainingSeconds(seconds)
      setSessionTime(0)
    } else {
      setSessionTime(0)
    }
  }, [])

  const start = useCallback(() => {
    const duration = selectedDurationRef.current
    if (duration != null) {
      setRemainingSeconds(duration)
    } else {
      setSessionTime(0)
    }
    setIsRunning(true)
  }, [])

  const pause = useCallback(() => {
    setIsRunning(false)
    if (selectedDurationRef.current == null) {
      syncSessionToRemote(sessionTimeRef.current)
    }
  }, [syncSessionToRemote])

  const stop = useCallback(() => {
    const duration = selectedDurationRef.current
    if (duration != null) {
      const elapsed = duration - remainingSecondsRef.current
      if (elapsed > 0) {
        addStudyTime(elapsed)
        syncSessionToRemote(elapsed)
      }
      setRemainingSeconds(duration)
    } else {
      syncSessionToRemote(sessionTimeRef.current)
      setSessionTime(0)
    }
    setIsRunning(false)
  }, [syncSessionToRemote, addStudyTime])

  const isCountdownMode = selectedDuration != null
  const displaySeconds = isCountdownMode ? remainingSeconds : sessionTime

  return {
    isRunning,
    sessionTime,
    remainingSeconds,
    selectedDuration,
    setSelectedDuration,
    start,
    pause,
    stop,
    displaySeconds,
    isCountdownMode
  }
}
