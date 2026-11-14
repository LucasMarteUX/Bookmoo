// Tutorial guiado da primeira vez dentro de um livro. Primeiro o essencial (tocar numa palavra ou frase,
// marcar, anotar, explicar); depois as abas e ferramentas (ler, escrever, escutar, falar, texto/ilustrado,
// esconder marcações, música, vozes, estilo, tamanho). Aparece uma vez por pessoa e pode ser revisto em Configurações.
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/store/useLanguage'
import { TourOverlay, targetRect, type TourStep } from './GuidedTour'

const STEPS: TourStep[] = [
  { pt: ['Seu primeiro livro', 'Aqui você aprende inglês lendo. Vamos ver primeiro o mais importante: como transformar o texto em estudo. Dura menos de um minuto.'], en: ['Your first book', 'This is where you learn English by reading. First, the most important thing: turning the text into study. It takes under a minute.'] },
  { selector: 'span[data-word-index]', pt: ['Toque em uma palavra', 'Toque em qualquer palavra do texto para ver o significado, ouvir a pronúncia e salvar no seu vocabulário. Ela fica colorida no texto, em todos os seus livros.'], en: ['Tap a word', 'Tap any word to see its meaning, hear it and save it to your vocabulary. It stays highlighted in the text across all your books.'] },
  { selector: 'span[data-word-index]', pt: ['Aprendi, Revisar ou Importante', 'Marque como Revisar para entrar na sua revisão, Aprendi quando já domina (soma pontos) ou Importante para destacar e voltar depois. As cores mostram o que é de cada tipo.'], en: ['Learned, Review or Important', 'Mark Review to add it to your review, Learned when you know it (earns points) or Important to highlight it and come back later. Colours show each type.'] },
  { selector: '[data-reader-bar]', pt: ['Palavra, frase ou nota', 'Na barra de baixo você escolhe como interagir: tocar em palavras, selecionar um trecho inteiro (para salvar a frase, anotar ou pedir uma explicação) ou cravar uma nota em qualquer ponto.'], en: ['Word, phrase or note', 'The bottom bar lets you choose how to interact: tap words, select a whole passage (to save the phrase, add a note or ask for an explanation) or pin a note anywhere.'] },
  { selector: '[data-reader-bar]', pt: ['Explicar com IA', 'Ao selecionar uma palavra ou frase, peça uma explicação com significado, exemplos e uma pequena história. O que a comunidade já gerou é grátis; uma explicação nova usa 1 crédito.'], en: ['Explain with AI', 'Select a word or phrase and ask for an explanation with meaning, examples and a short story. What the community already generated is free; a new one uses 1 credit.'] },
  { selector: 'nav[role="tablist"]', pt: ['Ler, Escrever, Escutar e Falar', 'Cada aba é uma forma de estudar o mesmo livro: Ler com ajuda, Escrever (ditado e edição), Escutar a narração e Falar lendo em voz alta com retorno da pronúncia.'], en: ['Read, Write, Listen and Speak', 'Each tab is a way to study the same book: Read with help, Write (dictation and editing), Listen to the narration and Speak by reading aloud with pronunciation feedback.'] },
  { selector: '[aria-label="Modo de leitura"], [aria-label="Reading mode"]', pt: ['Texto ou Ilustrado', 'Veja a página só em texto ou como quadrinho, com o texto nos balões. Se alguém já ilustrou a página, você vê de graça; gerar uma nova usa créditos.'], en: ['Text or Illustrated', 'See the page as plain text or as a comic with the text in balloons. If someone already illustrated the page it is free to see; a new one uses credits.'] },
  { selector: 'button[aria-label="Esconder marcações"], button[aria-label="Hide marks"]', pt: ['Esconder marcações', 'O olho esconde as cores das palavras (aprendidas, em revisão ou importantes) para você ler sem distrações, ou testar o que ainda lembra.'], en: ['Hide marks', 'The eye hides the word colours (learned, review or important) so you can read without distraction or test what you still remember.'] },
  { selector: 'button[aria-label="Som ambiente"], button[aria-label="Ambient sound"]', pt: ['Música e som ambiente', 'Chuva, lareira e outros sons para ler com foco. O volume fica salvo no seu aparelho.'], en: ['Music and ambient sound', 'Rain, fireplace and other sounds to read with focus. The volume is saved on your device.'] },
  { selector: 'button[title="Vozes da leitura"], button[title="Reading voices"]', pt: ['Vozes da leitura', 'Escolha a voz do narrador e a dos personagens. Uma voz feminina e uma masculina já vêm instaladas; as outras você baixa em Configurações.'], en: ['Reading voices', 'Pick the narrator and character voices. One female and one male voice come pre-installed; you can download others in Settings.'] },
  { selector: 'button[aria-label="Estilo de arte das ilustrações"], button[aria-label="Illustration art style"]', pt: ['Estilo das ilustrações', 'Cada livro tem um estilo padrão, compartilhado com a comunidade. Se quiser um estilo seu, troque aqui.'], en: ['Illustration style', 'Each book has a default style shared with the community. Switch here if you want your own.'] },
  { selector: 'button[aria-label="Tamanho da página"], button[aria-label="Page length"]', pt: ['Tamanho da página', 'Páginas menores para ler no celular ou maiores para o computador. Você muda quando quiser.'], en: ['Page length', 'Shorter pages for phones or longer ones for desktop. Change it any time.'] },
  { selector: '[data-reader-panel], button[aria-label="Opções de leitura"], button[aria-label="Reading options"]', pt: ['Tema, voz e tamanho do texto', 'Ajuste o tamanho da letra, o espaçamento e a fonte aqui. O tema (dia, tarde ou noite) e a voz padrão ficam no menu da sua conta, no canto da tela.'], en: ['Theme, voice and text size', 'Adjust letter size, spacing and font here. The theme (day, afternoon or night) and default voice live in your account menu.'] },
  { pt: ['Tudo pronto', 'Comece tocando numa palavra. Você pode rever este tutorial em Configurações, a qualquer momento.'], en: ['All set', 'Start by tapping a word. You can replay this tutorial any time in Settings.'] },
]

