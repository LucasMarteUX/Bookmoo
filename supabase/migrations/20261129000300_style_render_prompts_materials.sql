-- Segunda parte dos prompts exclusivos: como cada estilo desenha cada material, câmera e composição, atuação e a
-- conferência do resultado. É aqui que os prompts antigos desviavam (todo material virava "textura pintada").
update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: smooth warm peach wash, a single soft rosy blush on cheeks, tiny white highlight on the nose tip; no pores or texture.
- Hair: clear color masses with flowing fine ink strands on top; one darker wash layer for shadow; paper-white highlights.
- Fabric: flat transparent color with a few ink fold lines and one soft shadow wash; patterns (checks, flowers) drawn delicately in ink.
- Wood, stone and brick: outlined in fine ink with a few suggestive lines (cracks, grain, mortar), filled with clean light washes; never rendered texture.
- Foliage: masses of bright transparent color with small ink-drawn leaves at the edges; autumn leaves as crisp orange-red shapes.
- Water and sky: pale luminous washes with paper-white reflections and clouds.
- Animals and fur: soft color washes with a few ink strokes for fur direction; friendly expressive faces.

CAMERA AND COMPOSITION
- Clear storybook staging at eye level or slightly above; medium shots for dialogue, wide shots for landscapes.
- One clear focal point per panel, framed by trees, walls or foliage; light backgrounds behind faces.

ACTING
- Warm, readable emotions: curiosity, joy, surprise, gentle worry. Hands and gestures are clear and expressive.

PERFECT RESULT CHECKLIST
Fine brown-black ink lines visible on every figure; transparent saturated washes with white paper showing; bright, light and clean overall; shadows cool and colorful; faces cute and readable; no muddy area anywhere in the image.$p$ where id = 'aquarela-nanquim';

update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: naturally painted with warm light and cool shadow, smooth and luminous, with subtle subsurface warmth in ears and cheeks.
- Hair: defined locks with glowing rim light; individual strands only at the edges.
- Metal and armor: crisp specular highlights, clear reflections of sky blue and warm light, sharp edges on plates, rings of chainmail readable.
- Leather and fabric: rich color, clear folds, embroidered borders and stitching visible; capes catch wind in strong flowing shapes.
- Fur: soft but defined clumps, lit at the edges.
- Stone and cliffs: sculpted planes with sunlit faces and cool shadowed faces, crisp cracks, moss in clean green patches.
- Water: luminous waterfalls with white spray and blue-green pools; rivers reflect the sky.
- Foliage: lush layered greens with sunlit highlights; wildflowers as crisp color accents.
- Sky: sculpted sunlit clouds, clear blue gradient, warm glow near the sun.
- Magic: clean glowing light with soft bloom (cyan, gold, violet).

CAMERA AND COMPOSITION
- Heroic low angles, over-the-shoulder views toward distant castles, epic wide establishing shots, and dramatic close-ups for emotion.
- Strong depth: dark-framed crisp foreground, detailed midground, luminous hazy background.

ACTING
- Noble, determined, awestruck or battle-ready expressions; strong gestures (pointing toward the horizon, raising a staff, gripping a sword).

PERFECT RESULT CHECKLIST
Luminous saturated color; golden light and blue distance; crisp detail on characters and props; vast readable landscape; no brown haze, no muddy darks, no smeared paint.$p$ where id = 'fantasia-epica';

update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: pale and cool, modeled with sharp shadow shapes; red rim light on cheekbones and jaw.
- Hair: black or dark masses with sharp ink strands falling over the face, catching thin red highlights.
- Armor and metal: dark steel with sharp hatched shadows and thin bright red-white edge highlights; blades with a single bright reflection line.
- Cloth and fur: tattered cloaks with jagged torn edges, ragged fur collars drawn with sharp ink strokes; crimson cloth accents.
- Stone and ruins: broken arches and walls with crisp outlines, ink hatching in shadow, cool gray planes, red light on edges.
- Ground and rocks: jagged slabs with glowing red cracks and embers.
- Mist and fog: clean layered gray veils between planes.
- Sky and moon: deep crimson to black gradient, an enormous detailed red moon, drifting red-gray clouds.

CAMERA AND COMPOSITION
- Silhouette-driven compositions: figure against the moon or burning sky; low angles for menace; wide shots of ruins for scale; tight close-ups of eyes and blades for tension.

