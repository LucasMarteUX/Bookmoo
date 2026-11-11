// Lettering themes: font, caption/balloon look and word highlight for the comic reader.
// Picked automatically from the book's art direction; the reader can override it per book.
import type { StyleDocument } from '../../supabase/functions/_shared/comicEditorial'

export type LetteringThemeId = 'classic' | 'adventure' | 'tech' | 'romance' | 'noir' | 'manga' | 'fantasy' | 'kids' | 'superhero' | 'horror' | 'modern'

export type LetteringTheme = {
  id: LetteringThemeId
  label: { pt: string; en: string }
  /** One-line description for the picker. */
  blurb: { pt: string; en: string }
  /** Background of the picker preview (evokes the kind of art it suits). */
  scene: string
  uppercase?: boolean
  font: string
  weight: number
  ink: string
  stroke: number
  /** Hard offset shadow (0 = none) and its colour. */
  shadow: number
  shadowColor: string
  caption: { top: string; bottom: string; text: string; border: string; radius: number; inner?: string }
  speech: { center: string; edge: string; text: string; border: string }
  /** Current word while reading / selected word. */
  highlight: { bg: string; ring: string; text?: string }
}

export const LETTERING_THEMES: Record<LetteringThemeId, LetteringTheme> = {
  classic: {
    id: 'classic', blurb: { pt: 'Gibi tradicional, leve e legível', en: 'Traditional comic, light and legible' }, scene: 'linear-gradient(135deg,#5b7db1,#e6b65c)', label: { pt: 'Clássico', en: 'Classic' },
    font: '"Comic Neue", "Trebuchet MS", sans-serif', weight: 700,
    ink: '#1d1a16', stroke: 0.0024, shadow: 0.004, shadowColor: 'rgba(0,0,0,0.38)',
    caption: { top: '#fffbe9', bottom: '#fdeeb8', text: '#1d1a16', border: '#1d1a16', radius: 0.005, inner: 'rgba(29,26,22,0.18)' },
    speech: { center: '#ffffff', edge: '#f4f1ea', text: '#1d1a16', border: '#1d1a16' },
    highlight: { bg: '#ffe066', ring: '#e8590c' },
  },
  adventure: {
    id: 'adventure', blurb: { pt: 'Letra de mão e cores quentes', en: 'Hand lettering and warm colours' }, scene: 'linear-gradient(135deg,#2f6b3a,#d9822b)', label: { pt: 'Aventura', en: 'Adventure' },
    font: '"Patrick Hand", "Comic Neue", sans-serif', weight: 400,
    ink: '#24160c', stroke: 0.0032, shadow: 0.006, shadowColor: 'rgba(60,25,0,0.55)',
    caption: { top: '#ffe08a', bottom: '#ffb547', text: '#2a1608', border: '#24160c', radius: 0.002, inner: 'rgba(255,255,255,0.45)' },
    speech: { center: '#fffdf4', edge: '#fbefd2', text: '#24160c', border: '#24160c' },
    highlight: { bg: '#ff7a1a', ring: '#24160c', text: '#ffffff' },
  },
  tech: {
    id: 'tech', blurb: { pt: 'Ficção científica, telas e neon', en: 'Sci-fi, screens and neon' }, scene: 'linear-gradient(135deg,#0b1430,#5b2a86)', label: { pt: 'Tecnológico', en: 'Tech' },
    font: '"Rajdhani", "Roboto Condensed", sans-serif', weight: 600,
    ink: '#0b1a2e', stroke: 0.0022, shadow: 0.003, shadowColor: 'rgba(0,229,255,0.35)',
    caption: { top: '#0f2540', bottom: '#081627', text: '#d6f6ff', border: '#38e1ff', radius: 0, inner: 'rgba(56,225,255,0.35)' },
    speech: { center: '#ffffff', edge: '#e6f4fb', text: '#0b1a2e', border: '#0b1a2e' },
    highlight: { bg: '#38e1ff', ring: '#0b1a2e', text: '#06121f' },
  },
  romance: {
    id: 'romance', blurb: { pt: 'Serifa elegante e tons de pergaminho', en: 'Elegant serif and parchment tones' }, scene: 'linear-gradient(135deg,#e7c6c8,#b9cfc0)', label: { pt: 'Romance histórico', en: 'Historical romance' },
    font: '"Lora", Georgia, serif', weight: 600,
    ink: '#4a3326', stroke: 0.0016, shadow: 0.0025, shadowColor: 'rgba(74,51,38,0.22)',
    caption: { top: '#fbf4e6', bottom: '#f1e2c6', text: '#3d2a1f', border: '#8a6a52', radius: 0.008, inner: 'rgba(138,106,82,0.35)' },
    speech: { center: '#fffdf8', edge: '#f8efe2', text: '#3d2a1f', border: '#6b4e3d' },
    highlight: { bg: '#f6c9d4', ring: '#b5576f' },
  },
  noir: {
    id: 'noir', blurb: { pt: 'Máquina de escrever, alto contraste', en: 'Typewriter, high contrast' }, scene: 'linear-gradient(135deg,#1b1b1b,#6b6b6b)', label: { pt: 'Suspense', en: 'Noir / thriller' },
    font: '"Special Elite", "Courier New", monospace', weight: 400,
    ink: '#0a0a0a', stroke: 0.0028, shadow: 0, shadowColor: 'transparent',
    caption: { top: '#151515', bottom: '#050505', text: '#f2f2f2', border: '#f2f2f2', radius: 0, inner: 'rgba(255,255,255,0.25)' },
    speech: { center: '#ffffff', edge: '#ececec', text: '#0a0a0a', border: '#0a0a0a' },
    highlight: { bg: '#e03131', ring: '#0a0a0a', text: '#ffffff' },
  },
  manga: {
    id: 'manga', blurb: { pt: 'Balões brancos e traço fino', en: 'White balloons, thin lines' }, scene: 'linear-gradient(135deg,#f3f3f3,#bdbdbd)', label: { pt: 'Mangá', en: 'Manga' },
    font: '"M PLUS Rounded 1c", "Comic Neue", sans-serif', weight: 700,
    ink: '#111111', stroke: 0.0018, shadow: 0, shadowColor: 'transparent',
    caption: { top: '#ffffff', bottom: '#ffffff', text: '#111111', border: '#111111', radius: 0.002 },
    speech: { center: '#ffffff', edge: '#ffffff', text: '#111111', border: '#111111' },
    highlight: { bg: '#ffd8e8', ring: '#e64980' },
  },
  fantasy: {
    id: 'fantasy', blurb: { pt: 'Reinos, magia e pergaminho', en: 'Kingdoms, magic and parchment' }, scene: 'linear-gradient(135deg,#1f3d2b,#8a6d3b)',
    label: { pt: 'Fantasia', en: 'Fantasy' },
    font: '"Alegreya", Georgia, serif', weight: 700,
    ink: '#2b2116', stroke: 0.0022, shadow: 0.004, shadowColor: 'rgba(40,25,10,0.4)',
    caption: { top: '#f4e7c5', bottom: '#e2c98f', text: '#2b2116', border: '#5a4325', radius: 0.004, inner: 'rgba(90,67,37,0.45)' },
    speech: { center: '#fffaf0', edge: '#f3e8d0', text: '#2b2116', border: '#3b2c1a' },
    highlight: { bg: '#7fd1a8', ring: '#1f5c3f', text: '#0e2a1c' },
  },
  kids: {
    id: 'kids', blurb: { pt: 'Arredondado, alegre e colorido', en: 'Rounded, cheerful and colourful' }, scene: 'linear-gradient(135deg,#7ed6f7,#ffb3d9)',
    label: { pt: 'Infantil', en: 'Kids' },
    font: '"Fredoka", "Comic Neue", sans-serif', weight: 600,
    ink: '#2d2a5a', stroke: 0.0028, shadow: 0.005, shadowColor: 'rgba(45,42,90,0.35)',
    caption: { top: '#fff3b0', bottom: '#ffd86b', text: '#2d2a5a', border: '#2d2a5a', radius: 0.012 },
    speech: { center: '#ffffff', edge: '#f2f6ff', text: '#2d2a5a', border: '#2d2a5a' },
    highlight: { bg: '#a5f3c4', ring: '#2d2a5a' },
  },
  superhero: {
    id: 'superhero', blurb: { pt: 'Caixa-alta, impacto e ação', en: 'All caps, impact and action' }, scene: 'linear-gradient(135deg,#c92a2a,#1c4fd8)',
    label: { pt: 'Super-herói', en: 'Superhero' },
    font: '"Bangers", "Comic Neue", sans-serif', weight: 400, uppercase: true,
    ink: '#101010', stroke: 0.0034, shadow: 0.006, shadowColor: 'rgba(0,0,0,0.6)',
    caption: { top: '#ffe14d', bottom: '#ffc400', text: '#101010', border: '#101010', radius: 0 },
    speech: { center: '#ffffff', edge: '#f5f5f5', text: '#101010', border: '#101010' },
    highlight: { bg: '#ff3b3b', ring: '#101010', text: '#ffffff' },
  },
  horror: {
    id: 'horror', blurb: { pt: 'Sombrio, serifa antiga e vermelho', en: 'Dark, old serif and red' }, scene: 'linear-gradient(135deg,#120606,#4a0d12)',
    label: { pt: 'Terror', en: 'Horror' },
    font: '"Crimson Pro", Georgia, serif', weight: 700,
    ink: '#120a0a', stroke: 0.0024, shadow: 0.003, shadowColor: 'rgba(120,0,0,0.45)',
    caption: { top: '#1d1212', bottom: '#0c0606', text: '#efe3e3', border: '#8f1d24', radius: 0, inner: 'rgba(143,29,36,0.5)' },
    speech: { center: '#f7f1ea', edge: '#e5dacd', text: '#120a0a', border: '#120a0a' },
    highlight: { bg: '#8f1d24', ring: '#f7f1ea', text: '#ffffff' },
  },
  modern: {
    id: 'modern', blurb: { pt: 'Limpo, sem sombra, foco na leitura', en: 'Clean, shadowless, reading first' }, scene: 'linear-gradient(135deg,#dfe7ef,#9fb3c8)',
    label: { pt: 'Moderno', en: 'Modern' },
    font: '"Nunito", system-ui, sans-serif', weight: 800,
    ink: '#1f2933', stroke: 0.0016, shadow: 0, shadowColor: 'transparent',
    caption: { top: '#ffffff', bottom: '#f4f6f8', text: '#1f2933', border: '#cbd2d9', radius: 0.01 },
    speech: { center: '#ffffff', edge: '#ffffff', text: '#1f2933', border: '#9aa5b1' },
    highlight: { bg: '#c3dafe', ring: '#3b6fd8' },
  },
}

