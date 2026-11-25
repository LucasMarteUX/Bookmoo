-- Prompt de geração exclusivo de cada estilo (render_prompt), escrito olhando a amostra de cada um.
-- Os prompts antigos (coluna prompt) ficam guardados, mas não vão mais para a imagem: todos repetiam "pincelada,
-- textura de papel, tons terrosos", e o modelo ignorava a amostra e entregava a mesma pintura borrada em qualquer estilo.
-- Cada prompt abaixo descreve só o que a amostra mostra e proíbe o que desviaria dela.
alter table public.comic_styles add column if not exists render_prompt text;

update public.comic_styles set render_prompt = $p$STYLE: WATERCOLOR & INK STORYBOOK

IDENTITY
A bright, joyful hand-made storybook illustration: fine ink drawing filled with clear, transparent watercolor. It feels fresh, light and lively, like a well-printed modern illustrated classic. Everything reads instantly: clean shapes, cheerful saturated color, generous light. Never gloomy, never muddy, never heavy.

LINE
- Fine, confident ink outlines around every figure and object, drawn with a thin nib or fine liner.
- Line color: warm dark brown or soft sepia-black, never thick black marker lines.
- Line weight varies slightly: a little heavier on outer silhouettes, finer on folds, hair strands, leaves and small details.
- Linework is lively and slightly loose but precise; shapes are always closed and readable.
- Small details (stones, bricks, fence posts, leaves, grass blades) are suggested with a few delicate ink strokes, not rendered texture.

COLOR
- Transparent watercolor washes laid over the ink, luminous and saturated: vivid orange, red and gold foliage, fresh leaf green, clear sky blue, soft lilac distant hills, warm cream and white.
- The paper white stays visible as highlights and in the sky and clouds; colors glow because they are transparent.
- Every color is clean and clear. Shadows are a cooler, deeper version of the local color (blue-violet, cool green), never brown or gray mud.
- Skin is warm peach with soft rosy cheeks.
- Overall value range is light and airy: most of the image sits in light and mid tones, with ink giving the darks.

LIGHT AND SHADING
- Bright natural daylight, often golden afternoon sun.
- Shading is one or two soft watercolor layers per shape with gentle soft edges and small blooms; no heavy modeling.
- Light areas are left as pale wash or white paper.

FACES AND FIGURES
- Appealing, gently stylized storybook characters: slightly large heads, expressive round eyes with a small highlight, small nose, simple smiling mouth, rosy cheeks.
- Hair drawn as clear masses with flowing ink strands; clothing with simple readable folds.
- Animals are friendly and expressive, drawn with the same fine ink and clear washes.
- Poses are natural and charming; expressions are easy to read even in small panels.

ENVIRONMENTS
- Rich but airy settings: cottages, stone walls, meadows with tiny flowers, rolling hills, trees with masses of colored leaves, distant villages and rivers.
- Foreground has the most ink detail; middle ground simpler; background becomes pale washes with very few lines, creating depth through lightness.
- Skies are open and luminous with soft clouds left white.

FINISH
- Crisp, clean, printed-picture-book finish. A barely perceptible paper feel is allowed, but the image must look clean and sharp.
- No visible canvas, no heavy grain, no dirty smudges, no dark vignette.

PANELS
- Apply the same fine ink and clear watercolor to every panel. Each panel is a complete small illustration with a clear focal point and plenty of light.
- Keep calm, pale wash areas where text boxes will be placed.

MUST AVOID
Muddy browns or sepia color grading; dark, dull or desaturated palette; oil-painting or acrylic look; thick impasto or visible heavy brushstrokes; rough canvas or heavy paper texture; photorealism; 3D render; airbrushed digital gradients; thick black comic outlines; gloomy lighting; dirty or blotchy washes.$p$ where id = 'aquarela-nanquim';

update public.comic_styles set render_prompt = $p$STYLE: EPIC FANTASY ILLUSTRATION

IDENTITY
A luminous, highly detailed epic fantasy illustration in the tradition of premium fantasy book covers and concept art: heroic figures in front of vast, breathtaking landscapes. It is a polished digital painting with crisp detail and rich, clear color. It feels grand, adventurous and full of light.

RENDERING
- Polished digital painting with clean, controlled edges; forms are sharp and well defined, especially on faces, armor, weapons and the focal area.
- Detail is high and precise: chainmail, leather straps, fur trims, embroidered cloaks, carved stone, distant towers and waterfalls are all clearly readable.
- Brushwork is smooth and refined, never smeared, rough or muddy. Surfaces read as their real materials (polished metal, wool, fur, stone, foliage).

