import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Switch } from '@/components/ui/switch'
import { useReaderSettings, type Theme } from '@/store/useReaderSettings'
import { useReaderChrome } from '@/store/useReaderChrome'
import { haptics } from '@/lib/haptics'

const SPACING = [
  { value: '1.5', pt: 'Justo', en: 'Tight' },
  { value: '1.8', pt: 'Normal', en: 'Normal' },
  { value: '2.1', pt: 'Amplo', en: 'Airy' },
] as const

const THEMES: { id: Theme; pt: string; en: string; bg: string; fg: string }[] = [
  { id: 'light', pt: 'Claro', en: 'Light', bg: '#ffffff', fg: '#1d1c1a' },
  { id: 'sepia', pt: 'Sépia', en: 'Sepia', bg: '#f4ecd8', fg: '#433422' },
  { id: 'dark', pt: 'Escuro', en: 'Dark', bg: '#1c1b19', fg: '#ebe7df' },
]

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--theme-text-secondary)' }}>{label}</p>
      {children}
    </section>
  )
}

/** Aparência da leitura no celular: tamanho, espaçamento, fonte, tema e gestos. Tudo muda ao vivo, por trás da folha. */
export function ReaderAppearanceSheet({ open, onOpenChange, pt }: { open: boolean; onOpenChange: (o: boolean) => void; pt: boolean }) {
  const { fontSize, setFontSize, lineHeight, setLineHeight, fontFamily, setFontFamily, theme, setTheme } = useReaderSettings()
  const edgeTap = useReaderChrome(s => s.edgeTap)
  const setEdgeTap = useReaderChrome(s => s.setEdgeTap)
  const spacing = SPACING.reduce((best, s) => Math.abs(Number(s.value) - lineHeight) < Math.abs(Number(best.value) - lineHeight) ? s : best, SPACING[1]).value
  const size = (n: number) => { const v = Math.max(12, Math.min(32, n)); if (v !== fontSize) { setFontSize(v); haptics.selection() } }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5">
        <div>
          <DialogTitle className="text-[17px]">{pt ? 'Aparência' : 'Appearance'}</DialogTitle>
          <DialogDescription className="sr-only">{pt ? 'Tamanho da letra, espaçamento, fonte, tema e gestos da leitura.' : 'Text size, spacing, font, theme and reading gestures.'}</DialogDescription>
        </div>

        <Row label={pt ? 'Tamanho da letra' : 'Text size'}>
          <div className="flex items-center gap-3 rounded-2xl px-2 h-14" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
            <button type="button" onClick={() => size(fontSize - 1)} disabled={fontSize <= 12} aria-label={pt ? 'Diminuir a letra' : 'Smaller text'}
              className="pressable w-11 h-11 grid place-items-center rounded-xl text-[14px] font-semibold disabled:opacity-35" style={{ fontFamily: 'var(--font-serif)' }}>A</button>
            <input type="range" min={12} max={32} step={1} value={fontSize} onChange={e => size(Number(e.target.value))}
              aria-label={pt ? 'Tamanho da letra' : 'Text size'} aria-valuetext={`${fontSize} px`}
              className="reader-range flex-1" />
            <button type="button" onClick={() => size(fontSize + 1)} disabled={fontSize >= 32} aria-label={pt ? 'Aumentar a letra' : 'Larger text'}
              className="pressable w-11 h-11 grid place-items-center rounded-xl text-[22px] font-semibold disabled:opacity-35" style={{ fontFamily: 'var(--font-serif)' }}>A</button>
          </div>
        </Row>

        <Row label={pt ? 'Espaço entre linhas' : 'Line spacing'}>
          <SegmentedControl className="flex w-full [&>button]:min-h-11" value={spacing} onChange={v => setLineHeight(Number(v))} label={pt ? 'Espaço entre linhas' : 'Line spacing'}
            options={SPACING.map(s => ({ value: s.value, label: pt ? s.pt : s.en }))} />
        </Row>

        <Row label={pt ? 'Fonte' : 'Font'}>
          <div className="grid grid-cols-2 gap-2">
            {(['serif', 'sans'] as const).map(f => (
              <button key={f} type="button" onClick={() => { setFontFamily(f); haptics.selection() }} aria-pressed={fontFamily === f}
                className="pressable h-[60px] rounded-2xl border flex flex-col items-center justify-center gap-0.5"
                style={{ borderColor: fontFamily === f ? 'var(--theme-text)' : 'var(--theme-border)', backgroundColor: fontFamily === f ? 'var(--theme-nav-active)' : 'transparent' }}>
                <span className="text-[20px] leading-none" style={{ fontFamily: f === 'serif' ? '"Playfair Display", Georgia, serif' : 'Inter, system-ui, sans-serif' }}>Aa</span>
                <span className="text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}>{f === 'serif' ? (pt ? 'Clássica' : 'Classic') : (pt ? 'Moderna' : 'Modern')}</span>
              </button>
            ))}
          </div>
        </Row>

        <Row label={pt ? 'Tema' : 'Theme'}>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={pt ? 'Tema' : 'Theme'}>
            {THEMES.map(t => (
              <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} onClick={() => { setTheme(t.id); haptics.selection() }}
                className="pressable h-[60px] rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5"
                style={{ backgroundColor: t.bg, color: t.fg, borderColor: theme === t.id ? 'var(--theme-text)' : 'color-mix(in srgb, var(--theme-text) 12%, transparent)' }}>
                <span className="text-[18px] leading-none" style={{ fontFamily: 'var(--font-serif)' }}>Aa</span>
                <span className="text-[12px] font-medium">{pt ? t.pt : t.en}</span>
              </button>
            ))}
          </div>
        </Row>

        <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-medium">{pt ? 'Tocar nas bordas vira a página' : 'Tap the edges to turn pages'}</p>
            <p className="text-[12.5px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Deslizar para os lados sempre funciona.' : 'Swiping sideways always works.'}</p>
          </div>
          <Switch checked={edgeTap} onChange={setEdgeTap} label={pt ? 'Tocar nas bordas vira a página' : 'Tap the edges to turn pages'} />
        </div>

        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }} aria-label={pt ? 'Gestos' : 'Gestures'}>
          <li><strong className="font-medium" style={{ color: 'var(--theme-text)' }}>{pt ? 'Toque' : 'Tap'}</strong>: {pt ? 'mostra os controles' : 'shows controls'}</li>
          <li><strong className="font-medium" style={{ color: 'var(--theme-text)' }}>{pt ? 'Deslize' : 'Swipe'}</strong>: {pt ? 'vira a página' : 'turns the page'}</li>
          <li><strong className="font-medium" style={{ color: 'var(--theme-text)' }}>{pt ? 'Segure' : 'Hold'}</strong>: {pt ? 'opções da palavra' : 'word options'}</li>
          <li><strong className="font-medium" style={{ color: 'var(--theme-text)' }}>{pt ? 'Segure e arraste' : 'Hold and drag'}</strong>: {pt ? 'uma frase' : 'a phrase'}</li>
          <li className="col-span-2"><strong className="font-medium" style={{ color: 'var(--theme-text)' }}>{pt ? 'Pinça' : 'Pinch'}</strong>: {pt ? 'aumenta ou diminui a letra' : 'changes the text size'}</li>
        </ul>
      </DialogContent>
    </Dialog>
  )
}
