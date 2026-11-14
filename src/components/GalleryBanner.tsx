import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
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
    // Mistura de categorias: 3 adultas (uma de cada categoria) e 2 infantis, intercaladas.
    supabase.from('catalog_books').select('cover_thumb, category, age_min').not('cover_thumb', 'is', null).limit(200)
      .then(({ data }) => {
        const rows = (data ?? []) as { cover_thumb: string; category: string; age_min: number | null }[]
        const seen = new Set<string>(); const adult: string[] = []; const kids: string[] = []
        for (const r of rows) {
          if (r.category === 'children') { if (kids.length < 2) kids.push(r.cover_thumb); continue }
          if ((r.age_min ?? 12) < 12 || seen.has(r.category)) continue
          seen.add(r.category); adult.push(r.cover_thumb)
        }
        const a5 = adult.slice(0, 3); const mixed: string[] = []
        a5.forEach((c, i) => { mixed.push(c); if (i === 0 && kids[0]) mixed.push(kids[0]); if (i === 1 && kids[1]) mixed.push(kids[1]) })
        setCovers(mixed)
      })
  }, [art])

  const title = pt ? 'Sua próxima leitura está na galeria' : 'Your next read is in the gallery'
  const sub = pt ? 'Clássicos completos, do A1 ao C2, com capas, sons e explicações por IA.' : 'Complete classics, from A1 to C2, with covers, sounds and AI explanations.'
  const cta = pt ? 'Explorar a galeria' : 'Explore the gallery'

  return (
    <div onClick={() => navigate('/gallery')}
      className="relative block w-full cursor-pointer overflow-hidden rounded-2xl border text-left" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
      {art ? (
        <>
          <img src={BANNER} alt="" className="w-full h-[200px] sm:h-[240px] md:h-[280px] object-cover object-right" />
          <div className="absolute inset-0 flex flex-col justify-center gap-3 p-5 md:p-10 max-w-[60%] sm:max-w-[55%]" style={{ color: '#fff' }}>
            <h2 className="font-display text-[22px] sm:text-[30px] md:text-[38px] leading-[1.05]">{title}</h2>
            <p className="hidden sm:block text-[14px] opacity-90">{sub}</p>
            <Button className="self-start">{cta}<ArrowRight className="w-4 h-4" /></Button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-6 p-5 md:p-8">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[22px] md:text-[32px] leading-[1.08]" style={{ color: 'var(--theme-text)' }}>{title}</h2>
            <p className="mt-1 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>{sub}</p>
            <Button className="mt-4">{cta}<ArrowRight className="w-4 h-4" /></Button>
          </div>
          <div className="hidden sm:flex -space-x-5">
            {covers.map((c, i) => <img key={i} src={c} alt="" className="book-cover w-[68px] md:w-[88px] aspect-[2/3] rounded-md object-cover" style={{ transform: `rotate(${(i - 2) * 3}deg)` }} />)}
          </div>
        </div>
      )}
    </div>
  )
}
