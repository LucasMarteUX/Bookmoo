// Tutorial guiado da primeira vez dentro de um livro. Primeiro o essencial (tocar numa palavra ou frase,
// marcar, anotar, explicar); depois as abas e ferramentas (ler, escrever, escutar, falar, texto/ilustrado,
// esconder marcações, música, vozes, estilo, tamanho). Aparece uma vez por pessoa e pode ser revisto em Configurações.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/store/useLanguage'
import { TourOverlay, useTourRect, type TourStep } from './GuidedTour'

const STEPS: TourStep[] = [
  { pt: ['Seu primeiro livro', 'Aqui você aprende inglês lendo. Primeiro o mais importante: como transformar o texto em estudo. Leva menos de um minuto.'], en: ['Your first book', 'This is where you learn English by reading. First, the most important thing: turning the text into study. It takes under a minute.'] },
  { selector: 'span[data-word-index]', pt: ['Toque em uma palavra', 'Toque em qualquer palavra do texto para ver o significado, ouvir a pronúncia e salvar no seu vocabulário. Ela fica colorida no texto, em todos os seus livros.'], en: ['Tap a word', 'Tap any word to see its meaning, hear it and save it to your vocabulary. It stays highlighted in the text across all your books.'] },
  { selector: 'span[data-word-index]', pt: ['Aprendi, Revisar ou Importante', 'Marque como Revisar para entrar na sua revisão, Aprendi quando já domina (soma pontos) ou Importante para voltar depois. Cada tipo tem uma cor no texto.'], en: ['Learned, Review or Important', 'Mark Review to add it to your review, Learned when you know it (earns points) or Important to come back later. Each type has its own colour.'] },
  { selector: '[data-reader-bar] > div', pt: ['Barra de leitura', 'Aqui você vira as páginas, ouve a narração no play, muda a velocidade e escolhe como tocar no texto.'], en: ['Reading bar', 'Turn pages, play the narration, change the speed and choose how to interact with the text.'] },
  { selector: '[data-tour="select-text"]', pt: ['Explicar uma frase com IA', 'Toque em Selecionar texto e arraste sobre uma frase. Aparece um menu para salvar, anotar ou pedir uma explicação com significado, exemplos e uma pequena história. O que a comunidade já gerou é grátis; uma explicação nova usa 1 crédito.'], en: ['Explain a sentence with AI', 'Tap Select text and drag over a sentence. A menu lets you save it, add a note or ask for an explanation with meaning, examples and a short story. What the community already generated is free; a new one uses 1 credit.'] },
  { selector: '[data-tour="note-mode"]', pt: ['Notas na página', 'Com Nota, toque em qualquer ponto para deixar um lembrete ali. Ele aparece de novo quando você voltar a esta página.'], en: ['Notes on the page', 'With Note, tap anywhere to leave a reminder there. It shows up again when you come back to this page.'] },
  { selector: 'nav[role="tablist"]', pt: ['Ler, Escrever, Escutar e Falar', 'Cada aba é uma forma de estudar o mesmo livro: Ler com ajuda, Escrever (ditado e edição), Escutar a narração e Falar lendo em voz alta com retorno da pronúncia.'], en: ['Read, Write, Listen and Speak', 'Each tab is a way to study the same book: Read with help, Write (dictation and editing), Listen to the narration and Speak by reading aloud with pronunciation feedback.'] },
  { selector: '[aria-label="Modo de leitura"], [aria-label="Reading mode"]', pt: ['Texto ou Ilustrado', 'Veja a página só em texto ou como quadrinho, com o texto nos balões. Se alguém já ilustrou a página, você vê de graça; gerar uma nova usa créditos.'], en: ['Text or Illustrated', 'See the page as plain text or as a comic with the text in balloons. If someone already illustrated the page it is free to see; a new one uses credits.'] },
  { selector: '[data-tour="study"]', pt: ['Estudar a página', 'Abre uma lição completa desta página, como num livro de inglês: vocabulário, regras com exemplos do livro e de outras situações, erros comuns, exercícios e pronúncia.'], en: ['Study the page', 'Opens a full lesson for this page, like an English course book: vocabulary, rules with examples, common mistakes, exercises and pronunciation.'] },
  { selector: '[data-tour="quiz"]', pt: ['Desafio', 'A partir da segunda página, o dado abre um quiz com o que você leu. Começa fácil e fica mais difícil conforme você acerta.'], en: ['Challenge', 'From the second page on, the dice opens a quiz about what you read. It starts easy and gets harder as you get answers right.'] },
  { selector: 'button[aria-label="Esconder marcações"], button[aria-label="Hide marks"]', pt: ['Esconder marcações', 'O olho esconde as cores das palavras para você ler sem distrações, ou testar o que ainda lembra.'], en: ['Hide marks', 'The eye hides the word colours so you can read without distraction or test what you still remember.'] },
  { selector: 'button[aria-label="Som ambiente"], button[aria-label="Ambient sound"]', pt: ['Som ambiente', 'Chuva, lareira e outros sons para ler com foco. O volume fica salvo no seu aparelho.'], en: ['Ambient sound', 'Rain, fireplace and other sounds to read with focus. The volume is saved on your device.'] },
  { selector: 'button[title="Vozes da leitura"], button[title="Reading voices"]', pt: ['Vozes da leitura', 'Escolha a voz do narrador e a dos personagens. Uma voz feminina e uma masculina já vêm instaladas.'], en: ['Reading voices', 'Pick the narrator and character voices. One female and one male voice come pre-installed.'] },
  { selector: 'button[aria-label="Estilo de arte das ilustrações"], button[aria-label="Illustration art style"]', pt: ['Estilo das ilustrações', 'Cada livro tem um estilo padrão, compartilhado com a comunidade. Se quiser um estilo seu, troque aqui.'], en: ['Illustration style', 'Each book has a default style shared with the community. Switch here if you want your own.'] },
  { selector: 'button[aria-label="Tamanho da página"], button[aria-label="Page length"]', pt: ['Tamanho da página', 'Páginas menores para ler no celular ou maiores para o computador. Você muda quando quiser.'], en: ['Page length', 'Shorter pages for phones or longer ones for desktop. Change it any time.'] },
  { selector: '[data-reader-panel], button[aria-label="Opções de leitura"], button[aria-label="Reading options"]', pt: ['Tamanho e fonte do texto', 'Ajuste o tamanho da letra, o espaçamento e a fonte aqui. O tema (dia, tarde ou noite) e a voz padrão ficam no menu da sua conta.'], en: ['Text size and font', 'Adjust letter size, spacing and font here. The theme (day, afternoon or night) and default voice live in your account menu.'] },
  { selector: '[data-tour="tutor-panel"], [data-tour="tutor-fab"]', enter: 'bookmoo:tutor-open', leave: 'bookmoo:tutor-close',
    pt: ['Sua tutora de leitura', 'A Bea conversa por voz sobre o livro. Ela explica trechos, destaca frases na página, volta a páginas anteriores para mostrar exemplos e abre a lição de estudo. Toque no play e pergunte. No A1 e A2 ela pode explicar em português.'],
    en: ['Your reading tutor', 'Bea talks with you about the book by voice. She explains passages, highlights sentences, goes back to earlier pages for examples and opens the study lesson. Tap play and ask. At A1 and A2 she can explain in Portuguese.'] },
  { pt: ['Tudo pronto', 'Comece tocando numa palavra. Você pode rever este tutorial em Configurações, a qualquer momento.'], en: ['All set', 'Start by tapping a word. You can replay this tutorial any time in Settings.'] },
]