ACTING
- Weary, brooding, grieving or defiant expressions; heavy, grounded poses; tense hands on sword hilts.

PERFECT RESULT CHECKLIST
Gray-black-crimson palette only; sharp ink detail; strong backlight silhouettes; mist layers; dramatic but perfectly legible; no brown, no blur, no smeared paint.$p$ where id = 'fantasia-sombria';

update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: pale gray modeled with delicate hatching; warm candle glow only on the parts lit by a flame.
- Hair: dark curls built with dense fine pen strokes and highlights left white.
- Fabric: dark dresses and coats in dense cross-hatching; lace collars and cuffs drawn as fine white patterns.
- Wood and iron: wrought-iron gates as crisp black silhouettes with spear tips; wooden doors with hatched grain.
- Stone and architecture: gothic gables, spires and tiles in fine parallel hatching; windows as small warm-lit rectangles.
- Trees: bare twisted branches in intricate thin ink lines, like claws against the sky.
- Sky and moon: smooth gray wash sky, a bright white full moon with soft halo, thin clouds.
- Fog: smooth light-gray layers that soften distant forms.

CAMERA AND COMPOSITION
- Atmospheric framing through gates, branches and doorways; low angles toward looming houses; close-ups of faces lit by candlelight.

ACTING
- Dread, awe, fear and curiosity; characters glancing upward or over the shoulder; trembling hands holding candles.

PERFECT RESULT CHECKLIST
Monochrome gray ink and wash; precise hatching everywhere; bright moon; tiny warm light accents only at real light sources; sharp lines; no sepia, no color tint, no muddy paint.$p$ where id = 'terror-gotico';

update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: flat warm base with one clean cel shadow and a small highlight.
- Hair: dark locks with sharp shapes and a crisp blue-white highlight band.
- Space suits and fabric: white and light gray with clean outlines, orange or teal panels, simple soft-edged shading, tidy seams and patches.
- Metal and machines: smooth light surfaces with clean panel lines, small rivets and lights, a single crisp reflection; domes with smooth gradient and lit window bands.
- Glass and visors: clean reflections of stars and planets, smooth gradient.
- Rock and regolith: gray-blue terrain with clean contours, simple crack lines and soft shadow shapes; no noisy texture.
- Sky: deep navy with crisp white stars; planets with clean bands and patches of color and a soft atmospheric rim.
- Light: cyan and warm yellow glows from screens, eyes and windows with soft halos.

CAMERA AND COMPOSITION
- Wonder-filled compositions: characters looking up at a giant planet, wide colony shots, interior views with large windows to space, cozy close-ups with robots.

ACTING
- Curiosity, awe, calm determination, friendly interaction with robots and crew.

PERFECT RESULT CHECKLIST
Clean uniform outlines; flat colors plus smooth gradients; cool blue palette with orange and cyan accents; crisp stars; no grime, no brown, no painterly texture.$p$ where id = 'ficcao-cientifica';

update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: smooth, lit by colored neon (magenta on one side, cyan on the other), with crisp highlights.
- Hair: dyed colors (pink, violet, teal) with glossy neon reflections; undercuts and sharp strands.
- Clothing: glossy black jackets with glowing trim lines, reflective panels, techwear straps, transparent raincoats and umbrellas.
- Cybernetics: clean metal plates, glowing seams, small LEDs, earpieces and visors with sharp reflections.
- Architecture: dark metal and concrete with crisp edges, layered signage, cables, railings and walkways.
- Signs and holograms: glowing rectangles and giant translucent figures with clean bloom; abstract glyphs only.
- Wet surfaces: mirror-like streets and puddles with long colored reflections; railings with water droplets catching light.
- Rain: fine bright diagonal streaks across the whole frame.

CAMERA AND COMPOSITION
- Characters in the foreground against deep, layered neon streets; low angles toward towers; profile shots lit by signs; crowds as silhouettes.

ACTING
- Cool, guarded, defiant or contemplative expressions; characters leaning on railings, looking up at holograms, walking through rain.

PERFECT RESULT CHECKLIST
Night, rain and neon in every panel; magenta-cyan-violet palette; deep blue-black shadows; crisp edges and reflections; no brown, no daylight, no smeared paint, no readable text.$p$ where id = 'cyberpunk';