COLOR
- Rich, saturated and luminous palette: deep sky blues, snow whites, emerald and moss greens, crimson red cloaks, golden sunlight, violet flowers.
- Strong warm-cool contrast: warm golden light on the subjects, cool blue atmosphere in the distance.
- Colors stay clean and vibrant; shadows are cool and transparent (blue, teal, violet), never brown or gray sludge.

LIGHT
- Dramatic golden-hour or bright morning light breaking through clouds, with glowing rim light on hair, armor and cloaks.
- Atmospheric perspective: distant mountains, castles and valleys fade into luminous blue haze, giving immense depth.
- Magical light sources (glowing staffs, runes, crystals) emit clean cyan or golden glow with soft bloom.

FACES AND FIGURES
- Semi-realistic, heroic and attractive characters with correct anatomy and confident poses.
- Faces are clearly painted with defined features, readable expressions and natural skin tones lit warmly.
- Costumes are rich and specific to each character; silhouettes are strong and readable.

ENVIRONMENTS
- Sweeping vistas: snow-capped peaks, cliffs, waterfalls, ancient forests, fortified cities, castles on mountains, rivers winding through valleys.
- Foreground elements (rocks, ancient trees, wildflowers) frame the composition with crisp detail.
- Clouds are big, sculpted and sunlit.

FINISH
- Clean, high-definition, print-quality finish. No canvas texture, no grain, no blur except natural atmospheric depth.

PANELS
- Every panel is a complete cinematic fantasy illustration with the same luminous palette, light and detail.
- Use wide establishing views for landscapes and closer heroic framings for characters; keep the sky or a quiet area free for text.

MUST AVOID
Muddy, brown or sepia color grading; dull desaturated colors; murky darkness; rough or smeared brushstrokes; oil-on-canvas texture; flat cartoon or anime cel shading; thick comic outlines; photographic realism; 3D game render look; blurry low-detail rendering.$p$ where id = 'fantasia-epica';

update public.comic_styles set render_prompt = $p$STYLE: DARK FANTASY

IDENTITY
A dramatic dark fantasy illustration: lone warriors, ruined gothic architecture and a blood-red sky. It combines sharp, expressive ink drawing with dark digital painting. It is moody and intense, but always crisp, legible and striking, never muddy or blurry.

LINE AND RENDERING
- Strong, expressive ink work defines characters: sharp contours, angular folds, jagged edges on torn cloaks and fur, fine hatching in shadows.
- Faces and hands are drawn with clean precise lines and anime-influenced semi-realistic features: sharp jaw, intense eyes, strands of dark hair falling over the face.
- Painted color and value sit under and around the ink, with hard, deliberate edges on the main shapes.
- Environment details (broken arches, ruined towers, scattered stones, dead trees) are drawn crisply with ink and then painted.

COLOR
- Limited, high-impact palette: charcoal and slate grays, deep black, and saturated crimson and blood red. Small accents of ember orange.
- Red appears in the sky, the moon, glowing cracks, embers and cloth accents; everything else is cool gray and black.
- No brown wash: grays are cool and clean, reds are vivid and clear.

LIGHT
- Strong backlight from a huge red moon or burning sky, producing bold silhouettes and red rim light on armor, hair and cloaks.
- Rolling mist and fog in mid-ground layers separates planes and gives depth; it is drawn as clean soft shapes, not smeared noise.
- Deep shadows are graphic and intentional, with clear shapes.

FIGURES
- Brooding, powerful figures in dark armor and tattered cloaks, often with great swords; poses are heavy, weary or defiant.
- Anatomy is correct and stylized toward elegance; silhouettes are sharp and readable against the sky.

ENVIRONMENTS
- Ruined cathedrals and aqueducts, broken towers, cliffs, graveyards, burning wastelands, jagged rocks with glowing red fissures.
- Layered depth: dark detailed foreground, misty midground, red sky background.

FINISH
- Crisp, high-contrast, print-quality finish. Fine ink detail must remain sharp. No muddy textures, no canvas grain.

PANELS
- Every panel uses the same gray-black-and-crimson palette and backlit drama. Keep sky or mist areas calm for text boxes.

MUST AVOID
Brown, sepia or muddy tones; warm cozy palette; bright cheerful daylight; oil-painting smears or blotchy brushwork; blur; low contrast; pastel colors; cute cartoon proportions; photorealism; 3D render look.$p$ where id = 'fantasia-sombria';

update public.comic_styles set render_prompt = $p$STYLE: GOTHIC HORROR — PEN, INK AND GRAY WASH

IDENTITY
A Victorian gothic horror illustration drawn in pen and ink with gray wash, almost entirely monochrome. It evokes classic engraved illustrations of ghost stories: haunted mansions, bare trees, iron gates and a full moon. Elegant, eerie and precise.

