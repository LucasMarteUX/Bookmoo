// "De acordo com seu gosto" na Home: livros da galeria pelos gostos da pessoa (questionário + o que já lê), no nível dela.
// Some sozinha se ela não marcou gostos e ainda não tem livros da galeria, ou se não há pelo menos 3 sugestões.
import { useEffect, useMemo, useState } from 'react'
import { levelName } from '@/lib/cefr'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { BookCard } from '@/components/book/BookCard'
import { cachedThumbs, categoryName, listCatalogLite, loadCoverThumbs, type CatalogBook } from '@/lib/catalog'
import { tasteBooks, useSurveyTopics } from '@/lib/tastes'
import { useStudyLevel } from '@/hooks/useStudyLevel'
import { useBookStore } from '@/store/useBookStore'
import { useAuth } from '@/contexts/AuthContext'
import { canOpenCatalog, useEntitlements } from '@/store/useEntitlements'

export function TasteShelf({ pt }: { pt: boolean }) {
  const { user } = useAuth()
  const ent = useEntitlements(s => s.data)
  const topics = useSurveyTopics(user?.id)
  const level = useStudyLevel().id
  const myBooks = useBookStore(s => s.books)
  const [catalog, setCatalog] = useState<CatalogBook[] | null>(null)
  const [thumbs, setThumbs] = useState<Record<string, string>>(() => cachedThumbs())
  useEffect(() => { void listCatalogLite().then(setCatalog).catch(() => setCatalog([])) }, [])
  const books = useMemo(() => tasteBooks({
    catalog: catalog ?? [], topics, level, birthDate: user?.user_metadata?.birth_date as string | undefined, limit: 10,
    ownedCatalogIds: new Set(myBooks.map(b => b.catalogId).filter((x): x is string => !!x)),
  }), [catalog, topics, level, myBooks, user?.user_metadata?.birth_date])
  useEffect(() => {
    const missing = books.map(b => b.id).filter(id => !thumbs[id])
    if (missing.length) void loadCoverThumbs(missing).then(found => setThumbs(prev => ({ ...prev, ...found }))).catch(() => {})
  }, [books]) // eslint-disable-line react-hooks/exhaustive-deps

  if (books.length < 3) return null
  return (
    <section aria-label={pt ? 'De acordo com seu gosto' : 'Picked for your taste'}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[22px] md:text-[24px] leading-tight" style={{ color: 'var(--theme-text)' }}>{pt ? 'De acordo com seu gosto' : 'Picked for your taste'}</h2>
          <p className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? `Pelo que você gosta de ler, no nível ${levelName(level, true)}` : `From what you like to read, at the ${levelName(level, false)} level`}</p>
        </div>
        <Link to="/gallery" className="shrink-0 inline-flex items-center gap-1 text-[13px] font-medium" style={{ color: 'var(--theme-text)' }}>{pt ? 'Galeria' : 'Gallery'}<ArrowRight className="w-3.5 h-3.5" /></Link>
      </div>
      <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x pb-1">
        {books.map(b => (
          <BookCard key={b.id} to={`/gallery/${b.id}`} premium={!canOpenCatalog(ent, b.id)} title={b.title} subtitle={b.author || categoryName(b.category, pt)}
            coverData={thumbs[b.id]} coverPending={!thumbs[b.id]} ageMin={b.ageMin} ageInfo={b.ageInfo} level={b.level} pt={pt}
            className="w-[124px] md:w-[148px] shrink-0 snap-start" />
        ))}
      </div>
    </section>
  )
}
