// Mosaico da comunidade no modal de explicação: uma imagem em tirinha de HQ (2×2) com usos da
// palavra. Se alguém já gerou, aparece direto (sem gastar API); gerar um novo dá pontos, porque
// fica disponível para toda a comunidade do Bookmoo.
import { useEffect, useState } from 'react'
import { Heart, Images, Loader2, Sparkles, Users } from 'lucide-react'
import { AiRequestError } from '@/lib/ai'
import { fetchMyStars, fetchSharedVocab, generateSharedImages, setStar, signImageUrls, sortImages, type SharedImage } from '@/lib/vocabShared'
import { XP, useXpStore } from '@/store/useXpStore'

export function CommunityMosaic({ text, lang, pt }: { text: string; lang: string; pt: boolean }) {
  const [images, setImages] = useState<SharedImage[]>([])
  const [selected, setSelected] = useState(0)
  const [mine, setMine] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const term = text.trim()

  useEffect(() => {
    setImages([]); setSelected(0); setMessage(null)
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

  const generate = async () => {
    setGenerating(true); setMessage(null)
    try {
      const { images: created, capped } = await generateSharedImages(term, lang)
      if (capped || !created.length) {
        setMessage({ tone: 'ok', text: pt ? 'Esta palavra já tem o máximo de mosaicos da comunidade. Escolha o seu favorito!' : 'This word already has the maximum community mosaics. Pick your favourite!' })
        return
      }
      const signed = await signImageUrls(created)
      setImages(prev => [...signed, ...prev])
      setSelected(0)
      let points = 0
      for (const img of created) if (useXpStore.getState().award(`community:${img.id}`, XP.communityImage)) points += XP.communityImage
      setMessage({ tone: 'ok', text: pt
        ? `Obrigado! Toda imagem que você gera ajuda a comunidade do Bookmoo. ⭐ +${points} pontos`
        : `Thank you! Every image you create helps the Bookmoo community. ⭐ +${points} points` })
    } catch (e) {
      const code = e instanceof AiRequestError ? e.code : ''
      setMessage({ tone: 'error', text: code === 'no_api_key'
        ? (pt ? 'Conecte sua chave da OpenAI ou do Gemini em Configurações para gerar mosaicos.' : 'Connect your OpenAI or Gemini key in Settings to create mosaics.')
        : code === 'daily_limit'
          ? (pt ? 'Você atingiu o limite de imagens de hoje. Volte amanhã!' : 'You reached today’s image limit. Come back tomorrow!')
          : (pt ? 'Não foi possível gerar o mosaico agora. Tente de novo.' : 'Could not create the mosaic right now. Try again.') })
    } finally { setGenerating(false) }
  }

  const toggleStar = async (img: SharedImage) => {
    const on = !mine.has(img.id)
    setMine(prev => { const next = new Set(prev); if (on) next.add(img.id); else next.delete(img.id); return next })
    setImages(prev => prev.map(i => i.id === img.id ? { ...i, stars: i.stars + (on ? 1 : -1) } : i))
    try { await setStar(img.id, on) } catch { /* mantém otimista */ }
  }

  const current = images[selected]
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
            <Images className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} /> {pt ? 'Mosaico da palavra' : 'Word mosaic'}
          </p>
          <p className="mt-1 text-xs flex items-center gap-1" style={{ color: 'var(--theme-text-secondary)' }}>
            <Users className="h-3 w-3" /> {pt ? 'Quatro situações de uso, em HQ. Feito pela comunidade.' : 'Four real-life uses, comic style. Made by the community.'}
          </p>
        </div>
        <button type="button" onClick={generate} disabled={generating || !term}
          className="btn-3d btn-3d--explain text-xs disabled:opacity-50">
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={2.5} />}
          {generating ? (pt ? 'Desenhando…' : 'Drawing…') : images.length ? (pt ? 'Gerar outro' : 'Create another') : (pt ? 'Gerar mosaico' : 'Create mosaic')}
        </button>
      </div>

      {message && (
        <p role="status" className="mt-3 rounded-xl px-3 py-2 text-xs"
          style={{ backgroundColor: message.tone === 'ok' ? 'color-mix(in srgb, #FFC83D 16%, transparent)' : 'color-mix(in srgb, #F0524F 14%, transparent)', color: 'var(--theme-text)' }}>
          {message.text}
        </p>
      )}

      {loading && !images.length ? (
        <div className="mt-3 aspect-square w-full max-w-[320px] mx-auto rounded-xl animate-pulse" style={{ backgroundColor: 'var(--theme-border-subtle)' }} />
      ) : current ? (
        <div className="mt-3 space-y-2">
          <div className="relative mx-auto w-full max-w-[360px]">
            {current.url
              ? <img src={current.url} alt={pt ? `Mosaico de “${term}”` : `Mosaic for “${term}”`} className="w-full aspect-square object-cover rounded-xl border-2" style={{ borderColor: '#1d1a16' }} />
              : <div className="w-full aspect-square rounded-xl" style={{ backgroundColor: 'var(--theme-border-subtle)' }} />}
            <button type="button" onClick={() => toggleStar(current)} aria-pressed={mine.has(current.id)}
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow"
              style={{ backgroundColor: 'rgba(255,255,255,0.92)', color: '#1d1a16' }}
              title={pt ? 'Curtir: os favoritos aparecem primeiro para todos' : 'Like: favourites show first for everyone'}>
              <Heart className="w-3.5 h-3.5" fill={mine.has(current.id) ? '#e5484d' : 'none'} stroke={mine.has(current.id) ? '#e5484d' : 'currentColor'} /> {current.stars}
            </button>
          </div>
          {images.length > 1 && (
            <div className="flex justify-center gap-1.5 flex-wrap">
              {images.slice(0, 12).map((img, i) => (
                <button key={img.id} type="button" onClick={() => setSelected(i)}
                  className={`w-11 h-11 rounded-md overflow-hidden border-2 ${i === selected ? '' : 'opacity-60 hover:opacity-100'}`}
                  style={{ borderColor: i === selected ? 'var(--theme-accent, #7756c6)' : 'transparent' }}>
                  {img.url && <img src={img.url} alt="" className="w-full h-full object-cover" />}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-center py-4" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Ainda não há mosaico desta palavra. Gere o primeiro e ajude a comunidade!' : 'No mosaic for this word yet. Create the first one and help the community!'}
        </p>
      )}
    </div>
  )
}