LINE
- Fine pen and ink linework throughout, with dense cross-hatching and parallel hatching to build shadows and texture.
- Contours are precise and elegant; hatching follows the form (folds of dresses, bark of twisted trees, roof tiles, stone).
- Bare branches are drawn as intricate, thin, clawing ink lines against the sky.

COLOR
- Grayscale: pure white, silver grays and deep black, with smooth gray washes for the sky, fog and moonlight.
- The ONLY color allowed is a small warm accent from real light sources: candle flame, lantern, glowing windows (warm yellow-orange). Everything else stays neutral gray.
- No sepia, no brown, no color tint over the image.

LIGHT
- Cold moonlight from a large bright full moon, creating silver highlights on faces, hair and architecture.
- Small warm points of light (a candle held by a character, lit windows of the mansion) create focal contrast and glow softly onto nearby faces and hands.
- Deep black shadows with clear shapes; fog rendered as soft gray layers between planes.

FACES AND FIGURES
- Semi-realistic, elegant Victorian figures: pale faces with delicate, finely drawn features, expressive worried or awestruck eyes, curly or pinned-up hair.
- Period clothing: high lace collars, dark dresses, coats, cloaks, drawn with careful hatched folds.

ENVIRONMENTS
- Gothic mansions with steep roofs, chimneys and spires, wrought-iron fences with spear points, graveyards, crypts, twisted dead trees, misty moors, cobbled lanes.
- Background architecture is detailed but lighter in value, separated by fog.

FINISH
- Crisp, clean engraving-like finish on white. Lines are sharp, washes are smooth. No blur, no smudges, no paper stains.

PANELS
- Every panel stays monochrome with the same hatching language and cold moonlight; warm accents only where a light source exists. Keep a calm gray area of sky or fog for text.

MUST AVOID
Full color; sepia or brown tint; muddy painted look; oil paint; thick blurry brushstrokes; anime or cartoon style; gore; photorealism; 3D render; heavy grain or dirt.$p$ where id = 'terror-gotico';

update public.comic_styles set render_prompt = $p$STYLE: SCIENCE FICTION — CLEAN ILLUSTRATED SCI-FI

IDENTITY
A clean, optimistic science fiction illustration with crisp linework and smooth color, like a beautifully drawn animated sci-fi film or a modern clear-line sci-fi comic. Astronauts, domed colonies, rockets, robots and enormous planets in a starry sky. Clear, bright, wondrous and precise.

LINE
- Crisp, clean, uniform dark outlines around characters, suits, robots and architecture.
- Technical objects (domes, rockets, antennas, helmets, panels) are drawn with precise straight lines and smooth curves, with tidy panel seams and small mechanical details.
- Rocks and terrain have clean contour lines with simple crack lines, not noisy texture.

COLOR
- Cool, clean palette dominated by deep navy and cobalt space blue, crisp whites and light grays, with vivid accents: safety orange, teal, cyan glow, warm yellow window light.
- Planets show clear bands and patches of color (blue, orange, teal).
- Colors are applied as clean flat fills with smooth soft gradients for light; everything stays crisp and saturated.

LIGHT AND SHADING
- Cel-style shading: one clean shadow tone and one highlight per material, with smooth gradients only on large curved surfaces (domes, planets, helmets).
- Glowing elements (robot eyes, screens, windows, engines) emit clean cyan or warm light with a soft halo.
- Starfields are crisp white points on deep blue.

FACES AND FIGURES
- Appealing anime-influenced characters: clear eyes with highlights, simple nose, expressive mouth, neat hair with defined locks.
- Space suits are white and light gray with orange or teal details, drawn with clean folds and readable gear.
- Robots are cute or elegant, rounded, with glowing eyes.

ENVIRONMENTS
- Lunar or alien plains, domed habitats, launch towers, rockets, rovers, space stations, observation decks, holographic screens.
- Strong sense of scale: huge planets and moons on the horizon, tiny buildings in the distance.

FINISH
- Sharp, high-definition, clean digital finish. No grain, no brush texture, no grime.

PANELS
- Every panel uses the same clean outlines, flat-plus-gradient color and cool palette. Keep empty starry sky or a quiet wall for text boxes.

MUST AVOID
Muddy, brown or sepia grading; grimy dystopian dirt; oil-painting or rough painterly brushwork; heavy texture; photorealism; 3D render plastic look; dark murky scenes; neon cyberpunk pink overload.$p$ where id = 'ficcao-cientifica';

update public.comic_styles set render_prompt = $p$STYLE: CYBERPUNK — NEON NIGHT CITY

IDENTITY
A vivid cyberpunk illustration at night: rain-soaked megacity streets, giant holographic billboards and glowing signs reflected everywhere. Semi-realistic anime-influenced characters in techwear. Electric, high-contrast, saturated and sharp.

