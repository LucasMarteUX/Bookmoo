// Peças visuais compartilhadas pela aula: contexto da página, ouvir, custo discreto, texto com negrito/listas e tons.
import { createContext, useContext, type ReactNode } from 'react'
import { Volume2 } from 'lucide-react'
import { speak } from '@/lib/tts'
import type { PageLessonData } from './lessonStore'

export type LessonEnv = {
  bookId: string; bookTitle: string; page: number; lang: 'pt' | 'en'; level: string; pt: boolean
  data: PageLessonData | null
  patch: (fn: (d: PageLessonData) => PageLessonData) => void
  /** Abre o chat com uma pergunta pronta (ex.: a partir de uma palavra selecionada). */
  ask: (question: string) => void
}
export const LessonCtx = createContext<LessonEnv | null>(null)
export function useLessonEnv() {
  const v = useContext(LessonCtx)
  if (!v) throw new Error('LessonCtx ausente')
  return v
}

export const muted = { color: 'var(--theme-text-secondary)' }
export const card = { borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }
/** Fundo levemente tingido que funciona no tema claro e no escuro. */
export const tint = (hex: string, pct = 9) => ({ backgroundColor: `color-mix(in srgb, ${hex} ${pct}%, var(--theme-card-bg))`, borderColor: `color-mix(in srgb, ${hex} 28%, var(--theme-border))` })
export const TONE = { green: '#059669', red: '#dc2626', amber: '#d97706', violet: '#7c3aed', blue: '#2563eb' }

export function Say({ text, label, size = 'md' }: { text: string; label?: string; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'
  return (
    <button type="button" data-lesson-ui onClick={() => { void speak(text, { context: 'phrase' }).catch(() => {}) }} aria-label={label ?? 'Ouvir'} title={label ?? 'Ouvir'}
      className={`shrink-0 ${s} rounded-full grid place-items-center transition-colors hover:bg-[var(--ui-hover)]`} style={muted}>
      <Volume2 className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
    </button>
  )
}

/** Custo em créditos, discreto, ao lado de cada ação de IA. */
export function Cost({ n, pt }: { n: number; pt: boolean }) {
  return <span className="ml-1 text-[11px] font-normal tabular-nums opacity-60">· {n} {pt ? (n === 1 ? 'crédito' : 'créditos') : (n === 1 ? 'credit' : 'credits')}</span>
}

export function Chip({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[11.5px] font-semibold whitespace-nowrap" style={{ backgroundColor: 'var(--theme-bg-secondary)', ...style }}>{children}</span>
}

/** Frase em inglês: tocar numa palavra seleciona e abre marcar/explicar. */
export function En({ children, className = '', as: Tag = 'span' }: { children: ReactNode; className?: string; as?: 'span' | 'p' }) {
  return <Tag data-en className={className}>{children}</Tag>
}

/** Negrito com **...** e listas com "- ". Sem HTML vindo da IA. */
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/)
  const inline = (s: string, k: number) => s.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={`${k}-${i}`} className="font-semibold">{part.slice(2, -2)}</strong>
      : part.length > 2 && part.startsWith('*') && part.endsWith('*') ? <em key={`${k}-${i}`} data-en className="font-serif">{part.slice(1, -1)}</em>
        : <span key={`${k}-${i}`}>{part}</span>)
  return (
    <div className={`space-y-2.5 ${className}`}>
      {blocks.map((b, bi) => {
        const lines = b.split('\n').map(l => l.trim()).filter(Boolean)
        if (lines.length && lines.every(l => /^[-•*]\s+/.test(l))) {
          return <ul key={bi} className="space-y-1.5">{lines.map((l, li) => <li key={li} className="flex gap-2"><span className="mt-[0.6em] w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'currentColor', opacity: 0.45 }} /><span className="min-w-0">{inline(l.replace(/^[-•*]\s+/, ''), li)}</span></li>)}</ul>
        }
        return <p key={bi}>{lines.map((l, li) => <span key={li}>{li > 0 && <br />}{inline(l.replace(/^[-*]\s+/, '• '), li)}</span>)}</p>
      })}
    </div>
  )
}