const keyFor = (id?: string) => `bookmoo.booktour.v1.${id ?? 'anon'}`
export const restartBookTour = () => window.dispatchEvent(new Event('bookmoo:booktour'))

export function BookTour({ ready }: { ready: boolean }) {
  const pt = useLanguage(s => s.locale) === 'pt-BR'
  const { user } = useAuth()
  const [step, setStep] = useState<number | null>(null)
  const dir = useRef<1 | -1>(1)
  const go = useCallback((n: number) => { setStep(cur => { dir.current = cur !== null && n < cur ? -1 : 1; return n }) }, [])
  const rect = useTourRect(STEPS, step, go, dir)

  useEffect(() => {
    if (!user?.id || !ready) return
    try { if (localStorage.getItem(keyFor(user.id))) return } catch { return }
    const t = window.setTimeout(() => setStep(0), 1600)
    return () => window.clearTimeout(t)
  }, [user?.id, ready])
  useEffect(() => {
    const open = () => { dir.current = 1; setStep(0) }
    window.addEventListener('bookmoo:booktour', open)
    return () => window.removeEventListener('bookmoo:booktour', open)
  }, [])

  const close = useCallback(() => {
    try { localStorage.setItem(keyFor(user?.id), String(Date.now())) } catch { /* sem armazenamento */ }
    setStep(null)
  }, [user?.id])

  // Passos que mostram algo aberto (ex.: painel da tutora): abre ao entrar e fecha ao sair.
  useEffect(() => {
    if (step === null) return
    const s = STEPS[step]
    if (s.enter) window.dispatchEvent(new Event(s.enter))
    return () => { if (s.leave) window.dispatchEvent(new Event(s.leave)) }
  }, [step])
  useEffect(() => {
    if (step === null) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') go(Math.min(STEPS.length - 1, step + 1))
      else if (e.key === 'ArrowLeft') go(Math.max(0, step - 1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [step, go, close])

  if (step === null) return null
  return <TourOverlay steps={STEPS} step={step} rect={rect} pt={pt} onStep={go} onClose={close} doneLabel={pt ? 'Ler' : 'Read'} />
}