const RULES: [LetteringThemeId, RegExp][] = [
  ['superhero', /superhero|super-hero|marvel|caped|vigilante/i],
  ['horror', /horror|terror|gothic horror|vampire|zombie|haunted|occult/i],
  ['kids', /storybook|children|kids|picture book|middle grade|cartoon for kids/i],
  ['fantasy', /fantasy|medieval|dragon|wizard|sorcer|elf|elves|kingdom|myth/i],
  ['manga', /manga|anime|shōnen|shonen|shōjo|shojo/i],
  ['tech', /sci-?fi|science fiction|cyber|futur|dystop|virtual|space|neon|robot|tech|digital|hologra/i],
  ['noir', /noir|thriller|suspense|mystery|crime|detective/i],
  ['romance', /regency|victorian|edwardian|historical romance|romance|period drama|18\d\d|17\d\d|ballroom|aristocra/i],
  ['adventure', /adventure|action|pirate|quest|western|jungle|treasure|explor/i],
]

/** Tema de balão de cada estilo do banco. */
const BANK_THEMES: Record<string, LetteringThemeId> = {
  'aquarela-nanquim': 'classic', 'fantasia-epica': 'fantasy', 'fantasia-sombria': 'fantasy', 'terror-gotico': 'horror',
  'ficcao-cientifica': 'tech', cyberpunk: 'tech', 'romance-aquarela': 'romance', 'pintura-historica': 'romance',
  'noir-misterio': 'noir', 'thriller-cinematografico': 'noir', 'manga-tradicional': 'manga', 'anime-colorido': 'manga',
  'hq-americana': 'superhero', 'hq-europeia': 'adventure', 'infantil-guache': 'kids', 'realismo-magico': 'fantasy',
}

/** Theme implied by the book's art direction and research. */
export function detectLetteringTheme(style?: StyleDocument | null): LetteringThemeId {
  if (!style) return 'classic'
  if (style.styleId && BANK_THEMES[style.styleId]) return BANK_THEMES[style.styleId]
  const text = [style.styleName, style.artStyle, style.lettering, style.era, style.world, style.technology, style.mood, style.aesthetics]
    .filter(Boolean).join(' ')
  return RULES.find(([, re]) => re.test(text))?.[0] ?? 'classic'
}

export function letteringThemeFor(style?: (StyleDocument & { letteringTheme?: string }) | null): LetteringTheme {
  const chosen = style?.letteringTheme as LetteringThemeId | undefined
  return LETTERING_THEMES[chosen && chosen in LETTERING_THEMES ? chosen : detectLetteringTheme(style)]
}
