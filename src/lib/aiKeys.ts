// Estado das chaves de IA do usuário. A chave em si nunca chega ao navegador depois de enviada:
// o servidor só devolve se está conectada e os 4 últimos caracteres.
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type AiProvider = 'openai' | 'gemini'
export type ProviderStatus = { connected: boolean; hint: string | null; verifiedAt: string | null }
export type AiStatus = Record<AiProvider, ProviderStatus>

const EMPTY: AiStatus = {
  openai: { connected: false, hint: null, verifiedAt: null },
  gemini: { connected: false, hint: null, verifiedAt: null },
}

let cache: AiStatus | null = null
let inflight: Promise<AiStatus> | null = null
let accountRevision = 0
const listeners = new Set<(s: AiStatus | null) => void>()
const emit = (s: AiStatus) => { cache = s; listeners.forEach((l) => l(s)) }

async function call(method: 'GET' | 'POST', body?: Record<string, unknown>): Promise<AiStatus> {
  if (!supabase) return EMPTY
  const { data, error } = await supabase.functions.invoke('ai-keys', { method, body })
  if (error) {
    let code = 'request_failed'
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const j = await ctx.json().catch(() => null) as { error?: string } | null
      if (j?.error) code = j.error
    }
    throw new Error(code)
  }
  return (data as { providers: AiStatus }).providers
}

export function getAiStatus(force = false): Promise<AiStatus> {
  if (cache && !force) return Promise.resolve(cache)
  if (!inflight) {
    const revision = accountRevision
    const request = call('GET').then(status => {
      if (revision !== accountRevision) throw new Error('account_changed')
      emit(status)
      return status
    }).finally(() => { if (inflight === request) inflight = null })
    inflight = request
  }
  return inflight
}

export function hasAnyAiKey(s: AiStatus | null) {
  return !!s && (s.openai.connected || s.gemini.connected)
}

export async function connectAiKey(provider: AiProvider, apiKey: string) {
  const revision = accountRevision
  const status = await call('POST', { provider, apiKey })
  if (revision === accountRevision) emit(status)
}

export async function removeAiKey(provider: AiProvider) {
  const revision = accountRevision
  const status = await call('POST', { action: 'delete', provider })
  if (revision === accountRevision) emit(status)
}

/** Limpa o cache (ex.: ao sair da conta). */
export function resetAiStatus() {
  accountRevision++
  cache = null
  inflight = null
  listeners.forEach(listener => listener(null))
}

export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus | null>(cache)
  const [error, setError] = useState(false)
  useEffect(() => {
    listeners.add(setStatus)
    let active = true
    getAiStatus().catch(error => { if (active && error.message !== 'account_changed') setError(true) })
    return () => { active = false; listeners.delete(setStatus) }
  }, [])
  return { status, loading: !status && !error, error }
}

export function aiKeyErrorMessage(code: string): string {
  switch (code) {
    case 'invalid_key': return 'Essa chave foi recusada pelo provedor. Confira se copiou a chave inteira e se ela está ativa.'
    case 'invalid_key_format': return 'Formato de chave inválido.'
    case 'validation_unreachable': return 'Não foi possível falar com o provedor agora. Tente de novo em instantes.'
    default: return 'Não foi possível salvar a chave. Tente novamente.'
  }
}