RENDERING
- Clean, sharp digital illustration with crisp edges on characters and architecture.
- Characters have defined contour lines and smooth shading; cybernetic details (implants, glowing seams, earpieces, visors) are precise.
- Architecture is dense and layered: walkways, cables, stacked signs, balconies, elevated rails, drawn with straight clean perspective lines.

COLOR
- Neon palette: hot magenta, electric violet, cyan and turquoise, with deep indigo and blue-black shadows. Small accents of warm orange or red signage.
- Strong complementary contrast: magenta light from one side, cyan from the other.
- Blacks are deep blue-violet, never brown. Colors are saturated and luminous.

LIGHT
- All light comes from neon signs, holograms, screens and street lights; it glows with clean bloom.
- Rain falls as fine bright streaks; wet surfaces produce mirror-like colored reflections and puddles.
- Rim lighting in neon colors outlines faces, hair and clothing; faces are lit by colored light.

FACES AND FIGURES
- Stylish, semi-realistic anime-influenced characters: sharp facial features, expressive eyes, undercuts, dyed hair (pink, violet, cyan), piercings, cybernetic implants.
- Clothing: glossy jackets with glowing trims, hoodies, techwear, transparent umbrellas.
- Crowds in the background are simplified dark silhouettes, some with glowing umbrellas.

ENVIRONMENTS
- Neon alleys, rooftop railings, elevated walkways, markets, holographic advertisements of giant figures, signs with abstract glyphs (no readable words), rainy plazas.

FINISH
- Crisp, high-definition finish with smooth glow effects. No grime overlay, no noise, no painterly smearing.

PANELS
- Every panel keeps the night, the rain and the magenta-cyan neon palette. Use dark sky or a wall area as calm space for text boxes. Signs must contain only abstract glyphs, never legible text.

MUST AVOID
Daylight; warm earthy or sepia palette; brown tones; muddy painterly brushwork; oil paint texture; flat pastel cartoon look; desaturated colors; blur; photorealism; 3D game render; readable letters on signs.$p$ where id = 'cyberpunk';

update public.comic_styles set render_prompt = $p$STYLE: WATERCOLOR ROMANCE

IDENTITY
A delicate, dreamy romantic illustration in soft watercolor and fine ink, like a refined editorial or shoujo-inspired storybook. Couples in tender moments, framed by cascades of flowers. Light, airy, pastel and elegant. It must feel fresh and beautiful.

LINE
- Fine, delicate ink lines in dark brown or soft gray-black, thin and graceful.
- Hair is drawn with many flowing fine strands; fabric with soft elegant folds; flowers with tiny outlined petals.
- Lines are refined and light, never heavy.

COLOR
- Pastel and light palette: blossom pink, rose, soft coral, lavender, cream, ivory, warm white, fresh light greens; small touches of soft gold.
- Watercolor is transparent and luminous, with soft blooms and gentle gradients; the paper white shows through generously.
- Skin is light and luminous with soft rosy cheeks and lips.
- Shadows are soft pinks, lilacs and cool grays, never brown or muddy.

LIGHT
- Soft, diffused daylight; a gentle glow that makes the whole image feel light and romantic.
- High-key values: most of the image is light; darks only in hair and small accents.

FACES AND FIGURES
- Beautiful, gently stylized faces with large expressive eyes, long lashes, small noses, soft blushing cheeks; anime/shoujo influence but refined.
- Graceful poses and tender interaction: holding hands, foreheads touching, shy glances.
- Clothing: flowing dresses with floral patterns and ribbons, light shirts and vests, all with delicate detail.

ENVIRONMENTS
- Flower-covered walls, arches and doorways, gardens, balconies, terraces, cobbled lanes, cafés, all overflowing with blossoms (bougainvillea, roses, cherry blossoms, wisteria).
- Backgrounds are pale and simplified behind the figures, with flowers as the main decorative frame.

FINISH
- Clean, soft, high-quality print finish with a hint of paper. No heavy texture, no grain, no dirt.

PANELS
- Every panel keeps the same pastel palette, fine ink and airy light. Use pale wash backgrounds or flower-free sky for text boxes.

MUST AVOID
Dark, saturated or heavy colors; brown, sepia or earthy grading; oil-painting look; thick brushstrokes; rough canvas texture; harsh shadows; photorealism; 3D render; thick comic outlines; gloomy mood.$p$ where id = 'romance-aquarela';

update public.comic_styles set render_prompt = $p$STYLE: HISTORICAL PAINTING — LUMINOUS PERIOD ILLUSTRATION

IDENTITY
A refined, luminous period illustration in the manner of high-quality classic book illustration and romantic-era painting: elegant figures in period dress, stately homes and gardens. It is painterly by nature, but BRIGHT, CLEAN, polished and full of daylight color. It must look like a beautiful restored painting, not a dark or dirty old canvas.

