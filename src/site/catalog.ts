import { COVERS, coverSrc as staticCover, type Cover } from './covers'
import CATALOG_JSON from './catalog.json'

export type Book = Cover & { description?: string }
/** Todos os livros da galeria (exportados do catálogo do app) + as capas do site que ainda não estão lá. */
export const CATALOG: Book[] = [
  ...(CATALOG_JSON as Book[]),
  ...COVERS.filter(c => !(CATALOG_JSON as Book[]).some(b => b.slug === c.slug)),
]
const inCatalog = new Set((CATALOG_JSON as Book[]).map(b => b.slug))
export const coverSrc = (slug: string) => inCatalog.has(slug) ? `/site/catalog/${slug}.webp` : staticCover(slug)
