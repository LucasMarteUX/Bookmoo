import { STYLE_FIELDS, cleanText, type ComicReference } from '../_shared/comicEditorial.ts'
import { isHistoricalRomanceStyle, usesRealisticLineArt } from '../_shared/comicStyle.ts'
import type { composeRows, resolvePlan } from './storyboard.ts'

export function imagePrompt(plan: ReturnType<typeof resolvePlan>, rows: ReturnType<typeof composeRows>, refs: ComicReference[], continuity: number, feedback?: string) {
  const { style, context, cast, beats } = plan
  const detailed = usesRealisticLineArt(style)
  const styleReference = refs.some(ref => ref.type === 'style')
  const historicalRomance = isHistoricalRomanceStyle(style) && !styleReference
  const art = STYLE_FIELDS.flatMap(k => k !== 'lettering' && k !== 'fonts' && style[k] ? [`${k}: ${cleanText(style[k], 550)}`] : []).join('\n')
  const referenceNotes = refs.map((ref, i) =>
    `Image ${i + 1} (${i === 0 ? 'primary, ' : ''}${ref.type}): ${cleanText(ref.instructions, 400) || 'use only for the named role'}`,
  ).join('\n')
  let panelIndex = 0
  const composition = rows.map((row, i) => {
    const widths = row.rightStack ? [row.cols[0], row.cols[1], row.cols[1]] : row.cols
    const panels = widths.map((width) => {
      const beat = beats[panelIndex++]
      const { dialogue, cast: ids, sourceSentenceIds: _source, reservation: _reservation, ...direction } = beat
      const quietAreas = dialogue.map(line => {
        const region = line.preferredPosition.replace('-', ' ')
        if (line.balloonType === 'caption' && line.text.length > 160) {
          return `Compose an area of low-contrast painted scenery for a narration box of about ${line.text.length} characters in the ${region}. Keep faces and the focal gesture or story object clear of it. Include subdued environmental detail from the setting, with a wider quiet area for longer captions.`
        }
        const breadth = line.text.length > 65 ? 'broad' : 'small'
        const subject = line.speakerName && line.attribution === 'confirmed'
          ? ' Leave ' + line.speakerName + ' visibly adjacent to this region.'
          : ''
        return 'Keep a ' + breadth + ' area of painted scenery in the ' + region + ' visually quiet.' + subject
      })
      return `Panel ${panelIndex}, ${Math.round(width * 100)}% row width: ${JSON.stringify(direction)}
Cast: ${cast.filter(c => ids.includes(c.id)).slice(0, 8).map(c => `${cleanText(c.name, 100)} — ${cleanText(c.visualDescription, 250)}`).join('; ')}
${quietAreas.join(' ')}`
    })
    if (row.rightStack) {
      return `Band ${i + 1}, ${Math.round(row.h * 100)}% page height. A single tall panel fills the left column. The right column has two stacked panels of equal height. Reading order is the tall left panel, then top right, then bottom right.
${panels.join('\n')}`
    }
    return `Row ${i + 1}, ${Math.round(row.h * 100)}% page height:\n${panels.join('\n')}`
  }).join('\n')

  return `Create the original unlettered art for ONE portrait 2:3 comic page, exactly ${beats.length} panels.
${historicalRomance ? 'MEDIUM: contemporary hand-inked color manga, with the graphic look of painted 2D animation cels over transparent watercolor scenery. This visual treatment has priority over all scene descriptions. Draw faces with distinct ink silhouettes, a simplified nose shape, clean cheek planes, graphic expressive eyes and broad grouped hair locks. On faces and clothing use only two discrete tones per local color: a flat base and one hard-edged cel shadow. Keep skin matte and untextured, with zero realistic gradation, wrinkles rendered by a few lines, and clean large eyes. Keep the entire page bright and airy in pale sage green, sky blue, dusty rose and ivory. Use warm brown only as a small accent. Paint scenery as a few large light watercolor shapes and omit fine background texture, stonework, ornament, and fabric patterns. Keep intricate costume texture, architecture and crowds deliberately simplified. People should read like distinctly stylized drawn animation characters. Crowds are loosely painted silhouettes and the emphasis stays on clean foreground outlines and expression. No sepia, realistic portraiture, historical oil painting, brown cinematic color grading or textured realism.' : ''}
Use visibly drawn line art, expressive illustrated faces and clear graphic shapes. Render as a comic illustration in every genre. Reject cinematic photography, photographic rendering and 3D surfaces.
${detailed ? 'Use convincing anatomical proportions and more deliberate ink detail, while keeping clearly drawn linework and illustrated shading.' : 'Use stylized proportions, clear color shapes and restrained surface detail.'}
Respect the action, chronology and character relationships. Render only the events listed in the panel plan.
Art direction for this book:
${art}
Historical and narrative context (for accuracy, not rendering style): ${JSON.stringify(context)}
${styleReference ? 'Match the drawing language of the style reference: compare contour weight, facial construction, shadow shapes, degree of simplification and color values. Reinterpret the source scene entirely with this visual language. Ignore every word, lettering mark, balloon, tail and caption box in the reference.' : ''}
${referenceNotes ? `User reference priority follows this order. Apply each image only for its designated role. Honor the references over generic style preferences while preserving the book’s identities and narrative. Do not reproduce an existing page, unrelated character, dialogue or composition.\n${referenceNotes}` : ''}
${continuity ? `CONTINUITY — the last ${continuity === 1 ? 'image is an earlier page' : `${continuity} images are earlier pages`} of this same book. Every recurring character MUST look identical to how they appear there: same face shape, eyes, nose, eyebrows, hairstyle, hair colour and length, skin tone, age, height, build and signature clothing (unless the text says they changed clothes). Secondary characters keep their look as strictly as the protagonist. Also match the palette, line weight, shading and rendering of those pages. Use them only for appearance and style: do not copy their compositions, panels, white shapes or lettering.` : ''}
CHARACTER SHEET — draw these people exactly as described, identically in every panel where they appear:
${cast.filter(c => beats.some(b => b.cast.includes(c.id))).slice(0, 10).map(c => `• ${cleanText(c.name, 100)}: ${cleanText(c.visualDescription, 420)}`).join('\n') || '• (no recurring characters on this page)'}
Every panel interior is painted edge to edge. Draw actors with expressive eyes, eyebrows, mouth, hands, posture and distinct lines of sight. Clothing follows the date of each scene. Use clean white gutters and black borders. Keep rectangular panel bounds and the specified row structure, with storytelling-driven framing inside each panel. Every numbered panel is a single undivided image. Do not add inserts, subpanels, montages, or extra borders.
${composition}
Paint the entire scene, including the quieter areas. Use subdued but recognizable details such as window frames, wood grain, distant furniture, masonry, foliage or clouds. Continue the same perspective, lighting and brushwork into the quieter areas. Keep faces, the main subject and significant objects clear of the lettering areas. Avoid blank patches, flat placeholder shapes, cutouts, bubbles, boxes or lettering marks. Do not draw an overlay or placeholder.
${feedback ? 'Correction for this pass: ' + cleanText(feedback, 300) : ''}
Draw only the art. No lettering, captions, balloons, symbols resembling text, sound effects, signatures, or signage. Papers, envelopes, book covers and storefronts must be completely blank and contain no visible handwriting or printing.`
}