RENDERING
- Smooth, controlled painterly rendering with refined edges: faces, hands and the focal area are sharply finished; secondary areas are softer but still clear.
- Fabrics are rendered with care: satin sheen, lace, embroidery, gold braid, velvet, each clearly readable.
- Architecture and gardens are detailed and crisp: columns, windows, fountains, topiary, flowers.

COLOR
- Clear, luminous, harmonious palette: soft sky blues and white clouds, garden greens, ivory and cream silks, champagne gold, deep navy and royal blue coats, touches of rose and coral flowers.
- Colors are clean and bright. Shadows are cool and transparent (blue-green, soft violet), never brown sludge.
- Overall impression: daylight, freshness and elegance.

LIGHT
- Bright, soft natural daylight with gentle sunlight on faces and fabrics; luminous sky.
- Soft rim light on hair and shoulders; gentle reflected light in shadows.

FACES AND FIGURES
- Elegant, attractive, realistic-but-idealized faces with fine features, calm expressive eyes and natural skin with a healthy glow.
- Period-accurate costume and hairstyles appropriate to each scene's era; graceful, poised body language.

ENVIRONMENTS
- Country houses, palaces, formal gardens, fountains, drawing rooms with tall windows, libraries, ballrooms, villages, all bathed in light.
- Atmospheric depth through lighter, bluer distant planes.

FINISH
- Polished, clean, high-definition finish, like a freshly restored painting printed in a fine book. No craquelure, no varnish yellowing, no canvas weave, no grain.

PANELS
- Every panel keeps the same luminous daylight palette and refined painterly finish. Keep sky or a calm wall area for text boxes.

MUST AVOID
Dark, muddy or brown/sepia grading; yellowed varnish look; dirty old-master darkness; heavy impasto or rough visible brushstrokes; canvas texture; murky shadows; cartoon or anime style; thick outlines; photorealism; 3D render.$p$ where id = 'pintura-historica';

update public.comic_styles set render_prompt = $p$STYLE: NOIR & MYSTERY — BLACK AND WHITE INK

IDENTITY
A classic noir comic illustration in black and white: rain-soaked night streets, street lamps, trench coats and fedoras, cigarette smoke. Bold brush ink with dramatic chiaroscuro and gray tones. Cinematic, tense, elegant and razor sharp.

LINE AND INK
- Bold, confident brush-and-ink work with large areas of solid black.
- Contours are strong and clean; folds of coats and hats are carved by black shapes.
- Rain is drawn as fine diagonal white and gray streaks over the whole scene.
- Fine hatching and gray tones model faces and surfaces.

VALUE
- Strictly monochrome: pure black, crisp white and a range of clean grays.
- High contrast chiaroscuro: faces half lit, half in deep shadow; bright pools of lamp light against black night.
- Wet pavement shows bright reflections of lamps and windows as vertical streaks.
- No color at all, no sepia, no tint.

LIGHT
- Hard light from street lamps, windows, headlights or a match flame; strong cast shadows and silhouettes.
- Backlit figures in the distance become dark silhouettes.

FACES AND FIGURES
- Realistic-stylized hard-boiled characters: strong jaws, sharp cheekbones, narrowed eyes, defined brows; femme fatales with sculpted features.
- Costume: trench coats, fedoras, suits, ties, gloves, period 1940s clothing.

ENVIRONMENTS
- City streets at night, alleys, fire escapes, bars, offices with venetian-blind shadows, train stations, docks, all detailed with crisp perspective.

FINISH
- Sharp, clean, print-quality black-and-white finish. No blur, no muddy gray wash, no paper stains.

PANELS
- Every panel is black and white with the same bold ink and dramatic light. Use dark sky or solid black areas as calm space for text boxes.

MUST AVOID
Any color; sepia or brown tint; soft low-contrast gray; painterly smudged look; oil paint; cartoonish proportions; anime style; photorealism; 3D render.$p$ where id = 'noir-misterio';

update public.comic_styles set render_prompt = $p$STYLE: CINEMATIC THRILLER — ILLUSTRATED REALISM

IDENTITY
A semi-realistic illustrated thriller in the look of a high-end graphic novel or film key art: tense characters at night, rain, headlights, dark forests and cities. Detailed drawing with dramatic cinematic color. Gritty in mood but sharp and clear in execution.

RENDERING
- Precise drawing under painted color: defined contours on faces and hands, clear folds in clothing, crisp silhouettes.
- Faces are carefully rendered with realistic proportions and readable emotion (fear, alertness, determination).
- Environments are detailed but simplified in the shadows; key objects (cars, weapons, phones, documents) are clear.