update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: very light luminous wash with soft pink blush on cheeks, nose and lips; no texture.
- Hair: flowing fine ink strands over soft color washes; chestnut, black or auburn with light highlights.
- Fabric: light dresses with delicate floral patterns drawn in fine ink, soft pink and lilac shadows; men's shirts and vests in soft muted color with fine fold lines.
- Flowers: abundant blossoms (pink bougainvillea, roses, cherry blossom) as clusters of small outlined petals in vivid pink washes with white highlights.
- Stone and wood: arches, steps and doors outlined finely and washed in pale cream, soft gray and light pink.
- Leaves: small fresh green shapes with fine outlines.
- Light: soft airy daylight; paper white glowing through.

CAMERA AND COMPOSITION
- Intimate medium and close shots of couples framed by flowers; romantic profiles; soft wide shots of gardens and lanes.

ACTING
- Tenderness, shyness, longing, joy; gentle touches, foreheads close, holding hands, glances.

PERFECT RESULT CHECKLIST
Pastel pink and cream dominance; fine graceful ink lines; transparent luminous washes; beautiful soft faces; flower framing; airy and light everywhere; no brown, no dark heavy color, no thick paint.$p$ where id = 'romance-aquarela';

update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: luminous, smooth, idealized with soft warm light and delicate cool shadows; gentle rosy cheeks.
- Hair: period styles (powdered, curled, pinned) with soft defined locks and light sheen.
- Silks and satins: luminous sheen with clean soft highlights, ivory, champagne and pale gold tones; lace rendered as delicate white patterns.
- Wool and velvet coats: deep navy, royal blue or burgundy with clean folds; gold embroidery and buttons with crisp highlights.
- Furniture and wood: polished, warm but clear wood tones with clean highlights; carved details visible.
- Architecture: pale stone facades, tall windows, columns, balustrades rendered crisply in daylight.
- Gardens: clipped topiary, flowering beds with bright accents, fountains with sparkling water.
- Sky: soft blue with white sunlit clouds.

CAMERA AND COMPOSITION
- Classical, balanced compositions: figures in the foreground, stately architecture or gardens behind; elegant three-quarter views; intimate interior scenes by windows.

ACTING
- Composed, refined emotions: reading, contemplation, courtship, polite tension; graceful hands and posture.

PERFECT RESULT CHECKLIST
Bright daylight; clean luminous colors; refined faces; rich fabrics clearly readable; polished finish like a restored painting; no yellow varnish, no brown murk, no rough strokes.$p$ where id = 'pintura-historica';

update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: carved by hard light; one side in white and light gray, the other in solid black or dark gray.
- Hair: slicked or short, rendered as black shapes with sharp highlights.
- Fabric: trench coats and suits with bold black fold shapes, crisp collars and belts; hat brims casting black shadows over eyes.
- Smoke: thin white curling lines and soft gray wisps.
- Rain: fine diagonal streaks over everything; droplets catching lamp light.
- Wet streets: black asphalt with long vertical white reflections from lamps and windows.
- Architecture: brick and stone suggested with crisp lines; windows as bright rectangles or black voids; venetian blinds casting striped shadows.
- Lamps: bright white halos with strong falloff into darkness.

CAMERA AND COMPOSITION
- Low angles, tilted frames, strong silhouettes, deep perspective down streets, close-ups with half-lit faces, figures in doorways.

ACTING
- Hard, guarded, suspicious or fatalistic expressions; cigarettes, turned-up collars, glances over the shoulder.

PERFECT RESULT CHECKLIST
Pure black and white with clean grays; bold ink; dramatic chiaroscuro; rain and reflections; razor-sharp; no color, no sepia, no muddy gray.$p$ where id = 'noir-misterio';

update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: realistic proportions, warm amber highlights from practical lights, cool teal shadows; a little sweat or rain sheen.
- Hair: defined strands, wet and clumped in the rain, with warm rim light.
- Clothing: jackets, hoodies and canvas backpacks with clear folds and seams; wet fabric darker with sharp highlights.
- Vehicles: glossy bodywork with clean reflections, bright headlights with lens glow.
- Roads and asphalt: wet, reflective, with long amber light streaks.
- Trees and forest: dark blue-green masses with backlit edges; bark rendered simply in shadow.
- Rain: bright streaks in light beams, splashes on surfaces.
- Interiors: single practical light sources (lamp, screen) with strong falloff and colored shadows.

