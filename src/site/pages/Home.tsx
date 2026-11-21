// Home do site: o Upoonly como ele é (leitura no computador e no celular), com fotos humanas e a interface real nas telas.
// Referências: Mindara, Studio Think, claude.com/product/overview. Sem planos e sem áudio: cada bloco leva à página da função.
import { SiteLayout } from '../SiteLayout'
import { useSeo } from '../ui'
import { FaqSection, FinalCta } from '../sections'
import { LibraryWall } from '../home/Premium'
import { TutorScroll } from '../story/Story'
import { DayStory, GrowFeatures, HeroSetup, LaptopSection, Manifesto, ReadFeatures, StylesGallery } from '../story/Showcase'

export default function SiteHome() {
  useSeo('Upoonly · Aprenda inglês lendo as histórias que você ama',
    'Clássicos em inglês com áudio, cada palavra explicada, páginas ilustradas e tutores para conversar. Comece grátis e ganhe um livro de presente.')
  return (
    <SiteLayout>
      <HeroSetup />
      <DayStory />
      <Manifesto />
      <ReadFeatures />
      <StylesGallery />
      <LaptopSection />
      <TutorScroll />
      <GrowFeatures />
      <LibraryWall />
      <FaqSection />
      <FinalCta />
    </SiteLayout>
  )
}