COLOR
- Cinematic teal-and-amber grading: deep teal, cold blue and blue-gray shadows; warm amber, orange and yellow from headlights, street lamps and practical lights.
- Skin is lit naturally with warm highlights and cool shadows.
- Colors are controlled and rich, never muddy brown; darks are blue-black.

LIGHT
- Night or storm scenes with strong practical light sources: car headlights, flashlights, lamps, neon, lightning.
- Rim light outlines characters against dark backgrounds; rain catches the light as bright streaks; wet roads reflect lights.
- Shadows are deep but with clear shape and detail.

FIGURES
- Realistic, grounded characters in contemporary clothing: jackets, hoodies, coats, backpacks.
- Poses convey tension: hiding, running, looking back, crouching.

ENVIRONMENTS
- Dark forests by roads, rainy highways, parking lots, motel corridors, city alleys, apartments lit by a single lamp.

FINISH
- Clean, high-definition finish with crisp focal areas. A subtle cinematic softness in the far background is fine; no heavy grain, no smeared paint.

PANELS
- Every panel uses the same teal-amber cinematic light and the same level of realism. Keep dark sky or out-of-focus areas for text boxes.

MUST AVOID
Brown, sepia or muddy grading; flat daylight; bright cheerful colors; rough painterly smears; oil-on-canvas texture; cartoon or anime proportions; photographic photo-collage look; 3D render; excessive blur.$p$ where id = 'thriller-cinematografico';

update public.comic_styles set render_prompt = $p$STYLE: TRADITIONAL MANGA — BLACK AND WHITE INK WITH SCREENTONE

IDENTITY
A classic black-and-white manga page: crisp pen lines, screentones and generous white space, like a professionally printed Japanese manga volume. Expressive characters, clean backgrounds, strong sense of motion and emotion.

LINE
- Clean, confident G-pen and maru-pen linework in pure black.
- Line weight varies expressively: thick outer contours, fine inner details, tapering strokes on hair and clothing folds.
- Hair is drawn as sharp spiky or flowing locks with black fills and white highlight streaks.
- Speed lines, impact lines and focus lines may be used for action and emotion.

TONE
- Strictly monochrome: pure black, pure white and mechanical screentone dot patterns for grays.
- Screentones fill shadows, clothing, skies and backgrounds with clean dot gradients; no painted gray wash.
- Large areas of white paper keep the page airy; solid black is used for hair, deep shadows and dramatic accents.
- No color of any kind.

FACES AND FIGURES
- Manga faces: large expressive eyes with highlights, simplified nose, expressive mouth, strong eyebrows; age and personality clear from the design.
- Anatomy is stylized but solid; poses dynamic.
- Clothing folds are drawn with clean lines and toned shadows.

BACKGROUNDS
- Detailed, precise line-drawn backgrounds when establishing place (temples, streets, houses, schools, forests, cherry trees), drawn with ruler-straight architecture.
- Simplified or effect backgrounds (screentone gradients, sparkles, speed lines, petals) for emotional close-ups.

FINISH
- Crisp printed-manga finish on white. Sharp lines, clean dot screens. No blur, no gray wash smudges, no paper discoloration.

PANELS
- Every panel is black and white with screentone. Use clean white space for text boxes, as in real manga.

MUST AVOID
Color of any kind; sepia or tinted paper; painterly gray wash; watercolor; oil paint; soft blurry rendering; Western comic style; photorealism; 3D render.$p$ where id = 'manga-tradicional';

update public.comic_styles set render_prompt = $p$STYLE: COLORFUL ANIME

IDENTITY
A bright, cheerful anime illustration in the look of a high-quality animated adventure film: lively characters, blue skies with big white clouds, lush green hills and castles. Clean lines, cel shading and saturated color. Joyful, fresh and polished.

LINE
- Clean, thin, uniform dark outlines (dark brown or dark gray) around characters and objects.
- Hair drawn in clear locks with sharp tips; clothing with simple elegant folds.
- Backgrounds have softer or no outlines, painted cleanly.

COLOR
- Bright, saturated, fresh palette: sky blue, cobalt, pure white clouds, vivid grass and leaf greens, warm skin tones, red and orange accents, golden light.
- Characters use flat base colors with one hard-edged cel shadow and a small highlight.
- Backgrounds are painted in the clean animation-background manner: smooth gradients in sky, clear shapes for clouds, foliage masses with crisp highlights.
- Shadows are cool and colorful (blue-violet), never brown or gray.

LIGHT
- Bright sunny daylight; crisp highlights on hair and eyes; soft glow around the sky.

FACES AND FIGURES
- Classic anime faces: large sparkling eyes with multiple highlights, small nose, expressive open mouths, blush marks; clear emotions.
- Energetic, expressive poses; cute animal companions drawn in the same style.
- Clothing: adventure outfits, capes, scarves, ribbons, satchels, boots, with clean shapes.