CAMERA AND COMPOSITION
- Cinematic framing: tight close-ups for tension, over-the-shoulder shots, low angles, wide shots with tiny figures and headlights, Dutch angles for panic.

ACTING
- Fear, alertness, determination, exhaustion; characters hiding, running, glancing back, breathing hard.

PERFECT RESULT CHECKLIST
Teal-and-amber cinematic light; crisp faces and silhouettes; realistic proportions; rain and reflections; dark but readable; no brown, no muddy paint, no flat daylight.$p$ where id = 'thriller-cinematografico';

update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: white paper with clean contour lines; light screentone for shadows on necks and under hair.
- Hair: black fills or line-hatched locks with sharp white highlight streaks.
- Fabric: kimono, uniforms and coats with clean fold lines and screentone shadow areas; patterns drawn as simple line motifs.
- Metal and weapons: sword hilts and guards with fine line detail; blades white with a single black reflection line.
- Wood and stone: temple beams, roof tiles, stone steps drawn with ruler-precise lines and light tone.
- Trees and blossoms: cherry blossoms as clusters of small outlined petals with light tone; falling petals as small white shapes.
- Sky: white paper or soft screentone gradient; clouds outlined.
- Effects: speed lines, focus lines, sparkles and impact bursts in pure black line.

CAMERA AND COMPOSITION
- Dynamic manga paneling within each panel: dramatic close-ups on eyes, low angles on characters, wide establishing views of architecture, diagonal compositions for action.

ACTING
- Strong, clear emotion: determination, surprise, sadness, laughter; exaggerated expressions where the story calls for it.

PERFECT RESULT CHECKLIST
Pure black ink and dot screentone on white; varied crisp line weight; generous white space; detailed backgrounds when establishing; no color, no gray wash, no blur.$p$ where id = 'manga-tradicional';

update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: flat warm base, one crisp cel shadow, soft blush marks on cheeks.
- Hair: bright, clean locks with sharp tips, one cel shadow layer and a glossy highlight band.
- Eyes: large with layered highlights and a colored iris gradient.
- Fabric: flat colors with one shadow tone and clean fold lines; capes and scarves flowing in the wind.
- Leather and gear: satchels, belts and boots in clean flat browns with crisp highlights (warm accents only, never brown grading).
- Stone and castles: clean painted background shapes, light walls with simple shadow sides, colorful roofs.
- Foliage and grass: vivid greens with crisp light shapes and soft painted depth.
- Sky and clouds: brilliant blue gradient and towering white clouds with soft blue shadows.
- Animals: cute, expressive, cel-shaded companions.

CAMERA AND COMPOSITION
- Energetic, open compositions: characters in the foreground against huge skies, sweeping views of hills and castles, dynamic angles for action, cozy close-ups for emotion.

ACTING
- Joy, excitement, wonder, determination, comic surprise; lively hands and body language.

PERFECT RESULT CHECKLIST
Clean thin outlines; flat colors with crisp cel shadows; bright saturated sky blues and greens; sparkling eyes; animation-frame clarity; no brown grading, no texture, no brushstrokes.$p$ where id = 'anime-colorido';

update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: flat color with Ben-Day dots for mid-tones and solid black shadows under the jaw, nose and brow.
- Hair: glossy black masses with sharp white or blue highlight shapes.
- Costumes: flat primary colors (red, blue, yellow) with bold black folds and muscle shadows; capes in big flowing shapes.
- Metal and tech: flat gray with black reflections and white highlight shapes.
- Buildings: bold outlines, flat colors, black shadow sides, windows as flat yellow or blue rectangles.
- Sky: flat warm orange, yellow or cyan with halftone dot gradients and simple outlined clouds.
- Effects: speed lines, impact bursts, motion lines in black ink.

CAMERA AND COMPOSITION
- Dynamic low angles, foreshortening, dramatic heroic poses, deep city perspectives, close-ups with strong jawlines and determined eyes.

ACTING
- Bold, clear, theatrical emotions: determination, anger, surprise, triumph; big gestures.

