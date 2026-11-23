import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { BookOpen, ChevronDown, ChevronLeft, ImageIcon, Palette, Plus, ShieldCheck, Trash2, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { askConfirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/toast'
import { BookCover } from '@/components/book/BookCard'
import { AgeBadge } from '@/components/book/AgeBadge'
import { BookReviews } from '@/components/community/BookReviews'
import { RatingStars } from '@/components/community/social-ui'
import { AnimatedValue, GrowBar } from '@/components/ui/animated'
import { loadCatalogSocial, type CatalogSocial } from '@/lib/social'
import { StyleCard, useStyleBank } from '@/components/book/StylePicker'
import { bookStyleKey, catalogStyleOptions, LEGACY_STYLE } from '@/lib/comicStyles'
import { GalleryList } from '@/pages/GalleryList'
import { LevelBadge } from '@/components/ui/level-badge'
import { useBookStore } from '@/store/useBookStore'
import { useLanguage } from '@/store/useLanguage'
import { CEFR, type CefrId } from '@/lib/cefr'
import { parseEpub } from '@/lib/epub'
import { countWords } from '@/lib/utils'
import { upsertBook } from '@/lib/supabaseSync'
import { supabase } from '@/lib/supabase'
import { Crown, Gift } from 'lucide-react'
import { useEntitlements } from '@/store/useEntitlements'
import { openPaywall } from '@/components/billing/Paywall'
import {
  addCatalogBook, addFeedback, bookCategories, deleteCatalogBook, sortedCategories, categoryName, getCatalogBook, listFeedback, listVersions, rateVersion, saveBookLink, updateCatalogMeta,
  type BookCategory, type BookFeedback, type CatalogBook, type CatalogVersion,
} from '@/lib/catalog'

export function Gallery() {
  const { id } = useParams()
  return id ? <GalleryBook id={id} /> : <GalleryList />
}

function GalleryBook({ id }: { id: string }) {
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const navigate = useNavigate()
  const gallerySearch = (useLocation().state as { gallerySearch?: string } | null)?.gallerySearch
  const { user, session, hasSupabase, isAdmin } = useAuth()
  const addBook = useBookStore(s => s.addBook)
  const books = useBookStore(s => s.books)
  const [book, setBook] = useState<CatalogBook | null | undefined>(undefined)
  const [versions, setVersions] = useState<CatalogVersion[]>([])
  const [feedback, setFeedback] = useState<BookFeedback[]>([])
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [draftLevel, setDraftLevel] = useState<CefrId | ''>('')
  const [draftCategory, setDraftCategory] = useState<BookCategory | ''>('')
  const [metaNote, setMetaNote] = useState('')
  const [styleOptions, setStyleOptions] = useState<{ styleId: string; pages: number; isDefault: boolean }[]>([])
  const [chosenStyle, setChosenStyle] = useState<string | null>(null)
  const [styleOpen, setStyleOpen] = useState(false)
  const bank = useStyleBank(pt)
  const ent = useEntitlements(s => s.data)
  const reloadEnt = useEntitlements(s => s.load)
  const giftMode = new URLSearchParams(useLocation().search).get('presente') === '1'
  const [giftAsk, setGiftAsk] = useState(false)
  const [social, setSocial] = useState<CatalogSocial[string] | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const reduce = useReducedMotion()

  const reload = () => {
    void getCatalogBook(id).then(setBook)
    void listVersions(id, user?.id).then(setVersions)
    void listFeedback(id).then(setFeedback)
  }
  useEffect(() => { reload() }, [id, user?.id])
  useEffect(() => { setAboutOpen(false); void loadCatalogSocial().then(all => setSocial(all[id] ?? null)) }, [id])
  // Estilos que este livro já tem na galeria. O padrão vem marcado.
  useEffect(() => {
    void catalogStyleOptions(id).then(options => {
      setStyleOptions(options)
      setChosenStyle(options.find(option => option.isDefault)?.styleId ?? options[0]?.styleId ?? null)
    })
  }, [id])
  useEffect(() => {
    if (!book) return
    setDraftLevel(book.level ?? '')
    setDraftCategory(book.category ?? '')
  }, [book])

  const owned = books.find(item => item.catalogId === id)
  const setCurrentBook = useBookStore(s => s.setCurrentBook)
  const defaultStyleId = styleOptions.find(option => option.isDefault)?.styleId ?? chosenStyle
  const defaultStyle = defaultStyleId && defaultStyleId !== LEGACY_STYLE ? bank?.find(item => item.id === defaultStyleId) : undefined
  const defaultOption = styleOptions.find(option => option.styleId === defaultStyleId)

  // Livro travado: no Grátis sem presente escolhido, oferece o presente; senão, o convite de assinatura.
  const canGift = !!ent && ent.plan === 'free' && !ent.gift
  const unlock = () => { if (canGift) setGiftAsk(true); else openPaywall('book') }

  const redeemGift = async () => {
    if (!supabase || !book) return
    setBusy(true)
    const { error } = await supabase.rpc('redeem_gift', { p_catalog: id })
    if (error) {
      setBusy(false)
      setGiftAsk(false)
      toast(pt ? 'Não foi possível escolher este livro' : 'Could not choose this book', {
        tone: 'error', detail: /age_restricted/.test(error.message) ? (pt ? 'Este livro não é indicado para a sua idade.' : 'This book is not suitable for your age.') : /gift_already_used/.test(error.message) ? (pt ? 'Você já usou o seu livro-presente.' : 'You already used your gift book.') : undefined,
      })
      return
    }
    await reloadEnt()
    const full = await getCatalogBook(id)
    setGiftAsk(false)
    if (full && !full.locked) { setBook(full); await pull(full) } else setBusy(false)
    toast(pt ? 'Presente escolhido. O livro é seu.' : 'Gift chosen. The book is yours.')
  }

  const pull = async (source: CatalogBook | null | undefined = book) => {
    if (!source || !user) return
    if (source.locked) { unlock(); return }
    setBusy(true)
    const created = addBook(source.title, source.pages.join('\n\n'), {
      author: source.author, description: source.description, languageCode: source.languageCode, coverData: source.coverData, pages: source.pages, cefrLevel: source.level,
    })
    // Sem escolha, o estilo sai do tipo do livro na primeira geração.
    useBookStore.getState().updateBook(created.id, { catalogId: id, imageMode: 'shared', source: 'catalog', ...(chosenStyle ? { comicStyleDoc: { styleId: chosenStyle } } : {}) })
    if (hasSupabase && supabase && session?.user) {
      await upsertBook(supabase, session.user.id, useBookStore.getState().books.find(item => item.id === created.id)!).catch(() => {})
      await saveBookLink({ bookId: created.id, catalogId: id, imageMode: 'shared', styleId: chosenStyle ?? undefined }, user.id)
    }
    setBusy(false)
    navigate(`/book/${created.id}`)
  }

  const adopt = async (version: CatalogVersion) => {
    if (!owned || !user) { setNotice(pt ? 'Leve o livro para a sua estante antes.' : 'Add the book to your shelf first.'); return }
    const images: Record<number, string> = {}
    for (const [page, url] of Object.entries(version.images)) images[Number(page)] = url
    useBookStore.getState().updateBook(owned.id, { imageMode: 'personal', comicPages: images })
    await saveBookLink({ bookId: owned.id, catalogId: id, imageMode: 'personal' }, user.id)
    if (hasSupabase && supabase) {
      const latest = useBookStore.getState().books.find(item => item.id === owned.id)
      if (latest) await upsertBook(supabase, user.id, latest).catch(() => {})
    }
    setNotice(pt ? 'Esta versão ficou só na sua estante. A galeria continua igual para os outros.' : 'This version is only on your shelf. The gallery stays the same for everyone.')
  }

  if (book === undefined) return <BookSkeleton />
  if (!book) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <img src="/illustrations/reading.svg" alt="" className="illo w-40 mx-auto" />
        <p className="mt-4 font-display text-[24px]">{pt ? 'Este livro não está na galeria.' : 'This book is not in the gallery.'}</p>
        <Link to="/gallery" className="mt-4 inline-flex h-10 px-4 items-center rounded-lg border text-[13.5px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Voltar para a Galeria' : 'Back to the Gallery'}</Link>
      </div>
    )
  }

  const band = CEFR.find(item => item.id === book.level)
  const words = book.locked ? 0 : countWords(book.pages.join(' '))
  const pageTotal = book.pageCount ?? book.pages.length
  const excerpt = openingLines(book.pages)
  const lang = book.languageCode === 'en' ? (pt ? 'Inglês' : 'English') : book.languageCode.toUpperCase()
  const minutes = words ? Math.max(1, Math.round(words / 150)) : 0
  const readTime = !minutes ? '–' : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, '0')}` : ''}`
  const cats = bookCategories(book)
  const fmt = (value: number) => value.toLocaleString(pt ? 'pt-BR' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const ownedPct = owned && pageTotal ? Math.min(100, Math.max(1, Math.round(((owned.currentPage + 1) / pageTotal) * 100))) : 0
  const longAbout = (book.description?.length ?? 0) > 420
  const backTo = gallerySearch ? `/gallery?${gallerySearch}` : giftMode ? '/gallery?presente=1' : '/gallery'
  const toReviews = () => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const primary = 'w-full sm:w-auto h-12 px-6 rounded-lg text-[15px] font-semibold inline-flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-60'
  const primaryStyle = { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }

  const saveMeta = async () => {
    if (!draftLevel || !draftCategory) { setMetaNote(pt ? 'Escolha o nível e a categoria.' : 'Choose a level and a category.'); return }
    setMetaNote('')
    try {
      await updateCatalogMeta(id, { level: draftLevel, category: draftCategory })
      setMetaNote(pt ? 'Nível e categoria salvos.' : 'Level and category saved.')
      reload()
    } catch {
      setMetaNote(pt ? 'Não salvou. Confira se esta é a conta de admin.' : 'It did not save. Check that this is the admin account.')
    }
  }

  const removeFromGallery = async () => {
    const ok = await askConfirm(pt ? `Remover “${book.title}” da galeria?` : `Remove “${book.title}” from the gallery?`, {
      detail: pt
        ? 'Some para todos: avaliações, imagens compartilhadas, versões e comentários deste livro são apagados. Quem já tem o livro na estante continua com a própria cópia. Não dá para desfazer.'
        : 'It disappears for everyone: reviews, shared images, versions and comments are deleted. Readers keep their own copy. This cannot be undone.',
      confirmLabel: pt ? 'Remover da galeria' : 'Remove from gallery',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteCatalogBook(id)
      toast(pt ? `“${book.title}” saiu da galeria` : `“${book.title}” removed from the gallery`)
      navigate(backTo, { replace: true })
    } catch {
      toast(pt ? 'Não foi possível remover' : 'Could not remove', { tone: 'error', detail: pt ? 'Confira se esta é a conta de admin e tente de novo.' : 'Check this is the admin account and try again.' })
    }
  }

  const facts: { label: string; value: string }[] = [
    { label: pt ? 'Nível' : 'Level', value: book.level ?? '–' },
    { label: pt ? 'Páginas' : 'Pages', value: pageTotal ? pageTotal.toLocaleString(pt ? 'pt-BR' : 'en-US') : '–' },
    { label: pt ? 'Palavras' : 'Words', value: words ? words.toLocaleString(pt ? 'pt-BR' : 'en-US') : '–' },
    { label: pt ? 'Leitura' : 'Reading', value: readTime },
    { label: pt ? 'Idioma' : 'Language', value: lang },
  ]

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <Link to={backTo} className="ui-hover -ml-2 hidden md:inline-flex items-center gap-1 h-8 pl-1 pr-3 rounded-full text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
        <ChevronLeft className="w-4 h-4" />{pt ? 'Galeria' : 'Gallery'}
      </Link>

      {/* Topo: capa, título, nota, selos e a ação principal */}
      <div className="md:mt-4 grid gap-7 sm:gap-10 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] md:grid-cols-[minmax(0,272px)_minmax(0,1fr)] items-start">
        <motion.div initial={reduce ? false : { opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-[62%] max-w-[240px] sm:w-full sm:max-w-none mx-auto sm:mx-0">
          <BookCover title={book.title} coverData={book.coverData} className="rounded-xl shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.08)]" />
        </motion.div>

        <motion.div className="min-w-0" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: reduce ? 0 : 0.08 } } }}>
          {cats.length > 0 && (
            <motion.p variants={rise} className="flex flex-wrap gap-x-2 text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--theme-text-secondary)' }}>
              {cats.map((item, i) => (
                <span key={item} className="inline-flex items-center gap-2">
                  {i > 0 && <span aria-hidden>·</span>}
                  <Link to={`/gallery?cat=${item}`} className="hover:underline underline-offset-4">{categoryName(item, pt)}</Link>
                </span>
              ))}
            </motion.p>
          )}
          <motion.h1 variants={rise} className="mt-2 font-display text-[34px] sm:text-[42px] md:text-[48px] leading-[1.02] text-balance">{book.title}</motion.h1>
          {book.author && <motion.p variants={rise} className="mt-2.5 text-[17px]" style={{ color: 'var(--theme-text-secondary)' }}>{book.author}</motion.p>}

          <motion.div variants={rise} className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
            {social?.ratings && social.rating != null ? (
              <button type="button" onClick={toReviews} className="inline-flex items-center gap-2 hover:opacity-80">
                <RatingStars value={social.rating} size={16} />
                <b className="tabular-nums" style={{ color: 'var(--theme-text)' }}>{fmt(social.rating)}</b>
                <span>({social.ratings} {pt ? (social.ratings === 1 ? 'avaliação' : 'avaliações') : (social.ratings === 1 ? 'rating' : 'ratings')})</span>
              </button>
            ) : (
              <button type="button" onClick={toReviews} className="inline-flex items-center gap-2 hover:opacity-80">
                <RatingStars value={0} size={16} /><span>{pt ? 'Seja a primeira avaliação' : 'Be the first to rate'}</span>
              </button>
            )}
            {!!social?.readers && <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{social.readers} {pt ? (social.readers === 1 ? 'leitor' : 'leitores') : (social.readers === 1 ? 'reader' : 'readers')}</span>}
            {!!social?.illustrated && <span className="inline-flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" />{social.illustrated} {pt ? 'páginas ilustradas' : 'illustrated pages'}</span>}
          </motion.div>

          <motion.div variants={rise} className="mt-4 flex flex-wrap items-center gap-2">
            {book.level && <LevelBadge id={book.level} pt={pt} />}
            <AgeBadge ageMin={book.ageMin} info={book.ageInfo} pt={pt} />
            {defaultStyle && (
              <button type="button" onClick={() => setStyleOpen(true)} title={pt ? 'Estilo das ilustrações' : 'Illustration style'}
                className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full text-[12px] font-medium border transition-colors hover:bg-[var(--ui-hover)]"
                style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>
                <Palette className="w-3.5 h-3.5" />{defaultStyle.name}
              </button>
            )}
            {book.locked && (
              <span className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full text-[12px] font-semibold" style={{ backgroundColor: 'var(--pastel-amber-bg)', color: 'var(--pastel-amber-fg)' }}>
                <Crown className="w-3.5 h-3.5" />Premium
              </span>
            )}
          </motion.div>

          <motion.div variants={rise} className="mt-6">
            {owned && book.locked ? (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={unlock} className={primary} style={primaryStyle}><Crown className="w-4 h-4" />{pt ? 'Assinar para continuar lendo' : 'Subscribe to keep reading'}</button>
                <span className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Seu progresso está guardado.' : 'Your progress is saved.'}</span>
              </div>
            ) : owned ? (
              <div className="space-y-3 max-w-md">
                <button type="button" onClick={() => { setCurrentBook(owned.id); navigate(`/book/${owned.id}`) }} className={primary} style={primaryStyle}>
                  <BookOpen className="w-4 h-4" />{owned.currentPage > 0 ? (pt ? 'Continuar a ler' : 'Continue reading') : (pt ? 'Começar a ler' : 'Start reading')}
                </button>
                <div>
                  <div className="flex items-baseline justify-between text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
                    <span>{pt ? 'Na sua estante' : 'On your shelf'}{owned.currentPage > 0 && pageTotal ? ` · ${pt ? 'página' : 'page'} ${owned.currentPage + 1} ${pt ? 'de' : 'of'} ${pageTotal}` : ''}</span>
                    <span className="tabular-nums">{owned.currentPage > 0 ? `${ownedPct}%` : ''}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                    <GrowBar size={owned.currentPage > 0 ? Math.max(2, ownedPct) : 0} delay={0.3} className="h-full rounded-full" style={{ backgroundColor: 'var(--theme-text)' }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" disabled={busy} onClick={() => pull()} className={primary} style={primaryStyle}>
                  {book.locked && canGift ? <><Gift className="w-4 h-4" />{pt ? 'Escolher como meu presente' : 'Choose as my gift'}</>
                    : book.locked ? <><Crown className="w-4 h-4" />{pt ? 'Liberar com a assinatura' : 'Unlock with a subscription'}</>
                    : <><Plus className="w-4 h-4" />{pt ? 'Levar para a minha estante' : 'Add to my shelf'}</>}
                </button>
                {book.locked && canGift && (
                  <button type="button" onClick={() => openPaywall('book')} className="ui-hover h-12 px-4 rounded-lg text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Ou libere todos os livros' : 'Or unlock all books'}</button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* Números do livro */}
      <motion.dl initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
        className="mt-10 grid grid-cols-6 sm:grid-cols-5 gap-px rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-border)' }}>
        {facts.map((fact, i) => (
          <div key={fact.label} className={`px-3 py-3.5 text-center sm:col-span-1 ${i < 3 ? 'col-span-2' : 'col-span-3'}`} style={{ backgroundColor: 'var(--theme-card-bg)' }}>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--theme-text-secondary)' }}>{fact.label}</dt>
            <dd className="mt-1 text-[17px] font-semibold tabular-nums truncate"><AnimatedValue value={fact.value} delay={300 + i * 60} /></dd>
          </div>
        ))}
      </motion.dl>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-14 items-start">
        <div className="min-w-0 space-y-12">
          {book.description && (
            <Reveal>
              <SectionTitle>{pt ? 'Sobre o livro' : 'About the book'}</SectionTitle>
              <p className={`mt-3 text-[16px] leading-[1.7] whitespace-pre-line ${longAbout && !aboutOpen ? 'line-clamp-6' : ''}`}>{book.description}</p>
              {longAbout && (
                <button type="button" onClick={() => setAboutOpen(v => !v)} className="mt-2 inline-flex items-center gap-1 text-[13.5px] font-medium underline underline-offset-4">
                  {aboutOpen ? (pt ? 'Mostrar menos' : 'Show less') : (pt ? 'Ler mais' : 'Read more')}
                </button>
              )}
            </Reveal>
          )}

          {excerpt && (
            <Reveal>
              <SectionTitle>{book.locked ? (pt ? 'Amostra grátis' : 'Free sample') : (pt ? 'Primeiras linhas' : 'Opening lines')}</SectionTitle>
              <blockquote className="mt-4 pl-5 border-l-2 font-display text-[19px] leading-[1.65]" style={{ borderColor: 'var(--theme-text)' }}>
                {excerpt}
              </blockquote>
            </Reveal>
          )}

          <div id="reviews" className="scroll-mt-20">
            <BookReviews catalogId={id} cover={book.coverData} pt={pt} />
          </div>

          {versions.length > 0 && (
            <Reveal>
              <SectionTitle>{pt ? 'Versões da comunidade' : 'Community versions'}</SectionTitle>
              <p className="mt-1.5 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
                {pt ? 'Ilustrações que outros leitores fizeram só para eles e decidiram mostrar. As estrelas ordenam a lista.' : 'Art other readers drew for themselves and chose to share. Stars sort the list.'}
              </p>
              <ul className="mt-4 divide-y rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
                {versions.map(version => (
                  <li key={version.id} className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderColor: 'var(--theme-border)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium truncate">{version.authorName || (pt ? 'Leitor' : 'Reader')}</p>
                      <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
                        {version.stars ? fmt(version.stars) : '–'} ★ · {version.votes} {pt ? 'votos' : 'votes'} · {Object.keys(version.images).length} {pt ? 'páginas' : 'pages'}
                      </p>
                    </div>
                    <div className="flex gap-0.5" role="group" aria-label={pt ? 'Sua nota' : 'Your rating'}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} type="button" aria-label={`${star}`} className="text-[17px] leading-none transition-transform hover:scale-110" style={{ color: (version.mine ?? 0) >= star ? 'var(--pastel-amber-fg)' : 'var(--theme-border)' }}
                          onClick={() => { if (!user) return; void rateVersion(version.id, user.id, star).then(reload) }}>★</button>
                      ))}
                    </div>
                    <button type="button" className="ui-hover h-9 px-3.5 rounded-lg border text-[13px]" style={{ borderColor: 'var(--theme-border)' }} onClick={() => { void adopt(version) }}>
                      {pt ? 'Usar só para mim' : 'Use just for me'}
                    </button>
                  </li>
                ))}
              </ul>
              {notice && <p className="mt-2 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{notice}</p>}
            </Reveal>
          )}

          <Reveal>
            <SectionTitle>{pt ? 'Comentários' : 'Comments'}</SectionTitle>
            <p className="mt-1.5 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Dicas rápidas e impressões sobre a leitura.' : 'Quick tips and impressions about the read.'}</p>
            <form className="mt-4 flex gap-2" onSubmit={e => {
              e.preventDefault()
              if (!user || !comment.trim()) return
              void addFeedback(id, user.id, user.user_metadata?.full_name || user.email?.split('@')[0] || '', comment.trim()).then(() => { setComment(''); reload() })
            }}>
              <input value={comment} onChange={e => setComment(e.target.value)} placeholder={pt ? 'Escreva um comentário' : 'Write a comment'}
                className="flex-1 min-w-0 h-11 rounded-full border px-4 text-[14px] bg-transparent outline-none focus:border-[var(--theme-text-secondary)]" style={{ borderColor: 'var(--theme-border)' }} />
              <button type="submit" disabled={!comment.trim() || !user} className="h-11 px-5 rounded-lg text-[14px] font-medium disabled:opacity-40" style={primaryStyle}>{pt ? 'Enviar' : 'Send'}</button>
            </form>
            {feedback.length > 0 && (
              <ul className="mt-5 space-y-4">
                {feedback.map(item => (
                  <li key={item.id} className="flex gap-3">
                    <span className="w-9 h-9 shrink-0 rounded-full grid place-items-center text-[13px] font-semibold" style={{ backgroundColor: 'var(--pastel-lavender-bg)', color: 'var(--pastel-lavender-fg)' }}>
                      {(item.authorName || '?').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md px-4 py-2.5" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                      <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
                        <b className="font-semibold" style={{ color: 'var(--theme-text)' }}>{item.authorName || (pt ? 'Leitor' : 'Reader')}</b>
                        {item.createdAt && <> · {new Date(item.createdAt).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'short' })}</>}
                      </p>
                      <p className="mt-0.5 text-[14.5px] leading-relaxed">{item.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6">
          {band && (
            <Reveal className="rounded-2xl p-5" style={{ backgroundColor: 'var(--theme-pastel-4)', color: 'var(--theme-pastel-text)' }}>
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em]" style={{ opacity: 0.65 }}>{pt ? 'Para quem é' : 'Who it is for'}</p>
              <p className="mt-1.5 font-display text-[24px] leading-tight">{band.id} · {pt ? band.book.pt : band.book.en}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed" style={{ opacity: 0.85 }}>{pt ? band.can.pt : band.can.en}</p>
              <div className="mt-4 grid grid-cols-6 gap-1" aria-hidden>
                {CEFR.map(item => {
                  const on = item.id === band.id
                  return (
                    <div key={item.id} className="text-center">
                      <div className="h-1.5 rounded-full" style={{ backgroundColor: on ? 'var(--theme-pastel-text)' : 'color-mix(in srgb, var(--theme-pastel-text) 16%, transparent)' }} />
                      <span className="mt-1.5 block text-[10.5px] font-semibold" style={{ opacity: on ? 1 : 0.5 }}>{item.id}</span>
                    </div>
                  )
                })}
              </div>
            </Reveal>
          )}

          <Reveal className="rounded-2xl border p-5" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Detalhes' : 'Details'}</p>
            <dl className="mt-3 space-y-2.5 text-[13.5px]">
              {book.author && <DetailRow label={pt ? 'Autor' : 'Author'} value={book.author} />}
              <DetailRow label={pt ? 'Idioma' : 'Language'} value={lang} />
              {cats.length > 0 && <DetailRow label={pt ? 'Categorias' : 'Categories'} value={cats.map(item => categoryName(item, pt)).join(', ')} />}
              {defaultStyle && <DetailRow label={pt ? 'Ilustrações' : 'Illustrations'} value={defaultStyle.name} />}
              <DetailRow label={pt ? 'Tempo de leitura' : 'Reading time'} value={minutes ? `${pt ? 'cerca de' : 'about'} ${readTime}` : '–'} />
            </dl>
          </Reveal>

          {isAdmin && (
            <details className="group rounded-2xl border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
              <summary className="list-none cursor-pointer flex items-center justify-between gap-3 px-5 py-4">
                <span className="inline-flex items-center gap-2 text-[14px] font-semibold"><ShieldCheck className="w-4 h-4" />{pt ? 'Ferramentas de admin' : 'Admin tools'}</span>
                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" style={{ color: 'var(--theme-text-secondary)' }} />
              </summary>
              <div className="px-5 pb-5 space-y-4">
                <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Só a sua conta vê isto. O nível e a categoria aparecem nos filtros.' : 'Only your account sees this. Level and category show up in the filters.'}</p>
                <div>
                  <p className="text-[12px] font-medium mb-1.5" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Nível' : 'Level'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CEFR.map(item => <FilterChip key={item.id} on={draftLevel === item.id} onClick={() => setDraftLevel(item.id)}>{item.id}</FilterChip>)}
                  </div>
                </div>
                <div>
                  <p className="text-[12px] font-medium mb-1.5" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Categoria principal' : 'Main category'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sortedCategories(pt).map(item => <FilterChip key={item.id} on={draftCategory === item.id} onClick={() => setDraftCategory(item.id)}>{pt ? item.pt : item.en}</FilterChip>)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => { void saveMeta() }} className="h-9 px-4 rounded-lg text-[13.5px] font-medium" style={primaryStyle}>{pt ? 'Salvar' : 'Save'}</button>
                  {metaNote && <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{metaNote}</p>}
                </div>
                <div className="pt-4 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                  <button type="button" onClick={() => { void removeFromGallery() }}
                    className="ui-hover w-full h-9 px-4 rounded-lg border text-[13px] font-medium inline-flex items-center justify-center gap-1.5"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-destructive) 45%, transparent)', color: 'var(--color-destructive)' }}>
                    <Trash2 className="w-4 h-4" />{pt ? 'Remover da galeria' : 'Remove from gallery'}
                  </button>
                </div>
              </div>
            </details>
          )}
        </aside>
      </div>

      <Dialog open={giftAsk} onOpenChange={setGiftAsk}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pt ? 'Este será o seu livro-presente' : 'This will be your gift book'}</DialogTitle>
            <DialogDescription>{pt ? `“${book.title}” fica na sua estante para sempre, mesmo no plano Grátis. A escolha é definitiva e não pode ser trocada.` : `“${book.title}” stays on your shelf forever, even on Free. The choice is final and cannot be changed.`}</DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button type="button" onClick={() => setGiftAsk(false)} className="h-11 px-4 rounded-lg text-[14px] border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Escolher outro' : 'Pick another'}</button>
            <button type="button" disabled={busy} onClick={redeemGift} className="h-11 px-5 rounded-lg text-[14.5px] font-semibold disabled:opacity-60" style={primaryStyle}>{pt ? 'Sim, é este' : 'Yes, this one'}</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={styleOpen} onOpenChange={setStyleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pt ? 'Estilo das ilustrações' : 'Illustration style'}</DialogTitle>
            <DialogDescription>{pt ? 'Estilo padrão deste livro' : 'This book’s default style'}</DialogDescription>
          </DialogHeader>
          {defaultStyle && <StyleCard style={defaultStyle} pt={pt} compact note={defaultOption ? `${defaultOption.pages} ${pt ? (defaultOption.pages === 1 ? 'página pronta' : 'páginas prontas') : 'pages ready'}` : undefined} />}
          <div className="space-y-2.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
            <p>{pt ? 'Este é o estilo padrão do livro e ele não muda aqui. As imagens geradas nele são compartilhadas com a comunidade: quem gera uma página ajuda todos os outros leitores do livro.' : 'This is the book’s default style and it can’t be changed here. Images generated in it are shared with the community: whoever generates a page helps every other reader of the book.'}</p>
            <p>{pt ? 'Quer um estilo próprio? Troque na hora de ler, em direção de arte. Ao trocar, as imagens que você gerou são zeradas e você começa uma coleção só sua, que não é compartilhada com a comunidade.' : 'Want your own style? Change it while reading, in art direction. Switching clears the images you generated and starts a collection that is yours alone, not shared with the community.'}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const rise = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } } }

