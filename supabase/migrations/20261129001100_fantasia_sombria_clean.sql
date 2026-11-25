-- Fantasia sombria: as páginas saíam "poluídas e sujas" (teste: jantar em um salão, toda a página cinza-escura,
-- coberta de hachura e granulado, rostos e mesa afogados em textura). O prompt pedia hachura fina em toda sombra,
-- bordas serrilhadas e só cinza/vermelho em qualquer cena. Reescrito para o clima sombrio com acabamento limpo:
-- poucas linhas e bem colocadas, sombras em massas lisas, áreas calmas, rostos limpos e luz clara; a paleta escura
-- se adapta a interiores (luz de velas) sem virar lama.
update public.comic_styles set render_prompt = $p$STYLE: DARK FANTASY — CLEAN AND ELEGANT

IDENTITY
An elegant dark fantasy illustration in the spirit of a high-end graphic novel: moody, dramatic and atmospheric, but
CLEAN, polished and easy to read. Think refined ink line + smooth painted color with a few bold shadow shapes. The page
must look beautiful and premium, never dirty, gritty, noisy or overworked.

LINE
- Confident, clean ink contours of even quality around characters and key objects; slightly thicker outer lines,
  thinner inner lines.
- Use ink SPARINGLY: only to define shapes, faces, hands and important folds. No hatching on skin, walls, tablecloths
  or sky. At most a few short, deliberate hatch strokes inside the deepest shadows of clothing or stone.
- Faces and hands: clean, precise, elegant semi-realistic features; no stray lines, scratches or texture on skin.

RENDERING (MOST IMPORTANT)
- Smooth painted shading in large, simple value shapes: one light side, one shadow side, a soft transition. Shadows
  are flat, clean masses, not textured.
- Keep large CALM AREAS (walls, sky, tablecloth, floor, mist) with smooth gradients and almost no detail, so the eye
  rests and the characters stand out.
- Detail is concentrated on the focal point (faces, hands, the key object) and fades out toward the edges and the
  background. Background objects are simplified shapes.
- Absolutely no grain, noise, speckles, grunge, scratches, splatter, dirty smudges, paper texture or canvas texture.

COLOR AND VALUE
- Base palette: cool slate and charcoal grays, deep blue-black, ivory, with saturated crimson as the signature accent.
- Outdoors at night: crimson moon or sky glow, red rim light, cool gray mist.
- Indoors (halls, dinners, bedrooms, libraries): warm golden candle or fire light is allowed as the main light,
  balanced by cool blue-gray shadows; crimson in curtains, wine, cloth and details. The room is atmospheric, not black.
- Value structure: about half the page in clear midtones, faces and the focal point in the lightest values, darks only
  in a few graphic shapes. Never an all-dark, low-contrast, murky page.
- Colors are clean and clear; no brown wash, no sepia, no muddy gray-brown.

LIGHT
- One clear main light source per panel (moon, sky glow, candles, fireplace, window) that shapes the figures with
  clean highlights and a crisp rim light.
- Mist and fog are soft, smooth veils that separate depth planes, drawn clean (never smeared noise).

FIGURES AND FACES
- Elegant, well-proportioned figures; correct anatomy; readable poses and silhouettes.
- Faces are always clearly lit and readable, with clean skin and expressive eyes, even in dark scenes.
- Acting fits the story moment: brooding and tense in dark moments, warm smiles at a celebration.

ENVIRONMENTS
- Gothic halls, candlelit dining rooms, libraries, ruins, cliffs, graveyards and stormy skies, built from clear,
  simplified architectural shapes.
- Busy scenes (a full dinner table, a crowd) are simplified: fewer objects, grouped into clear shapes, with empty
  space around the main characters.

PANELS
- Every panel shares the same palette and lighting logic. Keep sky, wall or mist areas calm and smooth where the
  text box will sit.

MUST AVOID
Dirty or gritty textures, grain, noise, scratches, heavy cross-hatching everywhere, overworked detail, cluttered
compositions, all-dark murky pages, muddy brown or sepia tones, smeared oil-paint look, blur, flat lifeless
lighting, cute cartoon proportions, photorealism, 3D render look.$p$ where id = 'fantasia-sombria';
