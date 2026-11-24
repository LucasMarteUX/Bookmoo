// CAPTCHA (Cloudflare Turnstile) para login, cadastro e "esqueci a senha".
// Só aparece quando VITE_TURNSTILE_SITE_KEY existe; sem a chave, nada muda.
// Ao ligar a chave aqui, ligue também o CAPTCHA em Supabase → Authentication → Attack Protection (com o secret).
import { useEffect, useRef } from 'react'

export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || ''
export const captchaEnabled = Boolean(TURNSTILE_SITE_KEY)

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id?: string) => void
  remove: (id?: string) => void
}
declare global { interface Window { turnstile?: TurnstileApi } }

let loader: Promise<void> | null = null
function loadScript() {
  if (window.turnstile) return Promise.resolve()
  loader ??= new Promise<void>((ok, fail) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true; s.defer = true
    s.onload = () => ok(); s.onerror = () => { loader = null; fail(new Error('turnstile')) }
    document.head.appendChild(s)
  })
  return loader
}

/** Widget discreto. `resetKey` muda → gera um token novo (cada token vale uma tentativa). */
export function Turnstile({ onToken, resetKey = 0, theme = 'auto' }: { onToken: (t: string | null) => void; resetKey?: number; theme?: 'auto' | 'light' | 'dark' }) {
  const box = useRef<HTMLDivElement>(null)
  const id = useRef<string | null>(null)
  const cb = useRef(onToken)
  cb.current = onToken

  useEffect(() => {
    if (!captchaEnabled) return
    let dead = false
    loadScript().then(() => {
      if (dead || !box.current || !window.turnstile) return
      id.current = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY, theme, size: 'flexible', language: 'pt-BR',
        callback: (t: string) => cb.current(t),
        'expired-callback': () => cb.current(null),
        'error-callback': () => cb.current(null),
      })
    }).catch(() => cb.current(null))
    return () => { dead = true; if (id.current) window.turnstile?.remove(id.current); id.current = null }
  }, [theme])

  useEffect(() => {
    if (!resetKey || !id.current) return
    cb.current(null)
    window.turnstile?.reset(id.current)
  }, [resetKey])

  if (!captchaEnabled) return null
  return <div ref={box} className="mt-1 min-h-[65px]" />
}
