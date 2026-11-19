// Banner da home: os quatro tutores convidando para praticar conversa. Largura inteira do conteúdo; no celular o grupo fica
// em cima e o texto embaixo.
//
// Bustos (public/characters/bookmoo/banner/<id>.webp e <id>-sorriso.webp): capturados do próprio rig no app, no corpo
// neutro, com o rosto neutro e o feliz recortados na MESMA caixa (só o rosto muda no hover). Vão até a cintura: 820 px de
// altura, dos quais os 60 de baixo ficam escondidos abaixo da borda do cartão (ao subir no hover aparece mais roupa, nunca o
// corte).
// Escala: cabeça de tamanho parecido, Luck um pouco maior, adolescentes um pouco menores e mais baixos. As posições abaixo
// vêm da montagem (largura total 1448 px, parte visível 760 px, sobreposição de 42%).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAvatarSettings } from '@/store/useAvatarSettings'

const GROUP_W = 1448, VISIBLE_H = 760, BUST_H = 820
// Versão das imagens: muda junto com os arquivos (mesmo nome em versões diferentes deixava o navegador com a antiga, esticada).
const REV = '2'

// Fechar o banner (X): ele some e só volta depois de um tempo SEM praticar conversa, contado a partir do que for mais recente
// entre o fechamento e a última conversa. 1ª vez que fecha: volta após 1 semana; 2ª: 2 semanas; 3ª em diante: 1 mês. A cada
// volta a frase muda. Se a pessoa não fechar, ele fica. Guardado no aparelho.
const DISMISS_KEY = 'bookmoo.tutorsBanner.v1'
const DAY = 86_400_000
const WAIT_DAYS = [7, 14, 30]
type Dismiss = { closes: number; closedAt: number }
function readDismiss(): Dismiss {
  try { const d = JSON.parse(localStorage.getItem(DISMISS_KEY) || 'null'); if (d && Number.isFinite(d.closes) && Number.isFinite(d.closedAt)) return d } catch { /* sem armazenamento */ }
  return { closes: 0, closedAt: 0 }
}
/** Visível agora? (sem fechamento, ou passado o prazo do último fechamento sem conversar). */
function tutorsBannerVisible(d: Dismiss, lastTalkedAt: number | null, now = Date.now()) {
  if (!d.closes) return true
  const since = Math.max(d.closedAt, lastTalkedAt ?? 0)
  return now - since >= WAIT_DAYS[Math.min(d.closes, WAIT_DAYS.length) - 1] * DAY
}

// Frase de cada volta (0 = primeira vez; 1 = depois de 1 semana; 2 = depois de 2 semanas; 3 = depois de 1 mês, e daí em diante).
const COPY = [
  { pt: ['Pratique inglês conversando com Bia, Luck, Yuno e Yuri', 'Escolha um tutor e fale em voz alta. Eles respondem, corrigem com calma e lembram do que vocês conversaram.'],
    en: ['Practice English by talking with Bia, Luck, Yuno and Yuri', 'Pick a tutor and speak out loud. They answer, correct you gently and remember what you talked about.'] },
  { pt: ['Faz uma semana sem conversar. Bora praticar?', 'Alguns minutos falando em voz alta já fazem diferença. Escolha um tutor e comece.'],
    en: ['A week without talking. Shall we practice?', 'A few minutes of speaking out loud already help. Pick a tutor and start.'] },
  { pt: ['Duas semanas sem conversar em inglês', 'Que tal retomar com uma conversa curta? Os tutores lembram de onde vocês pararam.'],
    en: ['Two weeks without speaking English', 'How about a short chat to get back? The tutors remember where you left off.'] },
  { pt: ['Bora voltar a falar inglês?', 'Bia, Luck, Yuno e Yuri continuam aqui. É só escolher um e começar a conversar.'],
    en: ['Ready to speak English again?', 'Bia, Luck, Yuno and Yuri are still here. Just pick one and start talking.'] },
]

const TUTORS = [
  { id: 'bia', character: 'bookmoo-mulher', name: 'Bia', left: 0, width: 33.63, z: 2, pt: 'Oi! Me conta o que você está lendo?', en: 'Hi! Tell me what you are reading?' },
  { id: 'luck', character: 'bookmoo-homem', name: 'Luck', left: 19.54, width: 42.2, z: 1, pt: 'Bora conversar sobre o seu dia?', en: 'Shall we talk about your day?' },
  { id: 'yuno', character: 'bookmoo-yuno', name: 'Yuno', left: 47.72, width: 33.43, z: 2, pt: 'Vamos praticar? Sem pressão!', en: 'Let us practice? No pressure!' },
  { id: 'yuri', character: 'bookmoo-yuri', name: 'Yuri', left: 67.61, width: 32.39, z: 2, pt: 'E aí! Eu ajudo com as palavras.', en: 'Hey! I will help with the words.' },
]

