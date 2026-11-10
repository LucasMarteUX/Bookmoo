// Preferências de interface que valem só para este aparelho (ex.: sidebar recolhida, meta diária).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  /** Paleta de comandos (⌘K): não persiste. */
  commandOpen: boolean
  setCommandOpen: (open: boolean) => void
  /** Meta diária de estudo, em minutos. */
  dailyGoalMinutes: number
  setDailyGoalMinutes: (minutes: number) => void
  /** Pedido para abrir o "Adicionar livro" na home (vindo da paleta ou da sidebar). */
  addBookRequest: number
  requestAddBook: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      commandOpen: false,
      setCommandOpen: commandOpen => set({ commandOpen }),
      dailyGoalMinutes: 15,
      setDailyGoalMinutes: dailyGoalMinutes => set({ dailyGoalMinutes: Math.max(5, Math.min(120, Math.round(dailyGoalMinutes))) }),
      addBookRequest: 0,
      requestAddBook: () => set(state => ({ addBookRequest: state.addBookRequest + 1 })),
    }),
    { name: 'bookmoo-ui', partialize: state => ({ sidebarCollapsed: state.sidebarCollapsed, dailyGoalMinutes: state.dailyGoalMinutes }) },
  ),
)

/** Largura da sidebar no desktop (o conteúdo e as barras flutuantes se alinham a ela). */
export const SIDEBAR_WIDTH = { expanded: '15.5rem', collapsed: '64px' } as const