const keyFor = (id?: string) => `bookmoo.booktour.v1.${id ?? 'anon'}`
export const restartBookTour = () => window.dispatchEvent(new Event('bookmoo:booktour'))

export function BookTour({ ready }: { ready: boolean }) {
  const pt = useLanguage(s => s.locale) === 'pt-BR'
  const { user } = useAuth()
  const [step, setStep] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!user?.id || !ready) return
    try { if (localStorage.getItem(keyFor(user.id))) return } catch { return }
    const t = window.setTimeout(() => setStep(0), 1600)
    return () => window.clearTimeout(t)
  }, [user?.id, ready])
  useEffect(() => {
    const open = () => setStep(0)
    window.addEventListener('bookmoo:booktour', open)
    return () => window.removeEventListener('bookmoo:booktour', open)
  }, [])

  const close = useCallback(() => {
    try { localStorage.setItem(keyFor(user?.id), String(Date.now())) } catch { /* sem armazenamento */ }
    setStep(null)
  }, [user?.id])

  const measure = useCallback(() => { if (step !== null) setRect(targetRect(STEPS[step].selector)) }, [step])
  useLayoutEffect(() => { measure() }, [measure])
  useEffect(() => {
    if (step === null) return
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') setStep(s => (s === null ? s : Math.min(STEPS.length - 1, s + 1)))
      else if (e.key === 'ArrowLeft') setStep(s => (s === null ? s : Math.max(0, s - 1)))
    }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); window.removeEventListener('keydown', key) }
  }, [step, measure, close])

  if (step === null) return null
  return <TourOverlay steps={STEPS} step={step} rect={rect} pt={pt} onStep={setStep} onClose={close} doneLabel={pt ? 'Ler' : 'Read'} />
}