PERFECT RESULT CHECKLIST
Heavy black ink; flat bright printing colors; visible halftone dots; bold spotted blacks; dynamic composition; no painterly rendering, no muddy color, no soft gradients.$p$ where id = 'hq-americana';

update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: single flat warm color, no shading or at most one flat light shadow shape.
- Hair: flat color shape with a clean outline and a few interior lines; no gradients.
- Clothing: flat colors with a few fold lines; patterns kept simple.
- Paper and maps: flat cream with clean outlined details.
- Stone, walls and stairs: neatly outlined blocks and steps in flat cream, beige-gray and white; texture shown only by clean outlines.
- Roofs: flat orange-red tiles outlined simply.
- Trees and foliage: outlined leaf clusters with flat greens; trunks with a few lines.
- Sky: clean flat blue, optionally with a very gentle gradient; clouds outlined or omitted.
- Water: flat blue with simple outlined ripples.

CAMERA AND COMPOSITION
- Clear, readable staging at eye level; medium shots showing full gestures; wide shots with detailed, organized backgrounds; characters always clearly separated from the background.

ACTING
- Lively, readable emotions through clear facial expressions and gestures (pointing, waving, reading a map, running).

PERFECT RESULT CHECKLIST
Uniform clean black line everywhere; flat bright colors; no hatching, no gradients on characters; detailed but tidy backgrounds; sunny and clear; no brushstrokes, no muddy color.$p$ where id = 'hq-europeia';

update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: smooth warm peach with round pink cheeks; no texture, no realistic shading.
- Hair: soft rounded masses with a few curls or strands as simple shapes; one gentle shadow and highlight.
- Animal fur: smooth soft color (pink pigs, gray or brown wolves in light, friendly tones, white rabbits) with a few small strokes at the edges only; never realistic hair.
- Clothing: bright simple garments (overalls, aprons, dresses, hats, scarves) with one soft shadow shape and small details like buttons and patches.
- Wood, straw and brick houses: simple rounded shapes in clean bright colors (golden straw, warm light wood, cheerful red-orange bricks) with a few neat lines; no realistic grain or mortar texture.
- Plants and flowers: round leafy tree crowns, bright meadows dotted with pink, white and yellow flowers.
- Sky: bright clear blue with puffy white clouds.
- Interiors: cozy, bright, colorful, simple furniture with rounded edges.

CAMERA AND COMPOSITION
- Simple, clear picture-book staging at the characters' height; friendly medium shots; open sunny wide shots; one clear focal point per panel.

ACTING
- Happy, curious, cheeky, surprised or mildly worried expressions; big readable gestures; villains are funny and mischievous, not scary.

PERFECT RESULT CHECKLIST
Bright, saturated, happy colors; cute round characters with rosy cheeks; clean smooth color areas; sunny light; simple charming details; looks like a premium modern picture book; absolutely no muddy browns, no dark mood, no realistic textures, no heavy brushstrokes.$p$ where id = 'infantil-guache';

update public.comic_styles set render_prompt = render_prompt || $p$

MATERIALS IN THIS STYLE
- Skin: smooth and luminous, softly lit by magical light, with gentle pink warmth.
- Hair: long flowing strands with lavender and golden highlights, moving in a soft breeze.
- Fabric: translucent, flowing dresses that glow where light passes through; soft folds.
- Glass and magical objects: transparent orbs and lanterns with inner light, crisp reflections and sparkles.
- Trees and blossoms: dark violet silhouettes with glowing golden blossoms and petals drifting in the air.
- Water: mirror-like lakes with sparkling golden and violet reflections.
- Sky: lavender-to-violet twilight with a huge glowing moon and soft stars.
- Light particles: fireflies, sparkles and petals as crisp glowing points.

CAMERA AND COMPOSITION
- Contemplative compositions: figures in profile looking up at the moon, close-ups of hands holding magical objects, wide serene landscapes with a small figure.

ACTING
- Wonder, serenity, longing, quiet joy; gentle gestures, eyes closed or gazing upward.

PERFECT RESULT CHECKLIST
Luminous lavender, violet and gold palette; glowing light and sparkles; soft but defined faces and hands; clean polished finish; dreamlike yet clear; no brown, no muddy darkness, no rough strokes.$p$ where id = 'realismo-magico';
