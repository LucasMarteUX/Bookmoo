// Avaliações e resenhas de um livro da galeria: média, a minha (editar ou apagar) e as visíveis.
// Uma avaliação por pessoa por livro; ao salvar vira publicação na timeline (curtir e comentar).
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/toast'
import { loadProfileView } from '@/lib/communityProfile'
import { deleteReview, errorText, loadBookReviews, REVIEW_MAX, saveReview, type BookReviews as Data, type Review, type ReviewVisibility } from '@/lib/social'
import { PostCard } from './Feed'
import { AudienceSelect, cardStyle, muted, RatingInput, RatingStars } from './social-ui'

const VISIBILITY: ReviewVisibility[] = ['public', 'followers', 'friends', 'private']

export function BookReviews({ catalogId, cover, pt }: { catalogId: string; cover?: string; pt: boolean }) {
  const { user } = useAuth()
  const [data, setData] = useState<Data | null>(null)
  const [hasHandle, setHasHandle] = useState<boolean | null>(null)
  const [editing, setEditing] = useState(false)
  const reload = () => loadBookReviews(catalogId).then(setData)

  useEffect(() => {
    setData(null); setEditing(false)
    void reload()
    void loadProfileView('me').then(me => setHasHandle(!!me?.handle))
  }, [catalogId])

  const covers = { [catalogId]: cover }
  const fmt = (value: number) => value.toLocaleString(pt ? 'pt-BR' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const others = (data?.items ?? []).filter(item => !item.mine)

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">{pt ? 'Avaliações e resenhas' : 'Ratings and reviews'}</h2>
          {data && data.count > 0 && data.average != null && (
            <p className="mt-1.5 flex items-center gap-2 text-[13.5px]" style={muted}>
              <RatingStars value={data.average} size={16} />
              <b className="tabular-nums" style={{ color: 'var(--theme-text)' }}>{fmt(data.average)}</b>
              · {data.count} {pt ? (data.count === 1 ? 'avaliação' : 'avaliações') : (data.count === 1 ? 'rating' : 'ratings')}
            </p>
          )}
        </div>
        {data?.mine && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full border text-[13px]" style={{ borderColor: 'var(--theme-border)' }}>
            <Pencil className="w-3.5 h-3.5" />{pt ? 'Editar minha avaliação' : 'Edit my review'}
          </button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {user && hasHandle === false && (
          <div className="rounded-3xl border p-5 flex flex-wrap items-center justify-between gap-3" style={cardStyle}>
            <p className="text-[14px]" style={muted}>{pt ? 'Crie seu perfil para avaliar e escrever resenhas.' : 'Create your profile to rate and review.'}</p>
            <Link to="/settings#profile" className="h-9 px-4 inline-flex items-center rounded-full text-[13.5px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Criar perfil' : 'Create profile'}</Link>
          </div>
        )}
        {user && hasHandle && data && (!data.mine || editing) && (
          <ReviewEditor catalogId={catalogId} initial={data.mine} pt={pt}
            onSaved={() => { setEditing(false); void reload() }} onCancel={data.mine ? () => setEditing(false) : undefined} />
        )}
        {data?.mine && !editing && (
          <div className="rounded-3xl border p-4 sm:p-5" style={cardStyle}>
            <p className="text-[12.5px]" style={muted}>{pt ? 'Sua avaliação' : 'Your review'}{data.mine.visibility === 'private' ? (pt ? ' · só você vê' : ' · only you') : ''}</p>
            <div className="mt-1.5"><RatingStars value={data.mine.rating} size={18} /></div>
            {data.mine.title && <p className="mt-2 font-display text-[20px] leading-snug">{data.mine.title}</p>}
            {data.mine.body && <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-line">{data.mine.body}</p>}
          </div>
        )}

        {data === null
          ? <div className="h-32 rounded-3xl animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
          : others.length === 0
            ? (!data.mine && <EmptyState illustration="reading" title={pt ? 'Ninguém avaliou este livro ainda. Seja a primeira pessoa.' : 'No reviews yet. Be the first.'} />)
            : others.map(item => <PostCard key={item.id} item={item} covers={covers} pt={pt} canPost={!!hasHandle} onDeleted={() => { void reload() }} />)}
      </div>
    </section>
  )
}

function ReviewEditor({ catalogId, initial, pt, onSaved, onCancel }: { catalogId: string; initial: Review | null; pt: boolean; onSaved: () => void; onCancel?: () => void }) {
  const { user } = useAuth()
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [spoiler, setSpoiler] = useState(initial?.spoiler ?? false)
  const [visibility, setVisibility] = useState<ReviewVisibility>(initial?.visibility ?? 'public')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!user || !rating) return
    setBusy(true)
    try {
      await saveReview(user.id, catalogId, { rating, title, body, spoiler, visibility })
      toast(pt ? 'Avaliação salva.' : 'Review saved.', { tone: 'success' })
      onSaved()
    } catch (err) { toast(errorText(err, pt), { tone: 'error' }) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!initial || !window.confirm(pt ? 'Apagar sua avaliação e resenha? As curtidas e comentários dela também somem.' : 'Delete your review? Its likes and comments go too.')) return
    try { await deleteReview(initial.id); onSaved() } catch (err) { toast(errorText(err, pt), { tone: 'error' }) }
  }

  return (
    <div className="rounded-3xl border p-4 sm:p-5 space-y-3" style={cardStyle}>
      <p className="text-[14px] font-medium">{initial ? (pt ? 'Editar avaliação' : 'Edit review') : (pt ? 'O que achou deste livro?' : 'What did you think of this book?')}</p>
      <RatingInput value={rating} onChange={setRating} pt={pt} />
      <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder={pt ? 'Título (opcional)' : 'Title (optional)'}
        className="w-full h-10 rounded-xl border px-3 text-[14px] bg-transparent outline-none" style={{ borderColor: 'var(--theme-border)' }} />
      <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={REVIEW_MAX} rows={4} placeholder={pt ? 'Sua resenha (opcional)' : 'Your review (optional)'}
        className="w-full rounded-xl border px-3 py-2 text-[14.5px] leading-relaxed bg-transparent outline-none resize-y" style={{ borderColor: 'var(--theme-border)' }} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-[13px] cursor-pointer">
          <input type="checkbox" checked={spoiler} onChange={e => setSpoiler(e.target.checked)} />{pt ? 'Contém spoiler' : 'Contains spoilers'}
        </label>
        <AudienceSelect<ReviewVisibility> value={visibility} onChange={setVisibility} options={VISIBILITY} pt={pt} />
        <span className="flex-1" />
        {initial && <button type="button" onClick={() => { void remove() }} aria-label={pt ? 'Apagar avaliação' : 'Delete review'} className="h-9 w-9 grid place-items-center rounded-full border" style={{ borderColor: 'var(--theme-border)', color: 'var(--color-destructive)' }}><Trash2 className="w-4 h-4" /></button>}
        {onCancel && <button type="button" onClick={onCancel} className="h-9 px-3.5 rounded-full border text-[13px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Cancelar' : 'Cancel'}</button>}
        <button type="button" disabled={!rating || busy} onClick={() => { void save() }} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-full text-[13.5px] font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}{pt ? 'Salvar avaliação' : 'Save review'}
        </button>
      </div>
      {!rating && <p className="text-[12px]" style={muted}>{pt ? 'Escolha de meia a cinco estrelas.' : 'Pick half a star to five stars.'}</p>}
    </div>
  )
}
