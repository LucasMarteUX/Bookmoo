export const REFERENCE_BUCKET = 'comic-references'
export const REFERENCE_LIMIT = 6
export const REFERENCE_BYTES = 2 * 1024 * 1024
export const REFERENCE_TYPES = ['style', 'character', 'setting', 'palette'] as const
export const REFERENCE_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export type ComicReference = {
  id: string
  name: string
  file: string
  type: typeof REFERENCE_TYPES[number]
  instructions: string
}

export const STYLE_FIELDS = [
  'styleName', 'artStyle', 'lineWork', 'anatomy', 'costume', 'coloring', 'palette',
  'lighting', 'setting', 'camera', 'lettering', 'fonts', 'realism', 'avoid',
] as const

export type ArtDirection = Partial<Record<typeof STYLE_FIELDS[number], string>>
export type StyleDocument = ArtDirection & {
  world?: string
  socialContext?: string
  protagonistHome?: string
  locations?: string
  technology?: string
  characters?: string
  era?: string
  mood?: string
  colors?: string
  lineStyle?: string
  aesthetics?: string
  revision?: string
  /** Estilo do banco (comic_styles.id). Ausente = mangá refinado da casa. */
  styleId?: string
  /** Reader's lettering theme choice (classic, adventure, tech…); absent = detected from the art direction. */
  letteringTheme?: string
  references?: ComicReference[]
  research?: { fingerprint: string; defaults: ArtDirection; sources: { title: string; url: string }[]; styleId?: string | null }
}

export type Character = { id?: string; name: string; visualDescription: string; firstPage?: number }
export type Point = { x: number; y: number }
export type Rect = Point & { w: number; h: number }
export type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export const BALLOON_TYPES = ['speech', 'thought', 'caption', 'expressive'] as const
export type BalloonType = typeof BALLOON_TYPES[number]

export type Dialogue = {
  id: string
  panelId: string
  speakerId: string | null
  speakerName: string | null
  text: string
  emotion: string
  delivery: string
  sourceSentenceIds: number[]
  charStart: number
  charEnd: number
  sourceParts?: { start: number; end: number }[]
  preferredPosition: Position
  targetAnchor: Point | null
  balloonType: BalloonType
  readingOrder: number
  attribution: 'confirmed' | 'ambiguous' | 'off-panel' | 'narration'
}

export type VisualBeat = {
  id: string
  sourceSentenceIds: number[]
  action: string
  cast: string[]
  focal: string
  emotion: string
  expression: string
  posture: string
  gaze: string
  relationship: string
  setting: string
  framing: string
  importance: string
  period: string
  reservation: string
  dialogue: Dialogue[]
}

export type StoryContext = { confirmed: string; inferred: string; unknown: string; continuity: string; source?: 'excerpt-and-model'; pageKind?: 'front-matter' }
export type VisibleCharacter = { speakerId: string; face: Rect; body?: Rect }
export type PanelInspection = {
  panelId: string
  bounds: Rect
  faces: VisibleCharacter[]
  free: Rect[]
  focus?: Rect[]
  replacement?: { imageUrl: string; generationId: string }
}
export type ComicInspection = { panels: PanelInspection[]; aspect: number; issues: string[] }
export type PlacedDialogue = Dialogue & { box: Rect | null; font: number }
export type ComicReflow = {
  aspect: number
  panels: { panelId: string; bounds: Rect; art: Rect }[]
}
export type ComicRow = { h: number; cols: number[]; rightStack?: true }
export type GenerationRecord = {
  id: string
  createdAt: string
  provider: string
  styleRevision: string
  style: ArtDirection
  references: ComicReference[]
  composition?: ComicRow[]
  panelId?: string
  imageUrl?: string
}
export type EditorialLayout = {
  v: 3
  panels: PanelInspection[]
  beats: VisualBeat[]
  context: StoryContext
  balloons: PlacedDialogue[]
  reflow?: ComicReflow
  issues: string[]
  generation: GenerationRecord
  history?: GenerationRecord[]
  editRevision?: string
  appearance?: Pick<ArtDirection, 'lettering' | 'fonts'>
  quality?: 'validated' | 'needs-review'
  /** 'lines' = caixas retangulares, uma por fala/narração, mostradas uma por vez (sem balões). */
  lettering?: 'lines'
  /** Posição escolhida pelo leitor para o selo de quem fala: chave "panelId:speakerId", canto superior esquerdo relativo ao quadro (0–1). */
  speakerChips?: Record<string, Point>
}

export function cleanText(value: unknown, limit = 700) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

export function rect(value: unknown): Rect | null {
  if (!value || typeof value !== 'object') return null
  const { x, y, w, h } = value as Rect
  if (![x, y, w, h].every(Number.isFinite) || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1.000001 || y + h > 1.000001) return null
  return { x, y, w, h }
}
