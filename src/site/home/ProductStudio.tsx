import { useRef, useState } from 'react'
import { BookOpen, Bookmark, Check, CloudRain, Headphones, Image as ImageIcon, Layers, Moon, Pause, Play, RotateCcw, Sun, X } from 'lucide-react'
import { useInView, useReducedMotion } from 'motion/react'
import { AMBIENTS } from '@/components/reader/AmbientSound'
import { COVERS, coverSrc, type Cover } from '../covers'
import { TUTORS, tutorAvatar, tutorImg } from '../content'
import { LiveTutor } from '../LiveTutor'
import { Btn, Reveal } from '../ui'
import './reader-home.css'

const excerptAudio = '/site/reader/peter-rabbit.m4a'
const timeLabel = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`

function Narration({ label = 'Narração do trecho' }: { label?: string }) {
  const player = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)

  async function toggle() {
    const audio = player.current
    if (!audio) return
    if (!audio.paused) { audio.pause(); return }
    setError(false)
    try { await audio.play() } catch { setError(true) }
  }

  return <div className="rh-narration">
    <audio ref={player} src={excerptAudio} preload="metadata" onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
      onTimeUpdate={e => setPosition(e.currentTarget.currentTime)} />
    <button type="button" onClick={toggle} aria-label={playing ? 'Pausar narração' : 'Ouvir narração'}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
    <div><span>{error ? 'Falha ao reproduzir. Toque para tentar de novo.' : label}</span>
      <input type="range" min="0" max={duration || 1} step=".05" value={position}
        aria-label="Posição da narração" aria-valuetext={timeLabel(position)} disabled={!duration}
        onChange={e => { if (player.current) player.current.currentTime = Number(e.target.value); setPosition(Number(e.target.value)) }}/>
    </div>
    <time>{timeLabel(position)} / {timeLabel(duration)}</time>
  </div>
}

export function ReaderSpread() {
  const [illustrated, setIllustrated] = useState(false)
  const [night, setNight] = useState(false)
  const [wordOpen, setWordOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [ambienceOpen, setAmbienceOpen] = useState(false)
  const [ambientId, setAmbientId] = useState('rain')
  const ambient = AMBIENTS.find(item => item.id === ambientId)!
  return <section id="interface" aria-label="Experimente o leitor" className="rh-frame rh-spread">
    <header className="rh-toolbar">
      <span className="rh-toolbar-title"><BookOpen size={17}/> Leitor Upoonly</span>
      <div className="rh-utilities">
        <button type="button" onClick={() => setAmbienceOpen(!ambienceOpen)} aria-expanded={ambienceOpen} aria-label="Som ambiente"><CloudRain size={17}/></button>
        <button type="button" onClick={() => setNight(!night)} aria-pressed={night} aria-label="Tema noturno">{night ? <Sun size={17}/> : <Moon size={17}/>}</button>
      </div>
    </header>
    {ambienceOpen && <div className="rh-ambient">
      <label>Som ambiente <select value={ambientId} onChange={e => setAmbientId(e.target.value)}>{AMBIENTS.map(a => <option key={a.id} value={a.id}>{a.pt}</option>)}</select></label>
      <audio key={ambientId} aria-label={'Ouvir '+ambient.pt} controls loop preload="none" src={ambient.src}/>
    </div>}
    <div className="rh-open-book" data-night={night}>
      <div className="rh-titlepage">
        <img className="rh-title-cover" src={coverSrc('short-fiction')} width="152" height="221" alt="Short Fiction, de Beatrix Potter"/>
        <div><p className="rh-author">Beatrix Potter</p><h2 lang="en">The Tale of<br/> Peter Rabbit</h2></div>
      </div>
      <div className="rh-page">
        <div className="rh-mode" role="group" aria-label="Modo de leitura">
          <button type="button" aria-pressed={!illustrated} onClick={() => setIllustrated(false)}><BookOpen size={14}/>Texto</button>
          <button type="button" aria-pressed={illustrated} onClick={() => setIllustrated(true)}><ImageIcon size={14}/>Ilustrado</button>
        </div>
        <div className="rh-reading-area" key={illustrated ? 'image' : 'text'}>
          {illustrated ? <img className="rh-illustrated" src="/site/reader/peter-rabbit-page.webp" alt="Peter Rabbit no modo ilustrado do Upoonly"/> :
            <><blockquote lang="en">Once upon a time there were four little <button type="button" className="rh-word" aria-expanded={wordOpen} onClick={() => setWordOpen(!wordOpen)}>Rabbits</button>, and their names were Flopsy, Mopsy, Cotton-tail, and Peter.</blockquote>
              {wordOpen ? <div className="rh-gloss"><div><b lang="en">Rabbits</b> <span>· coelhos</span></div>
                <button type="button" aria-pressed={saved} onClick={() => setSaved(!saved)}>{saved ? <Check size={15}/> : <Bookmark size={15}/>} {saved ? 'Salva na amostra' : 'Salvar na amostra'}</button>
                <button type="button" className="rh-dismiss" aria-label="Fechar significado" onClick={() => setWordOpen(false)}><X size={15}/></button>
              </div> : <p className="rh-word-hint">Toque em “Rabbits” para ver o significado.</p>}
            </>}
        </div>
        <Narration/>
      </div>
    </div>
  </section>
}

const curated = ['short-fiction', 'the-secret-garden', 'alices-adventures-in-wonderland', 'pride-and-prejudice', 'the-adventures-of-sherlock-holmes']
const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

export function LibraryShelf() {
  const [level, setLevel] = useState<Cover['level'] | null>(null)
  const books = level ? COVERS.filter(b => b.level === level).slice(0,5) : curated.map(slug => COVERS.find(b => b.slug === slug)!)
  return <section className="rh-frame rh-section" id="biblioteca">
    <div className="rh-section-head"><Reveal><p className="rh-kicker">Biblioteca</p><h2 className="rh-heading">Qual livro você abriria?</h2></Reveal>
      <p className="rh-description">Escolha pelo autor, pela história ou pelo seu nível de inglês. Também dá para trazer seus próprios EPUBs e PDFs.</p>
    </div>
    <div className="rh-filters" role="group" aria-label="Filtrar livros por nível">
      <button type="button" aria-pressed={level===null} onClick={() => setLevel(null)}>Seleção</button>
      {levels.map(l => <button type="button" key={l} aria-pressed={level===l} onClick={() => setLevel(l)}>{l}</button>)}
    </div>
    <div className="rh-shelf" key={level ?? 'todos'} aria-live="polite">{books.map(book =>
      <figure key={book.slug}><div className="rh-book-mount"><img src={coverSrc(book.slug)} alt="" width="180" height="260" loading="lazy"/></div>
        <figcaption><span>{book.author}</span><strong lang="en">{book.title}</strong><small>{book.level} · {book.category}</small></figcaption>
      </figure>)}</div>
  </section>
}

export function TutorRoom() {
  const [id, setId] = useState('bia')
  const tutor = TUTORS.find(t => t.id===id)!
  const stage = useRef<HTMLDivElement>(null)
  const visible = useInView(stage, { margin: '70px' })
  const reduced = useReducedMotion()
  return <section className="rh-tutor-section" id="conversas"><div className="rh-frame rh-tutors">
    <div className="rh-tutor-copy"><Reveal><p className="rh-kicker">Conversação com IA</p><h2 className="rh-heading">Com quem vamos conversar?</h2></Reveal>
      <p className="rh-description">Conte o que achou do capítulo e pratique uma frase nova em voz alta. Cada tutor tem um jeito de conduzir a conversa.</p>
      <div className="rh-roster" role="group" aria-label="Escolher tutor">{TUTORS.map(t => <button type="button" key={t.id} aria-pressed={id===t.id} onClick={() => setId(t.id)}>
        <img src={tutorAvatar(t.id)} width="36" height="36" alt="" loading="lazy"/><span>{t.name}</span></button>)}</div>
      <div className="rh-bio" aria-live="polite"><h3>{tutor.name}</h3><p>{tutor.about}</p></div>
      <Btn to="/tutores" arrow>Conhecer os tutores</Btn>
    </div>
    <div ref={stage} className="rh-tutor-stage" aria-label={'Prévia de '+tutor.name}>
      {visible && !reduced ? <LiveTutor id={id} bubble="head"/> : <img className="rh-tutor-fallback" src={tutorImg(id,true)} alt="" loading="lazy"/>}
    </div>
  </div></section>
}

function ListeningPractice() {
  const [answer, setAnswer] = useState('')
  return <><div className="rh-card-legend"><Headphones size={18}/> Desafio de escuta</div><h3>Quantos coelhos aparecem no trecho?</h3>
    <Narration label="Ouça Peter Rabbit"/>
    <div className="rh-options" role="group" aria-label="Escolha a quantidade de coelhos">{['Dois','Três','Quatro'].map(n =>
      <button type="button" aria-pressed={answer===n} key={n} onClick={() => setAnswer(n)}>{n}</button>)}</div>
    <p className="rh-feedback" aria-live="polite">{answer === 'Quatro' ? 'Isso! “Four little Rabbits” significa quatro coelhinhos.' : answer ? 'Ouça de novo a frase antes dos nomes dos coelhos.' : 'Ouça a narração e escolha sua resposta.'}</p>
  </>
}

function VocabularyPractice() {
  const [revealed, reveal] = useState(false)
  const [learned, learn] = useState(false)
  return <><div className="rh-card-legend"><Layers size={18}/> Revisão de vocabulário</div>
    <h3 lang="en">burrow</h3><blockquote lang="en">The rabbits went back to their burrow.</blockquote>
    <div className="rh-translation" aria-live="polite">{revealed ? <><b>Toca.</b> Abrigo que um animal cava na terra.</> : 'Você lembra o significado?'}</div>
    <button type="button" className="rh-review-button" onClick={() => {
      if (learned) { learn(false); reveal(false) }
      else if (revealed) learn(true)
      else reveal(true)
    }}>{learned ? <RotateCcw size={15}/> : revealed ? <Check size={15}/> : <BookOpen size={15}/>}
      {learned ? 'Aprendido · rever cartão' : revealed ? 'Marcar como aprendido' : 'Revelar significado'}</button>
  </>
}

export function StudyDesk() {
  return <section className="rh-frame rh-section" id="pratica">
    <div className="rh-section-head"><Reveal><p className="rh-kicker">Prática</p><h2 className="rh-heading">O que ficou da leitura?</h2></Reveal>
      <p className="rh-description">Treine o ouvido com um trecho da história e relembre uma palavra. Experimente os dois exercícios.</p>
    </div>
    <div className="rh-practice"><article><ListeningPractice/></article><article><VocabularyPractice/></article></div>
  </section>
}

const skills = [
  { name:'Fala', value:81 }, { name:'Conversa', value:74 }, { name:'Vocabulário', value:68 },
  { name:'Ditado', value:59 }, { name:'Constância', value:90 },
]

export function ProgressReport() {
  return <section className="rh-frame rh-report" id="raio-x">
    <div><p className="rh-kicker">Raio-X do inglês</p><h2 className="rh-heading">Veja onde você avançou.</h2><p className="rh-description">Seu relatório reúne cinco habilidades e indica o que merece atenção na próxima sessão de estudo.</p>
      <Btn to="/prova" variant="white" arrow>Conhecer a prova de nível</Btn></div>
    <div className="rh-chart"><p>Perfil de habilidades <span>Exemplo de relatório</span></p>
      {skills.map(({name,value}) => <div key={name}><span>{name}</span><meter min="0" max="100" value={value} aria-label={name}/><b>{value}</b></div>)}
    </div>
  </section>
}
