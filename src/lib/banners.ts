// Banners do perfil. Só tokens do design system, por isso funcionam nos três temas.
// O id fica salvo em profiles.banner.

export type Banner = {
  id: string
  pt: string
  en: string
  background: string
  illustration: string
}

const dots = 'radial-gradient(color-mix(in srgb, var(--theme-text) 7%, transparent) 1px, transparent 1.2px) 0 0 / 14px 14px'

export const BANNERS: Banner[] = [
  { id: 'paper', pt: 'Papel', en: 'Paper', illustration: 'work', background: `${dots}, linear-gradient(120deg, var(--pastel-sand-bg) 0%, var(--theme-bg) 100%)` },
  { id: 'lavender', pt: 'Lavanda', en: 'Lavender', illustration: 'reading', background: `${dots}, linear-gradient(120deg, var(--pastel-lavender-bg) 0%, var(--pastel-blue-bg) 100%)` },
  { id: 'sage', pt: 'Sálvia', en: 'Sage', illustration: 'hiking', background: `${dots}, linear-gradient(120deg, var(--pastel-green-bg) 0%, var(--pastel-sand-bg) 100%)` },
  { id: 'sunset', pt: 'Entardecer', en: 'Sunset', illustration: 'meditation', background: `${dots}, linear-gradient(120deg, var(--pastel-amber-bg) 0%, var(--pastel-rose-bg) 100%)` },
  { id: 'sky', pt: 'Céu', en: 'Sky', illustration: 'launch', background: `${dots}, linear-gradient(120deg, var(--pastel-blue-bg) 0%, var(--pastel-lavender-bg) 100%)` },
  { id: 'rose', pt: 'Rosa', en: 'Rose', illustration: 'high-five', background: `${dots}, linear-gradient(120deg, var(--pastel-rose-bg) 0%, var(--pastel-lavender-bg) 100%)` },
  { id: 'chat', pt: 'Conversa', en: 'Chat', illustration: 'chatting', background: `${dots}, linear-gradient(120deg, var(--pastel-green-bg) 0%, var(--pastel-blue-bg) 100%)` },
  { id: 'team', pt: 'Turma', en: 'Crew', illustration: 'teamworks', background: `${dots}, linear-gradient(120deg, var(--pastel-amber-bg) 0%, var(--pastel-green-bg) 100%)` },
]

export const DEFAULT_BANNER = BANNERS[0]

export function bannerOf(id: string | undefined): Banner {
  return BANNERS.find(item => item.id === id) ?? DEFAULT_BANNER
}
