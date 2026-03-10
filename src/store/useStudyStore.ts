import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface StudyState {
  totalStudyTime: number // in seconds
  dailyStudyTime: Record<string, number> // YYYY-MM-DD -> seconds
  addStudyTime: (seconds: number) => void
  /** Replace study state (e.g. after loading from Supabase). */
  setStudyState: (total: number, daily: Record<string, number>) => void
}

export const useStudyStore = create<StudyState>()(
  persist(
    (set) => ({
      totalStudyTime: 0,
      dailyStudyTime: {},
      addStudyTime: (seconds) => set((state) => {
        const today = new Date().toISOString().split('T')[0]
        return {
          totalStudyTime: state.totalStudyTime + seconds,
          dailyStudyTime: {
            ...state.dailyStudyTime,
            [today]: (state.dailyStudyTime[today] || 0) + seconds
          }
        }
      }),
      setStudyState: (total, daily) => set({ totalStudyTime: total, dailyStudyTime: daily })
    }),
    {
      name: 'lexis-study'
    }
  )
)
