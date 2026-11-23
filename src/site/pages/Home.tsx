import { SiteLayout } from '../SiteLayout'
import { IllustratedChapter } from '../home/IllustratedChapters'
import { IllustrationAtelier } from '../home/IllustrationAtelier'
import { ConversationPrelude, LastPage, LibraryShelf, PracticePassage } from '../home/ReadingJourney'
import { ReadingLight } from '../home/ReadingLight'
import { GardenSequence } from '../story/GardenSequence'
import { Prologue } from '../story/Prologue'
import { LaptopSection, StylesGallery } from '../story/Showcase'
import { TutorScroll } from '../story/Story'
import { StorySpread } from '../story/StorySpread'
import { useSeo } from '../ui'
import './edition.css'
import '../home/journey.css'

export default function SiteHome() {
  useSeo('Upoonly · Aprenda inglês dentro dos livros', 'Leia clássicos, ouça a narração e converse em inglês sobre a história.')

  return (
    <SiteLayout>
      <div className="home-journey">
        <div className="book-story">
          <Prologue />
          <GardenSequence />
          <StorySpread />
        </div>
        <div className="edition">
          <IllustratedChapter name="narracao" />
          <IllustratedChapter name="palavras" reverse />
          <IllustratedChapter name="margens" />
        </div>
        <LaptopSection />
        <ReadingLight />
        <div className="edition"><IllustrationAtelier /></div>
        <StylesGallery head={false} />
        <ConversationPrelude />
        <TutorScroll />
        <div className="edition"><IllustratedChapter name="fala" reverse /></div>
        <PracticePassage />
        <div className="edition">
          <IllustratedChapter name="percurso" />
          <IllustratedChapter name="aventura" reverse />
        </div>
        <LibraryShelf />
        <LastPage />
      </div>
    </SiteLayout>
  )
}
