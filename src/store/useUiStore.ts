// Preferências de interface que valem só para este aparelho (ex.: sidebar recolhida).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    { name: 'bookmoo-ui' },
  ),
)

/** Largura da sidebar no desktop (o conteúdo e as barras flutuantes se alinham a ela). */
export const SIDEBAR_WIDTH = { expanded: '16rem', collapsed: '76px' } as const
