-- Reescrita completa de 3 estilos que ainda saíam "sujos" (textura de óleo, musgo, granulado, tons apagados) no teste
-- real de 25/11: Pintura Histórica (Great Expectations), Fantasia Épica (The Lost World) e os cenários da Aquarela &
-- Nanquim (The Secret Garden). As palavras "painting/painterly" puxavam o modelo para a pintura a óleo texturizada; os
-- novos textos descrevem ilustração limpa e luminosa, com superfícies lisas e cenários simplificados.
update public.comic_styles set render_prompt = $p$STYLE: CLASSIC PERIOD ILLUSTRATION — CLEAN, LUMINOUS AND ELEGANT

IDENTITY
A refined classic-literature illustration in a clean, modern, high-end storybook finish: elegant period characters, stately homes, gardens, villages and churches, all bathed in fresh daylight. It looks polished, bright and beautiful, like a premium illustrated edition printed today. Smooth, clean surfaces everywhere. Absolutely nothing dirty, gritty, weathered or textured.

RENDERING
- Clean digital illustration with smooth soft shading: each form has a clear base color, a soft shadow and a gentle highlight, blended smoothly.
- Edges are crisp and clean; subtle fine contour lines may define faces, hands and clothing.
- Surfaces are SMOOTH: no brushstroke texture, no canvas, no grain, no noise, no speckles, no scratches.
- Detail is selective: faces, hands, costumes and the focal object are detailed; backgrounds are simplified into clean shapes and soft gradients.

COLOR
- Bright, fresh, harmonious palette: sky blue, soft white clouds, fresh spring greens, ivory and cream, pale rose, lavender, slate blue, navy, soft gold accents.
- Colors are clean and luminous; shadows are cool and transparent (soft blue, lilac, blue-green).
- Brown, beige, olive, khaki and gray together must stay a small part of the image.

LIGHT
- Clear, soft daylight with a fresh, airy atmosphere; gentle sunlight on faces; luminous skies.
- Even overcast or sad scenes keep a clean silver-blue light and remain bright and readable.

FACES AND FIGURES
- Elegant, attractive, gently idealized faces with clean features, clear expressive eyes and smooth luminous skin.
- Children are cute and expressive; adults graceful; period costume and hairstyles accurate to each scene.
- Clothing in clean clear colors (slate blue, sage, cream, rose, navy) with smooth folds.

MATERIALS
- Stone (walls, gravestones, churches, manors): smooth pale gray, cream or warm white shapes with a few clean edges; no moss, no lichen, no stains, no cracks, no weathering texture.
- Wood: smooth, clean, light-to-mid tones with a soft sheen; no grain texture.
- Grass and foliage: clean masses of fresh green with soft highlights and a few crisp leaf shapes; flowers as clean bright color dots.
- Sky: smooth gradient from light blue to white with soft clean clouds.
- Fabric: silk, wool and lace rendered smoothly with clean folds and gentle sheen.
- Metal (iron gates, candlesticks): clean dark shapes with one crisp highlight.

ENVIRONMENTS
- Country churchyards, villages, marshes, manor houses, gardens, parlors and kitchens, always tidy, clean and luminous.
- Backgrounds simplified and lighter than the figures, with atmospheric depth through paler, bluer distant planes.

CAMERA AND COMPOSITION
- Classical, balanced compositions; elegant three-quarter views; intimate medium shots for dialogue; open wide shots for landscapes with lots of sky.

FINISH
- Crisp, clean, high-definition print finish. Pure whites. No texture overlay, no vignette, no aged look.

PANELS
- Every panel keeps the same clean smooth rendering and bright palette. Keep sky or simple wall areas calm for text boxes.

MUST AVOID
Oil painting look; visible brushstrokes; impasto; canvas texture; grain, noise or speckles; moss, lichen, stains, cracks or weathered surfaces; muddy browns, olive or sepia grading; dark murky shadows; dirty or gritty details; aged varnish yellow; heavy vignette; photorealism; 3D render; thought bubbles or dream vignettes.$p$ where id = 'pintura-historica';

update public.comic_styles set render_prompt = $p$STYLE: EPIC FANTASY — CLEAN LUMINOUS DIGITAL ART

IDENTITY
A breathtaking, luminous fantasy and adventure illustration in the clean finish of modern animated-feature concept art and premium fantasy book covers: heroic characters, grand interiors and vast landscapes, full of clear light and rich color. Polished, crisp and smooth. Never gritty, never textured, never muddy.

RENDERING
- Clean digital rendering with smooth gradients and soft-edged shading; crisp, sharp edges on characters and key objects.
- Surfaces are SMOOTH and clean: no brushstroke texture, no canvas, no grain, no noise, no rough paint.
- Detail is sharp and selective: faces, costumes, weapons and focal props are detailed; distant elements simplify into clean shapes and luminous haze.

COLOR
- Rich, saturated, luminous palette: sky blue, cobalt, emerald, jade, crimson, violet, warm gold and bright white.
- Strong warm-cool contrast: golden light on subjects, cool blue atmosphere and shadows.
- Brown and tan appear only as small accents; clothing and interiors use clear readable colors (heather gray, slate blue, forest green, burgundy, cream).

