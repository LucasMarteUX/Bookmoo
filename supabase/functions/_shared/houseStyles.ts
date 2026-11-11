// Estilo da casa usado quando nenhum estilo do banco serve ao livro: mangá refinado.
// Nunca imitamos o ilustrador original de um livro nem artistas nomeados.
import type { ArtDirection } from './comicEditorial.ts'

export const HOUSE_FIELDS = ['styleName', 'artStyle', 'lineWork', 'anatomy', 'coloring', 'camera', 'lettering', 'fonts', 'realism', 'avoid'] as const

export const MANGA_HOUSE_STYLE: Required<Pick<ArtDirection, typeof HOUSE_FIELDS[number]>> = {
  styleName: 'Bookmoo Refined Manga',
  artStyle: 'Original hand-drawn graphic novel illustration with refined Japanese manga sensibility: elegant, expressive and precise, with clean deliberate inking, crisp cel shading and soft painted backgrounds. Literary and sophisticated, never generic anime or mobile-game art.',
  lineWork: 'Fine, confident ink lines with tapered ends and controlled pressure variation: thin delicate strokes for hair strands, fabric folds and facial details, slightly heavier weight on outer silhouettes. Clean, intentional contours, no sketch noise, no uniform thickness.',
  anatomy: 'Refined manga anatomy: slender believable proportions, expressive eyes with clear highlights, small precise noses and mouths, strong readable emotions and hand gestures. Hair drawn in elegant flowing clumps. Faces stay consistent across panels.',
  coloring: 'Flat base colors with crisp one- or two-tone cel shadows and subtle soft gradients in skin and sky; light watercolor or gouache texture in backgrounds only. Restrained highlights, clear value separation between figures and setting.',
  camera: 'Dynamic manga storytelling: varied shot sizes, close-ups for emotion, wide establishing shots, purposeful angles and clear reading flow, with breathing room in each panel.',
  lettering: 'white',
  fonts: 'humanist',
  realism: 'illustrated',
  avoid: 'Imitating any named or original illustrator, photorealism, 3D or CGI, realistic digital painting, glossy plastic skin, chibi or super-deformed proportions, generic anime filter look, oversaturated neon colors, heavy texture overlays, lens flare, typography or borders inside the art.',
}