export function TutorsBanner({ pt }: { pt: boolean }) {
  const navigate = useNavigate()
  const [hover, setHover] = useState<string | null>(null)
  const open = (character?: string) => navigate(character ? `/conversar?tutor=${character}` : '/conversar')
  const lastTalkedAt = useAvatarSettings(st => st.lastTalkedAt)
  const [dismiss, setDismiss] = useState(readDismiss)
  const [hidden, setHidden] = useState(false)
  if (hidden || !tutorsBannerVisible(dismiss, lastTalkedAt)) return null
  const [title, sub] = COPY[Math.min(dismiss.closes, COPY.length - 1)][pt ? 'pt' : 'en']
  const close = () => {
    const next = { closes: dismiss.closes + 1, closedAt: Date.now() }
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)) } catch { /* sem armazenamento: some só nesta visita */ }
    setDismiss(next)
    setHidden(true)
  }
  return (
    <section aria-labelledby="tutors-banner-title"
      className="relative overflow-hidden rounded-2xl border flex flex-col md:flex-row md:items-stretch"
      style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
      <button type="button" onClick={close} aria-label={pt ? 'Fechar' : 'Close'}
        className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full grid place-items-center transition-colors hover:bg-[var(--ui-hover)]"
        style={{ color: 'var(--theme-text-secondary)' }}>
        <X className="w-4 h-4" />
      </button>
      {/* Grupo: no celular, faixa em cima com fundo próprio; no desktop, à direita, apoiado na borda de baixo. A faixa corta o
          excedente de baixo (overflow), então a borda inferior dos bustos nunca aparece. */}
      <div className="order-1 md:order-2 relative overflow-hidden flex items-end justify-center md:w-[56%] px-4 md:pl-0 md:pr-8 pt-12 bg-[var(--theme-bg-secondary)] md:bg-transparent">
        <div className="relative w-full max-w-[460px] md:max-w-none" style={{ aspectRatio: `${GROUP_W} / ${VISIBLE_H}` }}>
          {TUTORS.map(t => {
            const on = hover === t.id
            return (
              <button key={t.id} type="button" onClick={() => open(t.character)}
                onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(h => (h === t.id ? null : h))}
                onFocus={() => setHover(t.id)} onBlur={() => setHover(h => (h === t.id ? null : h))}
                aria-label={pt ? `Conversar com ${t.name}` : `Talk with ${t.name}`}
                className="absolute top-0 outline-none"
                style={{ left: `${t.left}%`, width: `${t.width}%`, height: `${(BUST_H / VISIBLE_H) * 100}%`, zIndex: on ? 3 : t.z }}>
                <span className="block relative w-full h-full transition-transform duration-300 ease-out" style={{ transform: on ? 'translateY(-7px)' : 'none' }}>
                  <img src={`/characters/bookmoo/banner/${t.id}.webp?v=${REV}`} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain object-top select-none" />
                  <img src={`/characters/bookmoo/banner/${t.id}-sorriso.webp?v=${REV}`} alt="" draggable={false}
                    className="absolute inset-0 w-full h-full object-contain object-top select-none transition-opacity duration-200" style={{ opacity: on ? 1 : 0 }} />
                </span>
                {/* Balão com a frase do personagem, acima da cabeça (só com mouse/teclado; no toque o clique já abre a conversa). */}
                {/* Os das pontas ancoram pela borda de dentro (centralizado, o da Bia passava da borda do painel e era cortado). */}
                <span aria-hidden className="pointer-events-none absolute top-0 hidden md:block transition-all duration-200"
                  style={{ opacity: on ? 1 : 0, ...(t.id === 'bia' ? { left: '22%' } : t.id === 'yuri' ? { right: '22%' } : { left: '50%' }),
                    transform: `translate(${t.id === 'bia' || t.id === 'yuri' ? '0' : '-50%'}, calc(-100% - ${on ? 14 : 6}px))` }}>
                  <span className="relative block whitespace-nowrap rounded-xl border px-3 py-1.5 text-[12.5px] shadow-sm"
                    style={{ backgroundColor: 'var(--theme-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}>
                    {pt ? t.pt : t.en}
                    <span className={`absolute -bottom-[5px] w-2.5 h-2.5 rotate-45 border-r border-b ${t.id === 'bia' ? 'left-[24%]' : t.id === 'yuri' ? 'right-[24%]' : 'left-1/2 -translate-x-1/2'}`}
                      style={{ backgroundColor: 'var(--theme-bg)', borderColor: 'var(--theme-border)' }} />
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="order-2 md:order-1 flex flex-col justify-center gap-3 p-5 md:p-8 md:w-[44%]">
        <p className="text-[12.5px] font-medium inline-flex items-center gap-1.5" style={{ color: 'var(--theme-text-secondary)' }}>
          <MessageCircle className="w-3.5 h-3.5" />
          {pt ? 'Conversa com os tutores' : 'Talk with the tutors'}
        </p>
        <h2 id="tutors-banner-title" className="font-display text-[24px] md:text-[32px] leading-[1.1]" style={{ color: 'var(--theme-text)' }}>
          {title}
        </h2>
        <p className="text-[14px] leading-snug max-w-md" style={{ color: 'var(--theme-text-secondary)' }}>
          {sub}
        </p>
        <div className="mt-1">
          <Button className="h-11 w-full sm:w-auto px-5" onClick={() => open()}>
            {pt ? 'Começar a conversar' : 'Start talking'}
          </Button>
        </div>
      </div>
    </section>
  )
}
