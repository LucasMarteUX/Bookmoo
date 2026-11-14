import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/store/useLanguage'

const BANNER = '/banners/gallery-home.webp'
const PICKS = [
  'cb8a5443-6910-4b1c-9b63-9b684689d73b', // Alice's Adventures in Wonderland
  'b58684d3-fb1b-4ec7-80c8-0891e1062a9b', // Moby Dick
  'ce9c6a7f-6dfc-401d-98c3-e8e9c959e96f', // The Adventures of Sherlock Holmes
  'e06fbad9-54dd-43e8-92e6-4078e351cc5c', // Frankenstein
  '182b957a-4297-49ff-a47e-976b58320dfc', // Anne of the Island
]

/** Faixa de largura total na Home que leva à galeria. Usa a arte em /banners/gallery-home.webp quando existir;
 *  enquanto isso mostra capas reais do catálogo sobre fundo chapado. */
export function GalleryBanner() {
  const navigate = useNavigate()
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const [art, setArt] = useState<boolean | null>(null)
  const [covers, setCovers] = useState<{ id: string; cover: string; title: string }[]>([])

  useEffect(() => {
    const img = new Image()
    img.onload = () => setArt(true)
    img.onerror = () => setArt(false)
    img.src = BANNER
  }, [])

  useEffect(() => {
    if (art !== false || !supabase) return
    // Seleção fixa, na ordem: Alice, Moby Dick, Sherlock Holmes, Frankenstein, Anne of the Island.
    supabase.from('catalog_books').select('id, title, cover_thumb').in('id', PICKS).not('cover_thumb', 'is', null)
      .then(({ data }) => {
        const rows = (data ?? []) as { id: string; title: string; cover_thumb: string }[]
        setCovers(PICKS.map(id => rows.find(r => r.id === id)).filter(Boolean).map(r => ({ id: r!.id, title: r!.title, cover: r!.cover_thumb })))
      })
  }, [art])

  const title = pt ? 'Sua próxima leitura está na galeria' : 'Your next read is in the gallery'
  const sub = pt ? 'Clássicos completos, do A1 ao C2, com capas, sons e explicações por IA.' : 'Complete classics, from A1 to C2, with covers, sounds and AI explanations.'
  const cta = pt ? 'Explorar a galeria' : 'Explore the gallery'

  return (
    <div className="relative block w-full overflow-hidden rounded-2xl border text-left" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
      {art ? (
        <>
          <img src={BANNER} alt="" className="w-full h-[200px] sm:h-[240px] md:h-[280px] object-cover object-right" />
          <div className="absolute inset-0 flex flex-col justify-center gap-3 p-5 md:p-10 max-w-[60%] sm:max-w-[55%]" style={{ color: '#fff' }}>
            <h2 className="font-display text-[22px] sm:text-[30px] md:text-[38px] leading-[1.05]">{title}</h2>
            <p className="hidden sm:block text-[14px] opacity-90">{sub}</p>
            <Button className="self-start" onClick={() => navigate('/gallery')}>{cta}<ArrowRight className="w-4 h-4" /></Button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-6 p-5 md:p-8">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[22px] md:text-[32px] leading-[1.08]" style={{ color: 'var(--theme-text)' }}>{title}</h2>
            <p className="mt-1 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>{sub}</p>
            <Button className="mt-4" onClick={() => navigate('/gallery')}>{cta}<ArrowRight className="w-4 h-4" /></Button>
          </div>
          <div className="hidden sm:flex -space-x-5">
            {covers.map((c, i) => (
              <button key={c.id} type="button" onClick={() => navigate(`/gallery/${c.id}`)} aria-label={c.title} title={c.title}
                className="book-cover w-[68px] md:w-[88px] aspect-[2/3] rounded-md overflow-hidden transition-transform hover:-translate-y-1" style={{ transform: `rotate(${(i - 2) * 3}deg)` }}>
                <img src={c.cover} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
