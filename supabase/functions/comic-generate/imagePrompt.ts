import { STYLE_FIELDS, cleanText, type ComicReference } from '../_shared/comicEditorial.ts'
import { isHistoricalRomanceStyle, usesRealisticLineArt } from '../_shared/comicStyle.ts'
import { BOOK_FIELDS, contentOnly, fitStyle, masterStyle } from '../_shared/styleBank.ts'
import type { composeRows, resolvePlan } from './storyboard.ts'
import { describeFrame, framesFromRows, type Frame } from '../_shared/comicLayouts.ts'

type LayoutInput = ReturnType<typeof composeRows> | Frame[]
const toFrames = (layout: LayoutInput): Frame[] => layout.length && 'cols' in layout[0] ? framesFromRows(layout as ReturnType<typeof composeRows>) : layout as Frame[]

/** Corta texto longo sem quebrar o pedido (o limite da API é 32 mil caracteres no total). */
const clip = (text: string, max: number) => text.length > max ? text.slice(0, max) + '…' : text

export function imagePrompt(plan: ReturnType<typeof resolvePlan>, rows: LayoutInput, refs: ComicReference[], continuity: number, feedback?: string, bankPrompt?: string | null, sample = false): string {
  // Páginas densas (até 9 quadros): encurta a descrição de cada quadro antes de cortar qualquer coisa. Antes o corte final
  // apagava os últimos quadros inteiros.
  for (const panelClip of [1400, 1000, 700, 450]) {
    const out = buildPrompt(plan, rows, refs, continuity, feedback, bankPrompt, sample, panelClip)
    if (out.length <= 30_000) return out
  }
  // Trava final: nunca passa do limite. Preserva o fim (as regras de "sem texto") e corta antes dele.
  const full = buildPrompt(plan, rows, refs, continuity, feedback, bankPrompt, sample, 350)
  if (full.length <= 30_000) return full
  const tail = full.slice(full.lastIndexOf('\nDraw only the art.'))
  return full.slice(0, 30_000 - tail.length) + tail
}