ENVIRONMENTS
- Rolling hills, cliffs, castles and villages on hills, flower fields, forests, seaside towns, big towering clouds.
- Depth through lighter, bluer distant planes and atmospheric clouds.

FINISH
- Crisp, clean, high-definition animation-frame finish. No texture, no grain, no brushstrokes.

PANELS
- Every panel uses the same cel shading, outlines and bright palette. Keep sky or simple background areas for text boxes.

MUST AVOID
Muddy, brown, sepia or desaturated colors; dark gloomy lighting; painterly or oil-painting textures; visible brushstrokes; realistic rendering; heavy hatching; Western comic style; 3D render.$p$ where id = 'anime-colorido';

update public.comic_styles set render_prompt = $p$STYLE: AMERICAN COMICS — CLASSIC INK AND HALFTONE

IDENTITY
A bold classic American comic-book illustration: heroic figures, dynamic low angles, city skylines, dramatic skies. Strong black inks, flat bright colors and printed halftone dots, like a vintage superhero comic printed on newsprint, but crisp and clean.

LINE AND INK
- Heavy, confident black ink contours with varied brush weight: thick on outer silhouettes, thinner on interior details.
- Solid black shadows spotted boldly (under jaws, in folds, on the shadow side of muscles and buildings).
- Feathering and hatching in transitions; speed lines for motion.
- Architecture drawn with strong perspective lines and lit windows as simple shapes.

COLOR
- Flat, saturated printing colors: primary red, royal blue, bright yellow and orange, sky cyan, with white highlights.
- Ben-Day halftone dot patterns in skies, skin tones and backgrounds to create mid-tones and gradients.
- A warm sunset or bright day sky with dot shading; colors are bright and clean, never muddy.
- Paper may read as clean off-white, but the image must not look dirty, stained or yellowed.

LIGHT AND SHADING
- Graphic lighting: one or two flat tones per area plus solid black shadows.
- Rim-light effects are made with flat lighter color shapes.

FIGURES
- Heroic, idealized anatomy with strong jaws, broad shoulders, dynamic poses, flowing capes; expressions bold and readable.
- Non-hero characters drawn in the same bold inked style with expressive faces.

ENVIRONMENTS
- City skylines, rooftops, streets, laboratories, alleys, open skies, all graphic and clear.

FINISH
- Crisp printed-comic finish: sharp ink, clean halftone dots, flat color. No painterly rendering.

PANELS
- Every panel uses the same bold ink, flat colors and halftone. Keep a flat sky area for text boxes.

MUST AVOID
Painterly or oil-painting rendering; soft airbrushed gradients; muddy brown or sepia grading; watercolor washes; realistic photo lighting; manga style; thin ligne-claire outlines without blacks; 3D render.$p$ where id = 'hq-americana';

update public.comic_styles set render_prompt = $p$STYLE: EUROPEAN COMICS — CLEAR LINE (LIGNE CLAIRE)

IDENTITY
A classic European clear-line comic illustration: clean uniform outlines, flat bright colors, sunlit Mediterranean towns and adventurous characters. Precise, legible and elegant, with detailed but uncluttered backgrounds. Bright, cheerful and clean.

LINE
- Uniform, clean black outlines of constant thickness around every shape: characters, buildings, stones, leaves, objects.
- No hatching, no feathering, no rough lines; shadows are rarely drawn with lines.
- Architecture is drawn precisely with clean perspective: windows, shutters, tiles, stairs, stone walls with neatly outlined blocks.

COLOR
- Flat, bright, harmonious colors with no gradients on characters: sky blue, leaf green, sunny yellow, terracotta roofs as clean orange-red, cream and white walls, blue clothing, warm skin.
- Colors are clear and luminous, as in carefully printed albums. Only very light, flat shadow tones if any.
- The sky is a clean flat or very gently graded blue.

LIGHT
- Bright Mediterranean daylight. Light is suggested through color choice rather than modeling.

FACES AND FIGURES
- Semi-caricatured, appealing characters with simple readable features: dot or small oval eyes, clear noses, expressive mouths and eyebrows.
- Clear body language and gestures (pointing, reading maps, walking).
- Clothing: simple shapes with a few clean fold lines.

ENVIRONMENTS
- Hilltop villages, stone stairs, olive and fig trees, harbors, cafés, train stations, deserts, ships, all highly readable.
- Background detail is real and abundant but always clean and organized.

FINISH
- Crisp, clean printed-album finish. No texture, no grain, no brushstrokes.

PANELS
- Every panel uses the same uniform line and flat colors. Keep a clean sky or wall area for text boxes.

MUST AVOID
Painterly rendering; brushstrokes; heavy black shadows; hatching; gradients on characters; muddy, brown or sepia grading; watercolor bleeding; manga or anime faces; photorealism; 3D render.$p$ where id = 'hq-europeia';

