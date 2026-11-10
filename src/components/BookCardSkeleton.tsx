// Esqueleto do card de livro: capa 2:3 e duas linhas de texto, igual ao card da biblioteca.
const block = { backgroundColor: 'var(--theme-bg-secondary)' }

export function BookCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="w-full aspect-[2/3] rounded-lg animate-pulse" style={block} />
      <div className="mt-3 space-y-1.5">
        <div className="h-3.5 rounded animate-pulse w-[85%]" style={block} />
        <div className="h-3 rounded animate-pulse w-[55%]" style={block} />
      </div>
    </div>
  )
}