/** Seção que sobe suavemente quando entra na tela. */
function Reveal({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const reduce = useReducedMotion()
  return (
    <motion.section className={className} style={style} initial={reduce ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.section>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-[24px] leading-tight">{children}</h2>
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt style={{ color: 'var(--theme-text-secondary)' }}>{label}</dt>
      <dd className="text-right font-medium min-w-0">{value}</dd>
    </div>
  )
}

function BookSkeleton() {
  const block = { backgroundColor: 'var(--theme-bg-secondary)' }
  return (
    <div className="max-w-5xl mx-auto animate-pulse" aria-busy>
      <div className="hidden md:block h-8 w-24 rounded-full" style={block} />
      <div className="mt-4 grid gap-10 sm:grid-cols-[240px_1fr] md:grid-cols-[272px_1fr]">
        <div className="aspect-[2/3] w-[62%] max-w-[240px] sm:w-full sm:max-w-none mx-auto rounded-xl" style={block} />
        <div className="space-y-4">
          <div className="h-3 w-40 rounded" style={block} />
          <div className="h-12 w-4/5 rounded-lg" style={block} />
          <div className="h-5 w-48 rounded" style={block} />
          <div className="h-12 w-56 rounded-full mt-8" style={block} />
        </div>
      </div>
    </div>
  )
}

/** Primeiro trecho de texto do livro, pulando licença, créditos e página de rosto. */
function openingLines(pages: string[]): string | undefined {
  const junk = /project gutenberg|gutenberg|e-?book|standard ebooks|imprint|license|licen[cs]e|transcrib|produced by|copyright|public domain|internet archive|\*\*\*|table of contents|^contents$/i
  for (const page of pages.slice(0, 40)) {
    for (const para of page.split(/\n{2,}|\n/)) {
      const text = para.replace(/\s+/g, ' ').trim()
      if (text.length < 140 || junk.test(text)) continue
      if (text.length <= 460) return text
      const cut = text.slice(0, 460)
      const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
      return end > 200 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`
    }
  }
  return undefined
}

export function AdminGalleryForm({ pt, onPublished }: { pt: boolean; onPublished?: () => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState<CefrId>('A1')
  const [category, setCategory] = useState<BookCategory>('classic')
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<Awaited<ReturnType<typeof parseEpub>> | null>(null)
  const [cover, setCover] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [load, setLoad] = useState<{ progress: number; label: string; title?: string; cover?: string } | null>(null)
  const field = 'w-full h-10 rounded-lg border px-3 text-[14px] bg-transparent outline-none'
  const border = { borderColor: 'var(--theme-border)' }

  return (
    <form className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}
      onSubmit={async event => {
        event.preventDefault()
        if (!user || !parsed) return
        setBusy(true)
        setMessage('')
        const coverData = cover || parsed.coverDataUrl
        setLoad({ progress: 0.92, label: pt ? 'Colocando na galeria…' : 'Adding to the gallery…', title: title.trim() || parsed.title, cover: coverData })
        try {
          await addCatalogBook({
            title: title.trim() || parsed.title,
            author: author.trim() || parsed.author,
            description: description.trim() || parsed.description,
            level,
            category,
            languageCode: parsed.language || 'en',
            coverData,
            pages: parsed.pages,
          }, user.id)
          setLoad({ progress: 1, label: pt ? 'Na galeria.' : 'In the gallery.', title: title.trim() || parsed.title, cover: coverData })
          setTitle(''); setAuthor(''); setDescription(''); setLevel('A1'); setCategory('classic'); setParsed(null); setCover(''); setFileName('')
          onPublished?.()
          window.setTimeout(() => setLoad(null), 700)
        } catch {
          setLoad(null)
          setMessage(pt ? 'Não entrou. Confira se você está na conta de admin.' : 'It did not save. Check that this is the admin account.')
        } finally {
          setBusy(false)
        }
      }}>
      {load && (
        <div className="flex items-center gap-4 rounded-xl px-3 py-3" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
          {load.cover
            ? <img src={load.cover} alt="" className="book-cover w-12 aspect-[2/3] rounded-md object-cover" />
            : <img src="/illustrations/reading.svg" alt="" className="illo w-14 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium truncate">{load.title}</p>
            <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{load.label}</p>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-border)' }}>
              <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.round(load.progress * 100)}%`, backgroundColor: 'var(--theme-text)' }} />
            </div>
          </div>
          <span className="text-[13px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{Math.round(load.progress * 100)}%</span>
        </div>
      )}
      <h2 className="text-[15px] font-semibold">{pt ? 'Novo livro gratuito' : 'New free book'}</h2>
      <p className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
        {pt ? 'Só livros que você pode compartilhar. O EPUB de um aluno não usa este caminho.' : 'Only books you are allowed to share. A student’s EPUB does not use this path.'}
      </p>
      <input className={field} style={border} placeholder={pt ? 'Título' : 'Title'} value={title} onChange={e => setTitle(e.target.value)} />
      <input className={field} style={border} placeholder={pt ? 'Autor' : 'Author'} value={author} onChange={e => setAuthor(e.target.value)} />
      <textarea className="w-full rounded-lg border px-3 py-2 text-[14px] bg-transparent outline-none" style={border} rows={3} placeholder={pt ? 'Descrição curta' : 'Short description'} value={description} onChange={e => setDescription(e.target.value)} />
      <div>
        <p className="text-[12.5px] mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Nível do livro' : 'Book level'}</p>
        <div className="grid grid-cols-3 gap-2">
          {CEFR.map(band => {
            const on = level === band.id
            return (
              <button key={band.id} type="button" onClick={() => setLevel(band.id)}
                className="rounded-xl border px-3 py-2 text-left"
                style={{ borderColor: 'var(--theme-border)', backgroundColor: on ? 'var(--theme-pastel-2)' : 'transparent', color: on ? 'var(--theme-pastel-text)' : 'var(--theme-text)' }}>
                <span className="block text-[14px] font-semibold">{band.id}</span>
                <span className="block text-[12px]" style={{ color: on ? 'var(--theme-pastel-text)' : 'var(--theme-text-secondary)' }}>{pt ? band.book.pt : band.book.en}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <p className="text-[12.5px] mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Categoria' : 'Category'}</p>
        <div className="flex flex-wrap gap-1.5">
          {sortedCategories(pt).map(item => (
            <FilterChip key={item.id} on={category === item.id} onClick={() => setCategory(item.id)}>{pt ? item.pt : item.en}</FilterChip>
          ))}
        </div>
      </div>
      <label className="h-10 px-3 inline-flex items-center rounded-lg border text-[13.5px] cursor-pointer" style={border}>
        {fileName || (pt ? 'Escolher EPUB' : 'Choose EPUB')}
        <input type="file" accept=".epub,application/epub+zip" className="sr-only" onChange={async e => {
          const file = e.target.files?.[0]
          e.currentTarget.value = ''
          if (!file) return
          setFileName(file.name)
          setMessage('')
          setLoad({ progress: 0.04, label: pt ? 'Abrindo o arquivo…' : 'Opening the file…', title: file.name.replace(/\.epub$/i, '') })
          try {
            const book = await parseEpub(file, ratio => {
              setLoad({
                progress: ratio,
                label: ratio < 0.96 ? (pt ? 'Lendo as páginas…' : 'Reading the pages…') : (pt ? 'Capa e descrição prontas.' : 'Cover and description are ready.'),
                title: file.name.replace(/\.epub$/i, ''),
              })
            })
            setParsed(book)
            setTitle(book.title)
            setAuthor(book.author ?? '')
            setDescription(book.description ?? '')
            setCover(book.coverDataUrl ?? '')
            setLoad({ progress: 1, label: pt ? 'Pronto para publicar.' : 'Ready to publish.', title: book.title, cover: book.coverDataUrl })
            window.setTimeout(() => setLoad(null), 600)
          } catch (err) {
            setParsed(null)
            setLoad(null)
            setMessage((err as Error).message || (pt ? 'Não foi possível ler este EPUB.' : 'Could not read this EPUB.'))
          }
        }} />
      </label>
      {parsed && (
        <div className="flex items-center gap-3">
          <label className="relative w-14 h-[4.5rem] rounded-lg overflow-hidden shrink-0 cursor-pointer" style={{ backgroundColor: 'var(--theme-pastel-1)' }} title={pt ? 'Trocar capa' : 'Change cover'}>
            {(cover || parsed.coverDataUrl) && <img src={cover || parsed.coverDataUrl} alt="" className="w-full h-full object-cover" />}
            <span className="absolute inset-x-0 bottom-0 py-0.5 text-center text-[10px] font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-card-bg) 88%, transparent)' }}>{pt ? 'Capa' : 'Cover'}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={e => {
              const file = e.target.files?.[0]
              e.currentTarget.value = ''
              if (file) void readCover(file).then(setCover).catch(() => setMessage(pt ? 'Não consegui ler essa imagem.' : 'Could not read that image.'))
            }} />
          </label>
          <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{parsed.pages.length} {pt ? 'páginas' : 'pages'} · {parsed.title}</p>
        </div>
      )}
      <button type="submit" disabled={busy || !parsed} className="h-10 px-4 rounded-lg text-[14px] font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
        {busy ? (pt ? 'Publicando…' : 'Publishing…') : (pt ? 'Publicar na galeria' : 'Publish to the gallery')}
      </button>
      {message && <p className="text-[13px]">{message}</p>}
    </form>
  )
}



function readCover(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const max = 900
        const scale = Math.min(1, max / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('canvas')); return }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.86))
      }
      image.onerror = () => reject(new Error('image'))
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-8 px-3 rounded-full border text-[13px] whitespace-nowrap"
      style={{
        borderColor: on ? 'transparent' : 'var(--theme-border)',
        backgroundColor: on ? 'var(--theme-pastel-2)' : 'var(--theme-card-bg)',
        color: on ? 'var(--theme-pastel-text)' : 'var(--theme-text)',
      }}>
      {children}
    </button>
  )
}
