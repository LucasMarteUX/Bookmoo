import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { Share, SquarePlus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/store/useLanguage'
import { isStandalone } from './routes'

const KEY = 'bookmoo-install-prompt'
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: BIPEvent | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as BIPEvent })
}

const useInstall = create<{ open: boolean; set: (open: boolean) => void }>(set => ({ open: false, set: open => set({ open }) }))

/** Abre o convite de instalação (Android usa o prompt nativo; iOS mostra o passo a passo). */
export function openInstallPrompt() {
  if (deferred) { void deferred.prompt(); deferred = null; return }
  useInstall.getState().set(true)
}

function readState(): { visits: number; dismissed: boolean } {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '') } catch { return { visits: 0, dismissed: false } }
}
function writeState(s: { visits: number; dismissed: boolean }) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* modo privado */ }
}

/**
 * O iOS não tem prompt de instalação: mostramos, uma única vez e só a partir da 2ª visita,
 * como adicionar à Tela de Início. Também pode ser aberto pela aba "Você".
 */
export function InstallPrompt() {
  const { open, set } = useInstall()
  const pt = useLanguage().locale === 'pt-BR'
  const [ios] = useState(() => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

  useEffect(() => {
    if (isStandalone()) return
    const s = readState()
    const next = { ...s, visits: (s.visits ?? 0) + 1 }
    writeState(next)
    if (ios && !s.dismissed && next.visits >= 2) {
      // Não empilha sobre outro diálogo aberto.
      const id = setTimeout(() => { if (!document.querySelector('[role="dialog"]')) set(true) }, 4000)
      return () => clearTimeout(id)
    }
  }, [ios, set])

  const close = (o: boolean) => {
    if (!o) writeState({ ...readState(), dismissed: true })
    set(o)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pt ? 'Instale o Bookmoo' : 'Install Bookmoo'}</DialogTitle>
          <DialogDescription>
            {pt ? 'Abra em tela cheia direto da Tela de Início, leia offline e receba lembretes de estudo.' : 'Open full-screen from your Home Screen, read offline and get study reminders.'}
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-[15px]" style={{ color: 'var(--theme-text)' }}>
          <li className="flex items-center gap-3">
            <span className="ios-row-icon" style={{ backgroundColor: 'var(--pastel-blue-bg)', color: 'var(--pastel-blue-fg)' }} aria-hidden><Share className="w-[18px] h-[18px]" /></span>
            {pt ? <span>Toque em <b>Compartilhar</b> na barra do Safari</span> : <span>Tap <b>Share</b> in Safari’s toolbar</span>}
          </li>
          <li className="flex items-center gap-3">
            <span className="ios-row-icon" style={{ backgroundColor: 'var(--pastel-green-bg)', color: 'var(--pastel-green-fg)' }} aria-hidden><SquarePlus className="w-[18px] h-[18px]" /></span>
            {pt ? <span>Escolha <b>Adicionar à Tela de Início</b></span> : <span>Choose <b>Add to Home Screen</b></span>}
          </li>
        </ol>
        <Button size="lg" className="w-full" onClick={() => close(false)}>{pt ? 'Entendi' : 'Got it'}</Button>
      </DialogContent>
    </Dialog>
  )
}
