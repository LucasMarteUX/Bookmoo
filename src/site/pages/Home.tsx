import { Pricing } from '../blocks'
import { HeroPremium } from '../home/Premium'
import { LibraryShelf, ProgressReport, ReaderSpread, StudyDesk, TutorRoom } from '../home/ProductStudio'
import { FaqSection, FinalCta } from '../sections'
import { SiteLayout } from '../SiteLayout'
import { Btn, Reveal, useSeo } from '../ui'

export default function SiteHome() {
  useSeo('Upoonly · Aprenda inglês lendo as histórias que você ama',
    'Leia em inglês com áudio, ilustrações, vocabulário e tutores que conversam sobre a história.')
  return <SiteLayout>
    <div className="site-original-hero"><HeroPremium/></div>
    <div className="reader-home">
      <ReaderSpread/>
      <LibraryShelf/>
      <TutorRoom/>
      <StudyDesk/>
      <ProgressReport/>
      <section className="rh-frame rh-section rh-plans" id="planos">
        <Reveal className="rh-section-head"><div><p className="rh-kicker">Planos</p>
          <h2 className="rh-heading">Comece com um livro de presente.</h2></div>
          <p className="rh-description">Experimente o leitor no plano Grátis. Quando quiser ampliar a biblioteca, compare os recursos e créditos de cada plano.</p>
        </Reveal>
        <Pricing compact/>
        <div className="rh-plans-link"><Btn to="/planos" variant="white" arrow>Comparar todos os planos</Btn></div>
      </section>
      <FaqSection/><FinalCta/>
    </div>
  </SiteLayout>
}