update public.comic_styles set render_prompt = $p$STYLE: CHILDREN'S PICTURE BOOK — BRIGHT GOUACHE

IDENTITY
A cheerful, clean modern children's picture-book illustration in a soft gouache look: cute rounded characters, sunny meadows, flowers, cottages and friendly animals. Bright, saturated, warm and happy. It must look clean, sweet and polished, like a premium picture book printed today.

SHAPES AND LINE
- Simple, rounded, friendly shapes; very readable silhouettes.
- Soft, thin colored outlines (darker shade of each local color) or no outlines; never heavy black lines.
- Details are few and charming: little flowers, ladybugs, leaves, fences, windows with curtains.

COLOR
- Bright, saturated, happy palette: grass green, leaf green, sunny yellow, sky blue, white clouds, pink and coral flowers, red accents, cream cottages, golden thatch.
- Opaque, smooth color areas with clean edges, like neat gouache; colors are pure and luminous.
- Shadows are soft, cooler versions of the local color (blue-green, lilac), never brown or gray.
- Skin is warm peach with round rosy cheeks.

LIGHT AND SHADING
- Bright, warm sunny light. Very simple shading: one soft shadow shape and a gentle highlight per form.
- Only a very subtle, fine soft texture inside color areas is allowed; surfaces stay clean and smooth.

FACES AND FIGURES
- Cute characters with large round heads, big friendly eyes (simple dark eyes with highlights), tiny noses, happy mouths, rosy cheeks.
- Animals (pigs, rabbits, wolves, birds, foxes) are adorable and rounded, with expressive faces and soft colors; a villain is mischievous rather than frightening.
- Clothing is simple and colorful: overalls, dresses, hats, scarves.

ENVIRONMENTS
- Sunny meadows full of flowers, cottages with thatched or tiled roofs, picket fences, trees with round leafy crowns, gardens, forests with friendly light, cozy interiors with bright colors.
- Backgrounds are simple and bright, with soft depth.

FINISH
- Clean, crisp, print-quality picture-book finish. No heavy paper grain, no rough brushstrokes, no dirt.

PANELS
- Every panel uses the same cute shapes, bright palette and clean finish. Keep a sky or simple meadow area for text boxes.

MUST AVOID
Muddy browns, sepia, earthy or desaturated grading; dark or gloomy light; realistic anatomy or realistic animals; oil-painting look; heavy visible brushstrokes, dry-brush scratches or thick paper texture; detailed realistic textures on fur, wood or stone; scary faces; thick black outlines; 3D render.$p$ where id = 'infantil-guache';

update public.comic_styles set render_prompt = $p$STYLE: MAGICAL REALISM — DREAMY LUMINOUS ILLUSTRATION

IDENTITY
A dreamy, poetic illustration where everyday moments become magical: a girl by a moonlit lake holding a glowing glass orb with a tree inside, petals and sparks floating in the air. Luminous, soft, glowing and enchanting, with clean, beautiful color.

RENDERING
- Soft, smooth digital painting with refined drawing underneath: faces, hands and the magical object are clearly defined; the environment dissolves into glowing light.
- Hair flows in elegant, defined strands; translucent fabrics show light through them.
- Magical elements (glowing orbs, floating petals, sparkles, fireflies, stars) are crisp points and shapes of light.

COLOR
- Luminous twilight palette: lavender, periwinkle and violet blues, soft pinks, moonlit silver, with radiant golden and warm yellow light.
- Colors glow; shadows are violet and blue, never brown or gray.
- Highlights bloom softly; the overall image is bright and magical even at night.

LIGHT
- Glowing light sources: a huge luminous moon, the magical object, lanterns, fireflies, reflections on water.
- Soft bloom and halos around lights; sparkling reflections on lakes and rivers.
- Faces are lit gently by the magical light.

FIGURES
- Graceful, gently idealized figures with serene, wondering expressions; anime-influenced refined faces with soft features.
- Flowing dresses and loose hair moving in an invisible breeze.

ENVIRONMENTS
- Moonlit lakes, blossoming trees, gardens at dusk, rooftops under stars, quiet streets where something impossible happens; ordinary places transformed by light.

FINISH
- Clean, polished, high-definition finish with soft glow. No canvas texture, no rough strokes, no grain.

PANELS
- Every panel keeps the same luminous lavender-and-gold palette and magical light. Keep soft sky or water areas for text boxes.

MUST AVOID
Muddy, brown or sepia grading; dull desaturated colors; heavy impasto or rough brushstrokes; oil-on-canvas texture; harsh realistic lighting; horror mood; flat cartoon style; thick outlines; photorealism; 3D render.$p$ where id = 'realismo-magico';
