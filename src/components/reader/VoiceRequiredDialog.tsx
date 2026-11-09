// Antes do play: se não há voz instalada, pede para instalar uma (em vez de cair na voz robótica
// do navegador). Fecha sozinho assim que a voz termina de baixar.
import { useEffect } from 'react'
import { Download, Volume2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { VoiceSelect } from '@/components/layout/VoiceSelect'
import { activeKokoroVoice, isKokoroSupported, subscribeKokoro } from '@/lib/kokoro/engine'
import { isTtsConfigured } from '@/lib/tts'

/** True quando a narração em inglês ainda não tem uma voz de verdade instalada. */
export function needsVoiceInstall(language: string) {
  return language.startsWith('en') && isKokoroSupported() && !activeKokoroVoice() && !isTtsConfigured()
}

export function VoiceRequiredDialog({ open, onOpenChange, pt, onReady }: {
  open: boolean; onOpenChange: (open: boolean) => void; pt: boolean; onReady?: () => void
}) {
  useEffect(() => {
    if (!open) return
    return subscribeKokoro(() => {
      if (activeKokoroVoice()) { onOpenChange(false); onReady?.() }
    })
  }, [open, onOpenChange, onReady])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" style={{ color: 'var(--theme-accent)' }} />
            {pt ? 'Instale uma voz primeiro' : 'Install a voice first'}
          </DialogTitle>
          <DialogDescription>
            {pt
              ? 'Para ouvir a leitura com pronúncia natural, escolha uma voz. Ela é baixada uma vez (cerca de 90 MB na primeira) e depois funciona até sem internet.'
              : 'To hear natural pronunciation, pick a voice. It downloads once (about 90 MB the first time) and then works even offline.'}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border p-3 space-y-2" style={{ borderColor: 'var(--theme-border-subtle)', backgroundColor: 'var(--theme-bg-secondary)' }}>
          <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--theme-text-secondary)' }}>
            <Download className="w-3.5 h-3.5" /> {pt ? 'Escolha a voz da leitura' : 'Choose the reading voice'}
          </p>
          <VoiceSelect />
        </div>
        <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Você pode trocar de voz quando quiser no menu lateral, em "Voz da leitura".' : 'You can change voices anytime in the sidebar, under "Reading voice".'}
        </p>
      </DialogContent>
    </Dialog>
  )
}
