// Registro dos últimos eventos de voz deste aparelho (escolha de voz, carga do motor, geração, toque, erros).
// Fica no localStorage para sobreviver a uma queda da aba: o /diagnostico-voz junta este registro ao relatório, e assim dá
// para ver o que aconteceu de verdade quando o tutor ficou mudo no celular de alguém.
const KEY = 'upoonly.voiceLog.v1'
const MAX = 150

export type VoiceEvent = { t: string; ev: string; data?: Record<string, unknown> }

let buffer: VoiceEvent[] | null = null
function load(): VoiceEvent[] {
  if (buffer) return buffer
  try { buffer = JSON.parse(localStorage.getItem(KEY) || '[]') as VoiceEvent[] } catch { buffer = [] }
  return buffer!
}
let saveTimer = 0
function save() {
  if (saveTimer) return
  saveTimer = window.setTimeout(() => {
    saveTimer = 0
    try { localStorage.setItem(KEY, JSON.stringify(load().slice(-MAX))) } catch { /* sem espaço: segue só em memória */ }
  }, 300)
}

/** Anota um evento de voz (barato; nunca lança). */
export function voiceLog(ev: string, data?: Record<string, unknown>) {
  try {
    const list = load()
    list.push({ t: new Date().toISOString(), ev, ...(data ? { data } : {}) })
    if (list.length > MAX * 1.5) list.splice(0, list.length - MAX)
    if (typeof window !== 'undefined') save()
    if (import.meta.env.DEV) console.debug('[voz]', ev, data ?? '')
  } catch { /* nunca atrapalha a fala */ }
}

export function voiceLogEntries(): VoiceEvent[] { return [...load()] }
export function clearVoiceLog() { buffer = []; try { localStorage.removeItem(KEY) } catch { /* ignore */ } }
