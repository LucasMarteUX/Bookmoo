// Exemplos em imagem (feitos pela comunidade): uma ilustração em 4 quadros (2×2) com usos da palavra.
// Se alguém já gerou, aparece direto (sem gastar API); gerar uma nova dá pontos, porque fica
// disponível para toda a comunidade do Bookmoo.
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Heart, Loader2, Sparkles, Users, X } from 'lucide-react'
import { AiRequestError } from '@/lib/ai'
import { fetchMyStars, fetchSharedVocab, generateSharedImages, setStar, signImageUrls, sortImages, type SharedImage } from '@/lib/vocabShared'
import { XP, useXpStore } from '@/store/useXpStore'

export function CommunityMosaic({ text, lang, pt, onCount }: { text: string; lang: string; pt: boolean; onCount?: (n: number) => void }) {
  const [images, setImages] = useState<SharedImage[]>([])
  const [selected, setSelected] = useState(0)
  const [mine, setMine] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [open, setOpen] = useState(false)
  const term = text.trim()

  useEffect(() => {
    setImages([]); setSelected(0); setMessage(null); setOpen(false)
    if (!term || term.length > 120) return
    let alive = true
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const shared = await fetchSharedVocab(term, lang, pt ? 'pt' : 'en')
        const signed = await signImageUrls(sortImages(shared.images))
        if (!alive) return
        setImages(signed)
        setMine(await fetchMyStars(signed.map(i => i.id)))
      } catch { /* sem conexão: só não mostra */ } finally { if (alive) setLoading(false) }
    }, 350)
    return () => { alive = false; clearTimeout(t) }
  }, [term, lang, pt])
  useEffect(() => { onCount?.(images.length) }, [images.length, onCount])

  const generate = async () => {
    setGenerating(true); setMessage(null)
    try {
      const { images: created, capped } = await generateSharedImages(term, lang)
      if (capped || !created.length) {
        setMessage({ tone: 'ok', text: pt ? 'Esta palavra já tem o máximo de imagens da comunidade. Curta a sua favorita!' : 'This word already has the maximum community images. Like your favourite!' })
        return
      }
      const signed = await signImageUrls(created)
      setImages(prev => [...signed, ...prev])
      setSelected(0)
      let points = 0
      for (const img of created) if (useXpStore.getState().award(`community:${img.id}`, XP.communityImage)) points += XP.communityImage
      setMessage({ tone: 'ok', text: pt
        ? `Obrigado! Sua imagem agora ajuda toda a comunidade. +${points} pontos`
        : `Thank you! Your image now helps the whole community. +${points} points` })
    } catch (e) {
      const code = e instanceof AiRequestError ? e.code : ''
      setMessage({ tone: 'error', text: code === 'no_api_key'
        ? (pt ? 'Conecte sua chave da OpenAI ou do Gemini em Configurações para criar imagens.' : 'Connect your OpenAI or Gemini key in Settings to create images.')
        : code === 'daily_limit'
          ? (pt ? 'Você atingiu o limite de imagens de hoje. Volte amanhã!' : 'You reached today’s image limit. Come back tomorrow!')
          : (pt ? 'Não foi possível criar a imagem agora. Tente de novo.' : 'Could not create the image right now. Try again.') })
    } finally { setGenerating(false) }
  }

  const toggleStar = async (img: SharedImage) => {
    const on = !mine.has(img.id)
    setMine(prev => { const next = new Set(prev); if (on) next.add(img.id); else next.delete(img.id); return next })
    setImages(prev => prev.map(i => i.id === img.id ? { ...i, stars: i.stars + (on ? 1 : -1) } : i))
    try { await setStar(img.id, on) } catch { /* mantém otimista */ }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'ArrowRight') setSelected(i => Math.min(images.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setSelected(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, images.length])

  const current = images[selected]
  const createLabel = pt ? 'Criar exemplos em imagem' : 'Create image examples'

  return (
    <div className="space-y-4">
      {message && (
        <p role="status" className="rounded-lg px-3 py-2 text-[13px]"
          style={{ backgroundColor: message.tone === 'ok' ? 'var(--pastel-green-bg)' : 'var(--pastel-rose-bg)', color: message.tone === 'ok' ? 'var(--pastel-green-fg)' : 'var(--pastel-rose-fg)' }}>
          {message.text}
        </p>
      )}

      {generating ? (
        <div className="grid sm:grid-cols-[minmax(0,320px)_1fr] gap-5 items-center">
          <div className="grid grid-cols-2 gap-1.5 aspect-square rounded-xl overflow-hidden">
            {[0, 1, 2, 3].map(i => <div key={i} className="animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)', animationDelay: `${i * 150}ms` }} />)}
          </div>
          <div>
            <p className="flex items-center gap-2 text-[15px] font-medium"><Loader2 className="w-4 h-4 animate-spin" />{pt ? 'Desenhando 4 cenas…' : 'Drawing 4 scenes…'}</p>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
              {pt ? `Cada quadro mostra “${term}” numa situação real. Leva cerca de 30 segundos.` : `Each panel shows “${term}” in a real situation. Takes about 30 seconds.`}
            </p>
          </div>
        </div>
      ) : loading && !images.length ? (
        <div className="aspect-square w-full max-w-[320px] rounded-xl animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
      ) : current ? (
        <div className="grid sm:grid-cols-[minmax(0,340px)_1fr] gap-5">
          <div className="relative">
            {current.url
              ? <button type="button" onClick={() => setOpen(true)} className="block w-full rounded-xl" title={pt ? 'Ver em tela cheia' : 'View full screen'}>
                  <img src={current.url} alt={pt ? `Exemplos em imagem de “${term}”` : `Image examples for “${term}”`} className="w-full aspect-square object-cover rounded-xl border" style={{ borderColor: 'var(--theme-border)' }} />
                </button>
              : <div className="w-full aspect-square rounded-xl" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />}
            <button type="button" onClick={() => toggleStar(current)} aria-pressed={mine.has(current.id)}
              className="absolute right-2 top-2 inline-flex items-center gap-1 h-7 rounded-full px-2.5 text-[12px] font-medium backdrop-blur"
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#191919', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}
              title={pt ? 'Curtir: as favoritas aparecem primeiro para todos' : 'Like: favourites show first for everyone'}>
              <Heart className="w-3.5 h-3.5" fill={mine.has(current.id) ? 'var(--pastel-rose-fg)' : 'none'} stroke={mine.has(current.id) ? 'var(--pastel-rose-fg)' : 'currentColor'} /> {current.stars}
            </button>
          </div>
          <div className="flex flex-col gap-3 min-w-0">
            <p className="text-[13px] flex items-center gap-1.5" style={{ color: 'var(--theme-text-secondary)' }}>
              <Users className="w-3.5 h-3.5" />{pt ? `${images.length} ${images.length === 1 ? 'imagem' : 'imagens'} da comunidade` : `${images.length} community ${images.length === 1 ? 'image' : 'images'}`}
            </p>
            {images.length > 1 && (
              <div className="flex gap-1.5 flex-wrap">
                {images.slice(0, 12).map((img, i) => (
                  <button key={img.id} type="button" onClick={() => setSelected(i)} aria-label={`${i + 1}`}
                    className={`w-12 h-12 rounded-md overflow-hidden border transition-opacity ${i === selected ? '' : 'opacity-55 hover:opacity-100'}`}
                    style={{ borderColor: i === selected ? 'var(--theme-text)' : 'var(--theme-border)' }}>
                    {img.url && <img src={img.url} alt="" className="w-full h-full object-cover" />}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={generate} disabled={!term}
              className="mt-auto self-start h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border text-[13px] font-medium transition-colors hover:bg-[var(--ui-hover)] disabled:opacity-50"
              style={{ borderColor: 'var(--theme-border)' }}>
              <Sparkles className="w-3.5 h-3.5" />{pt ? 'Criar outra versão' : 'Create another version'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed px-6 py-8 flex flex-col items-center text-center" style={{ borderColor: 'var(--theme-border)' }}>
          <img src="/illustrations/high-five.svg" alt="" className="illo w-32 mb-4" />
          <p className="text-[15px] font-medium">{pt ? 'Veja a palavra em ação' : 'See the word in action'}</p>
          <p className="mt-1 max-w-sm text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? '4 cenas ilustradas com usos reais. Fica disponível para toda a comunidade.' : '4 illustrated scenes with real uses. Shared with the whole community.'}
          </p>
          <button type="button" onClick={generate} disabled={!term}
            className="mt-4 h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg text-[13.5px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            <Sparkles className="w-4 h-4" />{createLabel}
          </button>
          <p className="mt-2 text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}>+{XP.communityImage} {pt ? 'pontos' : 'points'}</p>
        </div>
      )}

      {open && current?.url && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.82)' }} onClick={() => setOpen(false)}>
          <button type="button" onClick={() => setOpen(false)} aria-label={pt ? 'Fechar' : 'Close'}
            className="absolute top-4 right-4 w-10 h-10 grid place-items-center rounded-full text-white" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
            <X className="w-5 h-5" />
          </button>
          {selected > 0 && (
            <button type="button" aria-label={pt ? 'Anterior' : 'Previous'} onClick={(e) => { e.stopPropagation(); setSelected(i => i - 1) }}
              className="absolute left-3 sm:left-6 w-11 h-11 grid place-items-center rounded-full text-white" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <img src={current.url} alt="" onClick={(e) => e.stopPropagation()} className="max-h-[88vh] max-w-[92vw] object-contain rounded-xl" />
          {selected < images.length - 1 && (
            <button type="button" aria-label={pt ? 'Próxima' : 'Next'} onClick={(e) => { e.stopPropagation(); setSelected(i => i + 1) }}
              className="absolute right-3 sm:right-6 w-11 h-11 grid place-items-center rounded-full text-white" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
          {images.length > 1 && (
            <p className="absolute bottom-4 text-white/80 text-[13px]">{selected + 1} / {images.length}</p>
          )}
        </div>
      )}
    </div>
  )
}
