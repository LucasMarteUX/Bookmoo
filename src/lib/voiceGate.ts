// O aviso "baixe uma voz" aparece uma vez. Depois de fechar, não volta.
const SEEN_KEY = 'bookmoo.voicePromptSeen'

const listeners = new Set<() => void>()

export function voicePromptSeen() {
  try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return false }
}

export function markVoicePromptSeen() {
  try { localStorage.setItem(SEEN_KEY, '1') } catch { /* storage cheio ou bloqueado */ }
}

export function subscribeVoicePrompt(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Abre o aviso só se a pessoa ainda não viu. */
export function askVoiceOnce() {
  if (voicePromptSeen()) return
  listeners.forEach((fn) => fn())
}
