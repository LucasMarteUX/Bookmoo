// Ajuda contextual "(i)": explica um recurso em uma ou duas frases e leva para a pergunta certa do FAQ.
// Uso: <InfoHint title="Status da palavra" faq="status">Aprendi tira a palavra da revisão…</InfoHint>
import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Info, ArrowRight } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useLanguage } from '@/store/useLanguage'

export function InfoHint({ title, children, faq, side = 'bottom', align = 'start', className }: {
  title?: string
  children: ReactNode
  /** id da pergunta no FAQ (/faq#id). */
  faq?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  className?: string
}) {
  const pt = useLanguage().locale === 'pt-BR'
  const [open, setOpen] = useState(false)
  const here = useLocation()
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" data-no-tip aria-label={title ? `${pt ? 'Ajuda' : 'Help'}: ${title}` : pt ? 'Ajuda' : 'Help'}
          className={`info-hint ui-hover ${className ?? ''}`} onClick={e => e.stopPropagation()}>
          <Info className="w-[15px] h-[15px]" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-72 p-4 anim-fade-up" onClick={e => e.stopPropagation()}>
        {title && <p className="text-[13.5px] font-semibold mb-1">{title}</p>}
        <div className="text-[13.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>{children}</div>
        {faq && (
          <Link to={`/faq?back=${encodeURIComponent(here.pathname + here.search)}#${faq}`} onClick={() => setOpen(false)}
            className="group mt-3 inline-flex items-center gap-1 text-[13px] font-medium" style={{ color: 'var(--theme-text)' }}>
            {pt ? 'Saiba mais no FAQ' : 'Learn more in the FAQ'}
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </PopoverContent>
    </Popover>
  )
}
