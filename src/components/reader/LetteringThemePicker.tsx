import { useState } from 'react'
import { Check, ChevronDown, Sparkles } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToolButton } from '@/components/ui/toolbar'
import { LETTERING_THEMES, type LetteringTheme, type LetteringThemeId } from '@/lib/comicThemes'

/** Tiny caption box drawn with the theme's own colours and font. */
function Swatch({ theme, size = 'sm' }: { theme: LetteringTheme; size?: 'sm' | 'lg' }) {
  return (
    <span className={`inline-flex items-center justify-center ${size === 'sm' ? 'w-7 h-5 text-[11px]' : 'px-2 py-1 text-[13px]'} leading-none`}
      style={{
        fontFamily: theme.font, fontWeight: theme.weight, color: theme.caption.text,
        background: `linear-gradient(${theme.caption.top}, ${theme.caption.bottom})`,
        border: `1.5px solid ${theme.caption.border}`, borderRadius: theme.caption.radius ? 5 : 1,
        boxShadow: theme.shadow ? `2px 2px 0 ${theme.shadowColor}` : undefined,
        textTransform: theme.uppercase ? 'uppercase' : undefined,
      }}>
      Aa
    </span>
  )
}

/** Minimal sample: the theme's caption box with one highlighted word, on the app surface. */
function Sample({ theme }: { theme: LetteringTheme }) {
  return (
    <span className="flex items-center justify-center w-[68px] h-11 shrink-0 rounded-lg" style={{ backgroundColor: 'var(--theme-bg)' }}>
      <span className="px-1.5 py-1 text-[12px] leading-none"
        style={{
          fontFamily: theme.font, fontWeight: theme.weight, color: theme.caption.text,
          textTransform: theme.uppercase ? 'uppercase' : undefined,
          background: theme.caption.top, border: `1.5px solid ${theme.caption.border}`,
          borderRadius: theme.caption.radius ? 4 : 1, boxShadow: theme.shadow ? `2px 2px 0 ${theme.shadowColor}` : undefined,
        }}>
        A<span style={{ background: theme.highlight.bg, color: theme.highlight.text, borderRadius: 3, padding: '0 1px', marginLeft: 1 }}>a</span>
      </span>
    </span>
  )
}

export function LetteringThemePicker({ theme, choice, detected, onChange, pt }: {
  theme: LetteringTheme
  choice: LetteringThemeId | null
  detected: LetteringThemeId
  onChange: (id: LetteringThemeId | null) => void
  pt: boolean
}) {
  const [open, setOpen] = useState(false)
  const lang = pt ? 'pt' : 'en'
  const pick = (id: LetteringThemeId | null) => { onChange(id); setOpen(false) }
  const ring = 'var(--theme-accent, #7756c6)'
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolButton icon={<Swatch theme={theme} />} label={<>{theme.label[lang]} <ChevronDown className="inline w-3.5 h-3.5 opacity-60" /></>}
          hint={pt ? 'Estilo do texto: fonte, caixas e destaque das palavras' : 'Lettering style: font, boxes and word highlight'} compact />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,440px)] p-2.5 rounded-2xl shadow-2xl border z-50"
        style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)', color: 'var(--theme-text)' }}>
        <div className="px-1 pb-3">
          <p className="text-sm font-semibold">{pt ? 'Estilo do texto' : 'Lettering style'}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Muda a fonte, as caixas de narração, os balões e o destaque da palavra lida. Fica salvo neste livro.'
              : 'Changes the font, narration boxes, balloons and the highlight of the word being read. Saved for this book.'}
          </p>
        </div>
        <button type="button" onClick={() => pick(null)}
          className="w-full flex items-center gap-3 p-2.5 mb-3 rounded-xl border text-left hover:bg-[var(--theme-nav-hover)]"
          style={{ borderColor: choice === null ? ring : 'var(--theme-border-subtle)', boxShadow: choice === null ? `0 0 0 1px ${ring}` : undefined }}>
          <span className="grid place-items-center w-8 h-8 rounded-full" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
            <Sparkles className="w-4 h-4" style={{ color: ring }} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium">{pt ? 'Automático' : 'Automatic'}</span>
            <span className="block text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
              {pt ? `Pela arte do livro: ${LETTERING_THEMES[detected].label.pt}` : `From the book's art: ${LETTERING_THEMES[detected].label.en}`}
            </span>
          </span>
          {choice === null && <Check className="w-4 h-4" style={{ color: ring }} />}
        </button>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[52vh] overflow-y-auto pr-1">
          {Object.values(LETTERING_THEMES).map(item => {
            const selected = choice === item.id
            return (
              <button key={item.id} type="button" onClick={() => pick(item.id)} aria-pressed={selected}
                className="flex items-center gap-3 p-2 rounded-xl text-left transition-colors hover:bg-[var(--theme-nav-hover)]"
                style={{ backgroundColor: selected ? 'var(--theme-nav-hover)' : undefined, boxShadow: selected ? `inset 0 0 0 1.5px ${ring}` : undefined }}>
                <Sample theme={item} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-[13px] font-semibold">
                    {item.label[lang]}
                    {selected && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: ring }} />}
                  </span>
                  <span className="block text-[11px] leading-snug truncate" style={{ color: 'var(--theme-text-secondary)' }}>{item.blurb[lang]}</span>
                </span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