LIGHT
- Bright golden-hour or clear morning light, glowing rim light on hair and shoulders, sunbeams through windows or clouds.
- Interiors are flooded with light from tall windows; lamps glow cleanly.
- Atmospheric depth: distant mountains, cities or rooms fade into luminous pale haze.

FACES AND FIGURES
- Semi-realistic, attractive and expressive characters with clean features, clear eyes and smooth skin lit warmly.
- Strong, readable silhouettes; confident or lively body language; costumes specific to each character.

MATERIALS
- Fabric (tweed, wool, silk, capes): smooth color shapes with clean folds and a gentle sheen; patterns simplified, never noisy.
- Metal and armor: clean specular highlights and crisp reflections.
- Wood and furniture: smooth polished surfaces with clean highlights; no grain texture.
- Stone and cliffs: sculpted clean planes, sunlit faces and cool shadowed faces; no grit.
- Foliage: lush clean greens with crisp sunlit highlights.
- Water and waterfalls: luminous, clean, with white spray.
- Sky: smooth clean gradient with sculpted sunlit clouds.

ENVIRONMENTS
- Grand halls, studies with tall windows, gardens, jungles, plateaus, cliffs, waterfalls, ancient ruins, castles and vast valleys, all clean, bright and readable.

CAMERA AND COMPOSITION
- Heroic low angles, sweeping wide establishing views, over-the-shoulder views into the distance, expressive close-ups.
- Clear depth: crisp foreground, detailed midground, luminous hazy background.

FINISH
- Crisp, clean, high-definition finish. Pure whites and clean blacks. No texture overlay, no grain, no vignette.

PANELS
- Every panel keeps the same clean luminous rendering and saturated palette. Keep sky or bright window areas calm for text boxes.

MUST AVOID
Oil painting look; visible or rough brushstrokes; canvas texture; grain, noise, grit or speckles; muddy brown, olive or sepia grading; brown-dominated interiors; murky dark shadows; smeared paint; dirty or weathered surfaces; flat cartoon cel shading; thick comic outlines; photorealism; 3D game render.$p$ where id = 'fantasia-epica';

update public.comic_styles set render_prompt = $p$STYLE: WATERCOLOR & INK STORYBOOK — CLEAN AND BRIGHT

IDENTITY
A bright, joyful, hand-drawn storybook illustration: fine ink drawing filled with clear, transparent, luminous watercolor, like a beautifully printed modern illustrated classic. Fresh, light, colorful and clean. Characters are detailed and charming; scenery is SIMPLE, light and airy, with lots of white paper.

LINE
- Fine, confident ink outlines in warm dark brown or soft sepia-black around characters and key objects.
- Line weight slightly heavier on silhouettes, finer on faces, hair and folds.
- Scenery uses FEW lines: only the main contours of buildings, trees and paths; no texture strokes.

COLOR
- Transparent, luminous washes: vivid orange, red and gold foliage, fresh leaf green, clear sky blue, soft lilac, rose, warm cream, with paper white left everywhere as light.
- Colors are clean and bright. Shadows are cooler clear versions of the local color (blue-violet, cool green), never brown or gray.
- Skin warm peach with soft rosy cheeks.

LIGHT
- Bright daylight; even gloomy or overcast scenes are a light blue-gray wash with plenty of white paper, never dark or dirty.

FACES AND FIGURES (KEEP THIS DETAIL)
- Appealing, gently stylized storybook characters: expressive eyes with highlights, small nose, readable mouth, rosy cheeks, hair as clear masses with flowing ink strands.
- Clothing with simple readable folds and clean color.

SCENERY — SIMPLE AND CLEAN (VERY IMPORTANT)
- Backgrounds are simplified: large, smooth, pale watercolor washes with soft edges, defined by a few clean ink contours.
- Buildings (manors, cottages, walls, gates): simple outlined shapes with flat light washes (cream, pale gray, soft lilac, light terracotta); windows and roofs suggested with a few lines. No individual stones, no bricks drawn one by one, no ivy texture, no moss, no stains.
- Gardens and trees: soft masses of clean color with a few small ink leaves at the edges; flowers as bright color dots.
- Paths and ground: one or two light washes; no gravel, dirt or speckle texture.
- Interiors: pale walls, a few pieces of furniture outlined cleanly, light washes, lots of air.
- The further away, the paler and simpler: distant elements are just light color shapes.

FINISH
- Clean, crisp printed-picture-book finish on white paper. No grain, no dirty smudges, no blotches, no blooms of dark color, no vignette.

CAMERA AND COMPOSITION
- Clear storybook staging; characters in the foreground with detail; airy, light backgrounds behind them; one clear focal point per panel.

PANELS
- Every panel uses the same fine ink and clean transparent washes. Keep pale wash or white sky areas for text boxes.

MUST AVOID
Dense or busy backgrounds; texture on stones, walls, ground or foliage; moss, ivy texture, stains, dirt, speckles or grain; muddy brown, beige, olive or gray washes; dark overcast gloom; oil or acrylic look; heavy brushstrokes; blotchy or dirty washes; thick black outlines; photorealism; 3D render.$p$ where id = 'aquarela-nanquim';
