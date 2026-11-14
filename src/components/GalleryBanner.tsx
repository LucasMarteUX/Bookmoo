import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/store/useLanguage'

const BANNER = '/banners/gallery-home.webp'

/** Faixa de largura total na Home que leva à galeria. Usa a arte em /banners/gallery-home.webp quando existir;
 *  enquanto isso mostra capas reais do catálogo sobre fundo chapado. */
export function GalleryBanner() {
  const navigate = useNavigate()
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const [art, setArt] = useState<boolean | null>(null)
  const [covers, setCovers] = useState<string[]>([])

  useEffect(() => {
    const img = new Image()
    img.onload = () => setArt(true)
    img.onerror = () => setArt(false)
    img.src = BANNER
  }, [])

  useEffect(() => {
    if (art !== false || !supabase) return
    supabase.from('catalog_books').select('cover_thumb').not('cover_thumb', 'is', null).eq('cefr_level', 'A2').limit(8)
      .then(({ data }) => setCovers((data ?? []).map((r: { cover_thumb: string }) => r.cover_thumb).slice(0, 6)))
  }, [art])

  const title = pt ? 'Sua próxima leitura está na galeria' : 'Your next read is in the gallery'
  const sub = pt ? 'Clássicos completos, do A1 ao C2, com capas, sons e explicações por IA.' : 'Complete classics, from A1 to C2, with covers, sounds and AI explanations.'
  const cta = pt ? 'Explorar a galeria' : 'Explore the gallery'

  return (
    <button type="button" onClick={() => navigate('/gallery')} aria-label={cta}
      className="group relative block w-full overflow-hidden rounded-2xl border text-left" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
      {art ? (
        <>
          <img src={BANNER} alt="" className="w-full h-[200px] sm:h-[240px] md:h-[280px] object-cover object-right" />
          <div className="absolute inset-0 flex flex-col justify-center gap-3 p-5 md:p-10 max-w-[60%] sm:max-w-[55%]" style={{ color: '#fff' }}>
            <h2 className="font-display text-[22px] sm:text-[30px] md:text-[38px] leading-[1.05]">{title}</h2>
            <p className="hidden sm:block text-[14px] opacity-90">{sub}</p>
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-white px-4 py-2 text-[13.5px] font-medium text-black">{cta}<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></span>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-6 p-5 md:p-8">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[22px] md:text-[32px] leading-[1.08]" style={{ color: 'var(--theme-text)' }}>{title}</h2>
            <p className="mt-1 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>{sub}</p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-medium" style={{ backgroundColor: 'var(--theme-accent)', color: 'var(--theme-accent-contrast, #fff)' }}>{cta}<ArrowRight className="w-4 h-4" /></span>
          </div>
          <div className="hidden sm:flex -space-x-5">
            {covers.slice(0, 5).map((c, i) => <img key={i} src={c} alt="" className="book-cover w-[72px] md:w-[92px] aspect-[2/3] rounded-md object-cover" style={{ transform: `rotate(${(i - 2) * 3}deg)` }} />)}
          </div>
        </div>
      )}
    </button>
  )
}
