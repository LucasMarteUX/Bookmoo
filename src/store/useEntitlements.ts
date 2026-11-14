// Estado do plano da pessoa logada (vem do servidor via get_entitlements). Só exibe e orienta a interface:
// quem libera ou bloqueia de verdade são as Edge Functions e o banco.
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { PlanId } from '@/lib/plans'

export type Limits = {
  library: boolean; imports: number | null; text_books: number | null; pages: number | null; mosaic: number | null
  custom_style: boolean; tutor: boolean; scenes: 'demo' | 'all'; scenes_create: boolean; free_talk: boolean
  insights: 'none' | 'weekly' | 'on_demand'; stories: number | null; max_scene_minutes: number
  feedback: 'summary' | 'full' | 'detailed'; monthly_report: boolean
}

export type Entitlements = {
  plan: PlanId
  plan_name: string
  plan_rank: number
  limits: Limits
  is_admin: boolean
  email_confirmed: boolean
  credits: { granted: number; used: number; reserved: number; available: number }
  seconds: { granted: number; used: number; reserved: number; available: number }
  usage: Record<string, number>
  period: { starts_at: string; ends_at: string }
  subscription: null | {
    id: string; status: string; plan: PlanId; price_cents: number; provider: string; current_period_end: string
    cancel_at_period_end: boolean; pending_plan: PlanId | null; grace_until: string | null
  }
  last_subscription_status: string | null
  gift: null | { catalog_id: string; redeemed_at: string; swapped: boolean }
  onboarding_step: 'complete_profile' | 'plans' | 'gift' | 'done'
  birth_date: string | null
  flagged: boolean
}

type State = {
  data: Entitlements | null
  loading: boolean
  /** O banco ainda não tem as tabelas de planos (migration não aplicada): tudo segue liberado como antes. */
  unavailable: boolean
  load: () => Promise<Entitlements | null>
  clear: () => void
}

let inflight: Promise<Entitlements | null> | null = null

export const useEntitlements = create<State>((set) => ({
  data: null,
  loading: false,
  unavailable: false,
  load: async () => {
    if (!supabase) return null
    if (inflight) return inflight
    set({ loading: true })
    inflight = (async () => {
      const { data, error } = await supabase!.rpc('get_entitlements')
      inflight = null
      if (error) {
        const missing = /get_entitlements|does not exist|schema cache/i.test(error.message)
        set({ loading: false, unavailable: missing })
        return null
      }
      set({ data: data as Entitlements, loading: false, unavailable: false })
      return data as Entitlements
    })()
    return inflight
  },
  clear: () => set({ data: null, unavailable: false }),
}))

/** Recarrega o saldo depois de qualquer uso de IA (chamado pelo cliente de IA). */
export function refreshEntitlements() {
  void useEntitlements.getState().load()
}

/** O livro da galeria está liberado para a pessoa? */
export function canOpenCatalog(e: Entitlements | null, catalogId: string | undefined | null) {
  if (!e) return true
  if (!catalogId) return true
  return e.is_admin || e.limits.library || e.gift?.catalog_id === catalogId
}

export const isPaid = (e: Entitlements | null) => !!e && e.plan !== 'free'
