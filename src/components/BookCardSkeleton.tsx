import { Card } from '@/components/ui/card'

/**
 * Skeleton do card de livro: mesmo tamanho e layout do card real,
 * com blocos/sombras indicando onde ficam imagem, título, autor e texto.
 */
export function BookCardSkeleton() {
  return (
    <Card
      className="p-0 rounded-[16px] border overflow-hidden"
      style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
    >
      {/* Área da capa (imagem) */}
      <div
        className="w-full aspect-[3/4] rounded-t-[16px] animate-pulse"
        style={{ backgroundColor: 'var(--theme-border-subtle)' }}
      />
      <div className="p-4 md:p-5 flex flex-col">
        <div className="flex items-start gap-2 mb-2">
          {/* Ícone/bandeira */}
          <div
            className="w-8 h-8 rounded-full shrink-0 animate-pulse"
            style={{ backgroundColor: 'var(--theme-border-subtle)' }}
          />
          <div className="min-w-0 flex-1 space-y-2">
            {/* Título (2 linhas) */}
            <div className="space-y-1">
              <div
                className="h-5 rounded-md animate-pulse max-w-[85%]"
                style={{ backgroundColor: 'var(--theme-border-subtle)' }}
              />
              <div
                className="h-5 rounded-md animate-pulse max-w-[60%]"
                style={{ backgroundColor: 'var(--theme-border-subtle)' }}
              />
            </div>
            {/* Autor e idioma */}
            <div
              className="h-3 rounded w-24 animate-pulse"
              style={{ backgroundColor: 'var(--theme-border-subtle)' }}
            />
            <div
              className="h-3 rounded w-16 animate-pulse"
              style={{ backgroundColor: 'var(--theme-border-subtle)' }}
            />
          </div>
        </div>
        {/* Descrição (2 linhas) */}
        <div className="space-y-1 mb-2">
          <div
            className="h-3 rounded animate-pulse w-full"
            style={{ backgroundColor: 'var(--theme-border-subtle)' }}
          />
          <div
            className="h-3 rounded animate-pulse max-w-[80%]"
            style={{ backgroundColor: 'var(--theme-border-subtle)' }}
          />
        </div>
        {/* Palavras / data */}
        <div
          className="h-3 rounded w-32 mb-4 animate-pulse"
          style={{ backgroundColor: 'var(--theme-border-subtle)' }}
        />
        {/* Barra de progresso */}
        <div className="mt-auto space-y-2 pt-3 border-t" style={{ borderColor: 'var(--theme-border-subtle)' }}>
          <div className="flex justify-between items-center">
            <div
              className="h-3 rounded w-16 animate-pulse"
              style={{ backgroundColor: 'var(--theme-border-subtle)' }}
            />
            <div
              className="h-4 rounded w-8 animate-pulse"
              style={{ backgroundColor: 'var(--theme-border-subtle)' }}
            />
          </div>
          <div
            className="w-full h-2 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--theme-border-subtle)' }}
          />
        </div>
      </div>
    </Card>
  )
}