function buildPrompt(plan: ReturnType<typeof resolvePlan>, rows: LayoutInput, refs: ComicReference[], continuity: number, feedback: string | undefined, bankPrompt: string | null | undefined, sample: boolean, panelClip: number) {
  const { style, context, cast, beats } = plan
  const detailed = usesRealisticLineArt(style)
  const styleReference = refs.some(ref => ref.type === 'style')
  // Estilo do banco: o super prompt vai inteiro e manda na técnica, na cor e na luz. Do livro ficam só cenário e figurino.
  // O pedido inteiro tem limite de 32 mil caracteres: o estilo entra no espaço que sobrar (ver no fim).
  const SLOT = '\u0000MASTER_STYLE\u0000'
  const bank = bankPrompt ? SLOT : ''
  const historicalRomance = !bank && isHistoricalRomanceStyle(style) && !styleReference
  const artFields: readonly string[] = bank ? BOOK_FIELDS : STYLE_FIELDS.filter(k => k !== 'lettering' && k !== 'fonts')
  const art = artFields.flatMap(k => {
    const raw = style[k as keyof typeof style]
    if (!raw || typeof raw !== 'string') return []
    const value = bank ? contentOnly(cleanText(raw, 550)) : cleanText(raw, 550)
    return value ? [`${k}: ${value}`] : []
  }).join('\n')
  const first = sample ? 2 : 1
  const referenceNotes = refs.map((ref, i) =>
    `Image ${i + first} (${i === 0 ? 'primary, ' : ''}${ref.type}): ${cleanText(ref.instructions, 400) || 'use only for the named role'}`,
  ).join('\n')
  const frames = toFrames(rows)
  const composition = frames.map((frame, index) => {
    const beat = beats[index]
    if (!beat) return ''
    const { dialogue, cast: ids, sourceSentenceIds: _source, reservation: _reservation, shape: _shape, breakout: _breakout, ...direction } = beat
    // Contrato com o letreiro: o leitor põe UMA caixa por quadro, no canto da primeira fala.
    // A arte reserva exatamente esse canto, do tamanho do texto somado do quadro.
    const quietAreas = (() => {
      if (!dialogue.length) return [] as string[]
      const region = dialogue[0].preferredPosition.replace('-', ' ')
      const chars = dialogue.reduce((sum, line) => sum + line.text.length, 0)
      const share = chars > 220 ? 'about a third of the panel' : chars > 90 ? 'about a quarter of the panel' : 'about a sixth of the panel'
      const speaker = dialogue.find(line => line.balloonType !== 'caption' && line.speakerName && line.attribution === 'confirmed')
      return [
        `Text area: the ${region} corner of this panel (${share}) is reserved for a lettering box placed later.` +
        ' Fill it with calm, low-detail, low-contrast background that continues the scene (sky, wall, foliage, floor) in the same style.' +
        ' No faces, hands, eyes, characters or key story objects may enter that corner; keep the main action toward the opposite side and the panel centre.' +
        (speaker ? ` Place ${speaker.speakerName} on the same side of the panel as that corner, head clearly visible and not cropped, so a short tail can point to them.` : ''),
      ]
    })()
    return `${describeFrame(frame, index, frames)}
Content: ${clip(JSON.stringify(direction), panelClip)}
Cast: ${cast.filter(c => ids.includes(c.id)).slice(0, 8).map(c => `${cleanText(c.name, 100)} — ${cleanText(c.visualDescription, 250)}`).join('; ')}
${quietAreas.join(' ')}`
  }).filter(Boolean).join('\n')

  const prompt = `Create the original unlettered art for ONE portrait 2:3 comic page, exactly ${beats.length} panels.
${historicalRomance ? 'MEDIUM: contemporary hand-inked color manga, with the graphic look of painted 2D animation cels over transparent watercolor scenery. This visual treatment has priority over all scene descriptions. Draw faces with distinct ink silhouettes, a simplified nose shape, clean cheek planes, graphic expressive eyes and broad grouped hair locks. On faces and clothing use only two discrete tones per local color: a flat base and one hard-edged cel shadow. Keep skin matte and untextured, with zero realistic gradation, wrinkles rendered by a few lines, and clean large eyes. Keep the entire page bright and airy in pale sage green, sky blue, dusty rose and ivory. Use warm brown only as a small accent. Paint scenery as a few large light watercolor shapes and omit fine background texture, stonework, ornament, and fabric patterns. Keep intricate costume texture, architecture and crowds deliberately simplified. People should read like distinctly stylized drawn animation characters. Crowds are loosely painted silhouettes and the emphasis stays on clean foreground outlines and expression. No sepia, realistic portraiture, historical oil painting, brown cinematic color grading or textured realism.' : ''}
${bank ? 'MASTER STYLE — this decides how everything is drawn, colored and lit:\n' + bank + (sample ? '\nSTYLE SAMPLE — image 1 shows this exact style and is the final authority on the look. Match it closely: line quality, color palette, brightness and saturation, shading, how faces, eyes and figures are constructed, level of detail, texture and overall finish. If anything else in this request seems to suggest a different look, image 1 and the MASTER STYLE win. Use image 1 only for HOW to draw: never copy its subject, people, animals, objects, setting or composition.' : '') + '\nIMAGE QUALITY: neutral white balance with pure clean whites and no overall yellow, sepia, beige or warm color cast (unless the master style itself is monochrome or asks for that light); sharp focus across every panel, crisp clean edges, no blur, no haze over the image, no smudges, no dirty or grainy overlay, no aged-paper look. Colors exactly as the style sample: as bright and saturated as it is. Express gloom, sadness or danger through composition, posture and the style\'s own palette, never through muddy brown, beige or gray desaturation. Never draw thought clouds, dream bubbles or vignette circles inside a panel.' + '\nThis is a new interpretation of the book. Do not imitate the illustrations of any existing edition, its original illustrator or any adaptation; draw everything in the master style above.\n' + '\nSEQUENTIAL PAGE MODE (explicitly requested): this page is a multi-panel layout. Where the master style asks for a single full-frame illustration or warns against panels, apply that to each panel individually: every panel is one complete illustration in this style. The plain panel borders and white gutters specified below are allowed; no other borders or frames. Apply this master style to every panel. The panel plan, cast and context decide what is depicted; the master style decides how it is drawn and painted.' : `Use visibly drawn line art, expressive illustrated faces and clear graphic shapes. Render as a comic illustration in every genre. Reject cinematic photography, photographic rendering and 3D surfaces.
${detailed ? 'Use convincing anatomical proportions and more deliberate ink detail, while keeping clearly drawn linework and illustrated shading.' : 'Use stylized proportions, clear color shapes and restrained surface detail.'}`}
Respect the action, chronology and character relationships. Render only the events listed in the panel plan.
${bank ? 'Places and clothing of this book (shapes, materials and period only; colors, palette, light and rendering come ONLY from the MASTER STYLE):' : 'Art direction for this book:'}
${art}
Historical and narrative context (for accuracy, not rendering style): ${clip(JSON.stringify(context), 2500)}
${styleReference ? 'Match the drawing language of the style reference: compare contour weight, facial construction, shadow shapes, degree of simplification and color values. Reinterpret the source scene entirely with this visual language. Ignore every word, lettering mark, balloon, tail and caption box in the reference.' : ''}
${referenceNotes ? `User reference priority follows this order. Apply each image only for its designated role. Honor the references over generic style preferences while preserving the book’s identities and narrative. Do not reproduce an existing page, unrelated character, dialogue or composition.\n${referenceNotes}` : ''}
${continuity ? `CONTINUITY — the last ${continuity === 1 ? 'image is an earlier page' : `${continuity} images are earlier pages`} of this same book. Every recurring character MUST look identical to how they appear there: same face shape, eyes, nose, eyebrows, hairstyle, hair colour and length, skin tone, age, height, build and signature clothing (unless the text says they changed clothes). Secondary characters keep their look as strictly as the protagonist. ${bank ? 'Use them only for who the characters are. The drawing style, palette, lighting and rendering come only from the MASTER STYLE above.' : 'Also match the palette, line weight, shading and rendering of those pages.'} Use them only for appearance${bank ? '' : ' and style'}: do not copy their compositions, panels, white shapes or lettering.` : ''}
CHARACTER SHEET — draw these people exactly as described, identically in every panel where they appear:
${cast.filter(c => beats.some(b => b.cast.includes(c.id))).slice(0, 10).map(c => `• ${cleanText(c.name, 100)}: ${cleanText(c.visualDescription, 420)}`).join('\n') || '• (no recurring characters on this page)'}
${bank ? 'Every panel interior is fully illustrated edge to edge in the MASTER STYLE.' : 'Every panel interior is painted edge to edge.'} Draw actors with expressive eyes, eyebrows, mouth, hands, posture and distinct lines of sight. Clothing follows the date of each scene. Use clean white gutters and simple thin dark panel borders. Follow the PAGE LAYOUT below exactly: every panel at its stated position and size, with its stated overlaps and diagonal borders, read left to right and top to bottom; panels of different sizes and formats are intentional, so do not equalize them or turn them into uniform strips. Frame the content of each panel for its format (wide panels spread action sideways, tall panels stack it vertically, small panels isolate one detail). Every numbered panel is a single undivided image. Do not add any panel, inset, subpanel or montage beyond those listed.
PAGE LAYOUT (positions as percentages of the full page; the outer white margin and gutters are already included):
${composition}
${bank ? 'Illustrate the entire scene, including the quieter areas, in the MASTER STYLE and with the same level of detail as the style sample. Quieter areas continue the background (sky, wall, foliage, floor) with the same perspective and light.' : 'Paint the entire scene, including the quieter areas. Use subdued but recognizable details such as window frames, wood grain, distant furniture, masonry, foliage or clouds. Continue the same perspective, lighting and brushwork into the quieter areas.'} Keep faces, the main subject and significant objects clear of the lettering areas. Avoid blank patches, flat placeholder shapes, cutouts, bubbles, boxes or lettering marks. Do not draw an overlay or placeholder.
${feedback ? 'Correction for this pass: ' + cleanText(feedback, 300) : ''}
Draw only the art. No lettering, captions, balloons, symbols resembling text, sound effects, signatures, or signage. Papers, envelopes, book covers, storefronts, gravestones, plaques and engraved inscriptions must be completely blank or show only abstract unreadable marks: no visible letters, names, dates or numbers.`
  // Limite da API de imagem: 32.000 caracteres por pedido. Usa até 30.000 para ter margem.
  const LIMIT = 30_000
  const base = bankPrompt ? prompt.replace(SLOT, '') : prompt
  const full = bankPrompt
    ? prompt.replace(SLOT, fitStyle(masterStyle(bankPrompt), Math.max(6_000, LIMIT - base.length)))
    : prompt
  return full
}
