import { Card } from '@/components/ui/card'

const block = { backgroundColor: 'var(--theme-border-subtle)' }

/**
 * Skeleton do card de livro: mesmas medidas do card real (capa 2:3 inteira, título,
 * autor, descrição curta, palavras e progresso), para a grade não "pular" ao carregar.
 */
export function BookCardSkeleton() {
  return (
    <Card className="p-0 rounded-[16px] border overflow-hidden" aria-hidden
      style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
      {/* Capa no formato de livro */}
      <div className="w-full aspect-[2/3] animate-pulse" style={block} />
      <div className="p-3 flex flex-col">
        <div className="flex items-start gap-1.5 mb-1.5">
          <div className="w-5 h-5 rounded-full shrink-0 animate-pulse" style={block} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 rounded animate-pulse w-[85%]" style={block} />
            <div className="h-3 rounded animate-pulse w-[55%]" style={block} />
          </div>
        </div>
        <div className="space-y-1 mb-1.5">
          <div className="h-2.5 rounded animate-pulse w-full" style={block} />
          <div className="h-2.5 rounded animate-pulse w-[75%]" style={block} />
        </div>
        <div className="h-2.5 rounded animate-pulse w-24 mb-2" style={block} />
        <div className="mt-auto space-y-1.5 pt-2 border-t" style={{ borderColor: 'var(--theme-border-subtle)' }}>
          <div className="flex justify-between items-center">
            <div className="h-2.5 rounded w-14 animate-pulse" style={block} />
            <div className="h-2.5 rounded w-6 animate-pulse" style={block} />
          </div>
          <div className="w-full h-1.5 rounded-full animate-pulse" style={block} />
        </div>
      </div>
    </Card>
  )
}
