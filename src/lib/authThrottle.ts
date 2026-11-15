// Freio no aparelho para tentativas seguidas de entrar ou criar conta. É uma camada de conforto e de
// proteção contra robô simples: o limite de verdade fica no Supabase Auth (ver docs/SEGURANCA.md).
const KEY = 'bookmoo-auth-throttle'
type State = { fails: number; until: number; last: number }
const FREE_TRIES = 4          // erros sem espera
const BASE_MS = 15_000        // a partir do 5º erro: 15 s, 30 s, 60 s... até 10 min
const MAX_MS = 10 * 60_000
const RESET_AFTER_MS = 30 * 60_000

function read(): State {
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as State | null; if (s && Date.now() - s.last < RESET_AFTER_MS) return s } catch { /* sem armazenamento */ }
  return { fails: 0, until: 0, last: 0 }
}
function write(s: State) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ } }

/** Segundos que faltam para poder tentar de novo (0 = livre). */
export function throttleWait(): number {
  const s = read()
  return Math.max(0, Math.ceil((s.until - Date.now()) / 1000))
}
export function throttleFail() {
  const s = read()
  const fails = s.fails + 1
  const over = fails - FREE_TRIES
  write({ fails, last: Date.now(), until: over > 0 ? Date.now() + Math.min(MAX_MS, BASE_MS * 2 ** (over - 1)) : 0 })
}
export function throttleReset() { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }
