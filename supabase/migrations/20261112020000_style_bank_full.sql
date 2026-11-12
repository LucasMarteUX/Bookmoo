-- Banco de estilos: super prompts 01–16 (fonte: supabase/styles/NN-id.md). Com prompt, o estilo fica pronto.
begin;
-- Os prompts completos passam de 20 mil caracteres (o maior tem ~26 mil).
alter table comic_styles drop constraint comic_styles_prompt_len;
alter table comic_styles add constraint comic_styles_prompt_len check (prompt is null or char_length(prompt) <= 40000);
update comic_styles set prompt = $sty$01. Aquarela & Nanquim
Categoria: Ilustração artesanal e literária
Estética: Traços desenhados à mão, aquarela tradicional e pintura suave
Indicado para: Contos, literatura infantil, fábulas, clássicos literários e narrativas poéticas.
MASTER STYLE PROMPT
Create a beautiful, highly detailed, original literary illustration using a sophisticated combination of traditional watercolor painting, expressive pen-and-ink drawing, delicate gouache, and organic hand-drawn sketching.
The artwork must resemble an illustration created by a skilled traditional artist using physical watercolor paper, fine ink pens, graphite pencils, natural brushes, and watercolor pigments.
The visual identity should feel warm, timeless, poetic, expressive, and unmistakably handmade.
1. Artistic Linework
The most important characteristic is the expressive, imperfect hand-drawn linework.
Use fine black, charcoal, and dark brown ink contours with natural variation in line thickness, opacity, pressure, and direction.
Introduce visible overlapping exploratory sketch lines around characters, objects, buildings, vegetation, and architectural details.
Some lines should extend slightly beyond the painted shapes, creating the impression of spontaneous pencil and ink construction.
Preserve subtle double contours, incomplete outlines, gestural strokes, and small irregularities.
These imperfections must feel intentional, elegant, and artistic.
Avoid perfectly clean digital outlines, vector precision, uniform strokes, and mechanically symmetrical shapes.
2. Watercolor Painting
Apply translucent watercolor washes with organic pigment distribution.
Use subtle color bleeding, irregular painted edges, soft watercolor gradients, delicate granulation, and visible variations in pigment density.
Combine transparent watercolor layers with occasional opaque gouache highlights.
Allow selected painted areas to extend subtly beyond the ink outlines.
The coloring should retain a natural, tactile quality, with delicate transitions between colors and visible brushwork.
The painting must never resemble a glossy digital render.
3. Color Palette
Use warm, harmonious, slightly muted colors with occasional expressive accents.
Preferred visual qualities include:

* Golden ochres and warm amber.
* Soft terracotta and earthy browns.
* Muted sage and olive greens.
* Delicate lavender and dusty blue.
* Cream, ivory, and warm paper whites.
* Soft peach and pastel pink.
* Natural atmospheric blues.

Adapt the palette to the narrative, season, location, and emotional atmosphere.
Do not force warm autumn colors into every scene. Preserve the watercolor technique while allowing different books to have distinct color identities.
4. Character Illustration
Design original characters with elegant, expressive, hand-drawn silhouettes.
Use believable but slightly stylized anatomy, natural gestures, softly simplified facial features, and subtle emotional expressions.
Characters should feel alive and full of personality without becoming exaggerated cartoons.
Hair, clothing, accessories, and body contours must contain delicate ink strokes, sketch imperfections, and painterly color variations.
Clothing should show natural folds through expressive lines and simplified watercolor shadows.
Characters must be appropriate to the literary narrative.
Never introduce recurring characters, recognizable copyrighted designs, or unrelated fantasy elements.
5. Environments and Backgrounds
Create richly atmospheric, hand-painted environments with beautiful natural textures.
Use expressive ink strokes for trees, buildings, stones, furniture, landscapes, and other environmental details.
Render distant scenery through softer, less detailed watercolor washes.
Maintain delicate atmospheric perspective, subtle lighting, and organic brushwork.
Allow certain background elements to remain loosely suggested rather than fully detailed.
The environment must support the narrative without overwhelming the composition.
6. Lighting
Use painterly natural lighting with gentle, emotionally expressive illumination.
Favor soft sunlight, diffused daylight, warm interior light, or subtle atmospheric moonlight depending on the scene.
Lighting must be expressed through watercolor pigment, controlled color contrast, and soft painted shadows rather than photorealistic effects.
7. Composition
Create thoughtfully composed literary illustrations with cinematic visual storytelling.
Use strong focal points, balanced negative space, natural depth, expressive gestures, and harmonious relationships between characters and environments.
The composition should resemble a premium illustrated storybook created by an accomplished traditional artist.
The scene must communicate the atmosphere and meaning of the narrative without requiring written explanations.
8. Material and Texture
Maintain a subtle authentic watercolor-paper texture throughout the illustration.
Include delicate dry-brush marks, imperfect pigment absorption, tiny paint irregularities, subtle graphite construction lines, and organic ink variation.
The texture must remain integrated into the painting rather than appearing as an artificial digital overlay.
9. Artistic Authenticity
Preserve the organic imperfections of handmade artwork.
The final illustration should feel like a combination of an original watercolor storybook painting, a traditional ink sketch, and a beautifully painted 2D animation background.
Emphasize artistic sensitivity, expressive contour drawing, and the tactile relationship between ink and watercolor.
10. Style Consistency
This visual style must remain consistent across all illustrations generated for the same book.
Preserve the same ink behavior, watercolor technique, paper texture, outline imperfections, color treatment, and degree of visual simplification.
Characters, locations, lighting, colors, and compositions should vary according to the book and narrative.
The style defines how the image is drawn, not what the image must contain.
11. Negative Prompt
Avoid photorealism, hyperrealism, 3D rendering, CGI, plastic materials, vector illustration, sterile outlines, perfect digital linework, flat corporate illustration, excessive cartoon exaggeration, glossy surfaces, oversaturated colors, artificial gradients, excessive blur, heavy grain overlays, thick uniform outlines, modern mobile-game graphics, recognizable copyrighted characters, logos, text, typography, speech bubbles, watermarks, and decorative borders.
FINAL GENERATION INSTRUCTION
Generate an original, emotionally expressive, beautifully composed watercolor-and-ink literary illustration.
Prioritize delicate handmade linework, overlapping exploratory contours, translucent watercolor pigments, organic paper textures, sophisticated painterly colors, and natural artistic imperfections.
The illustration must feel carefully drawn and painted by hand, never generated using a sterile digital rendering process.
Follow the provided scene description, characters, historical context, and environment faithfully.
Do not invent unrelated characters, animals, buildings, objects, or narrative elements.
SCENE TO ILLUSTRATE:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
ENVIRONMENT AND HISTORICAL CONTEXT:
{{environment_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
ASPECT RATIO:
{{aspect_ratio}}
Output a single complete illustration without any text.$sty$ where id = 'aquarela-nanquim';
update comic_styles set prompt = $sty$02. Fantasia Épica
Style ID: `epic_fantasy_02`
Category: Epic Fantasy Illustration
Visual Identity: Grandiose, painterly, immersive, cinematic and richly detailed.
MASTER STYLE PROMPT
Create an extraordinary, original epic fantasy literary illustration combining masterful traditional fantasy painting, sophisticated digital brushwork, atmospheric environmental art, and cinematic visual storytelling.
The artwork should resemble a premium illustrated fantasy novel, with the artistic craftsmanship of a traditionally painted masterpiece.
Prioritize breathtaking environments, elegant character design, dramatic atmospheric lighting, expressive painterly textures, and sophisticated composition.
The image must feel immersive, majestic, believable, and visually extraordinary while remaining unmistakably an illustration rather than a photograph or 3D render.
The defining characteristic of this style is the combination of monumental visual storytelling, expressive fantasy painting, and carefully controlled cinematic atmosphere.
1. ARTISTIC LINEWORK AND BRUSHWORK
Use sophisticated painterly illustration techniques with visible handcrafted brushwork.
Unlike comic illustration, this style should not depend on thick ink outlines.
Forms should be defined through light, shadow, color transitions, painterly edges, and subtle line accents.
Primary artistic characteristics

* Rich, expressive digital oil-painting brushwork.
* Delicate traditional painting influences.
* Organic, imperfect brush strokes.
* Detailed yet naturally painted surfaces.
* Elegant transitions between soft and sharp edges.
* Confident visual silhouettes.
* Subtle hand-painted texture.
* Carefully controlled levels of detail.

Edge treatment
Use varied edge sharpness to establish visual hierarchy.
Important characters and foreground elements should feature more defined shapes and carefully rendered details.
Distant elements should gradually lose definition through atmospheric perspective.
Some contours may dissolve naturally into shadows, fog, or reflected light.
Avoid excessively smooth digital airbrushing.
The painting should preserve visible artistic decisions and natural brush variations.
2. EPIC FANTASY PAINTING TECHNIQUE
Combine traditional oil-painting principles with modern high-quality fantasy illustration.
The image should feel like a hand-painted fantasy masterpiece.
Use:

* Layered painterly color application.
* Sophisticated value grouping.
* Subtle impasto-inspired brush textures.
* Rich environmental color variation.
* Delicate material rendering.
* Expressive shadow masses.
* Carefully painted highlights.
* Soft atmospheric transitions.
* Selective fine detail around focal points.

The final artwork must avoid artificial perfection.
Preserve a beautiful balance between detailed rendering and visible painterly abstraction.
3. COLOR LANGUAGE
Use rich, sophisticated, cinematic color palettes adapted to the narrative.
Potential color relationships include:

* Deep royal blues and atmospheric cyan.
* Emerald greens and muted forest tones.
* Antique gold and warm sunlight.
* Burnt orange and terracotta.
* Deep burgundy and crimson accents.
* Misty lavender and cool gray.
* Warm ivory and natural stone colors.
* Desaturated earth tones.

Colors should communicate scale, atmosphere, location, and emotional meaning.
Use complementary warm and cool relationships to create depth.
Avoid excessive saturation across the entire image.
Reserve intense colors for carefully selected focal points.
Do not force the same blue-and-gold fantasy palette into every illustration.
Allow each book to establish its own artistic palette while preserving the epic fantasy painting technique.
4. CHARACTER DESIGN
Create original, visually compelling characters appropriate to the literary narrative.
Characters must have believable anatomy, expressive silhouettes, natural gestures, and carefully designed clothing.
Character rendering should combine realistic structural understanding with artistic simplification.
Design principles

* Anatomically convincing proportions.
* Expressive body language.
* Detailed but tasteful facial features.
* Natural hair and fabric movement.
* Carefully designed costumes.
* Rich textile and material variation.
* Visually coherent accessories.
* Clear character silhouettes.
* Distinctive identities and personalities.

Clothing, equipment, and accessories must correspond to the established world and historical or cultural context.
Do not automatically introduce knights, elves, wizards, armor, crowns, weapons, or magical creatures.
Only include these elements when supported by the narrative.
Characters should feel naturally integrated into their environment.
Avoid recognizable copyrighted character designs or imitations of existing fictional franchises.
5. ENVIRONMENT AND WORLD DESIGN
Create immersive, beautifully illustrated environments with sophisticated spatial depth.
When the narrative calls for grandeur, use monumental scale, expansive landscapes, intricate environmental storytelling, and breathtaking atmospheric perspective.
Potential environmental elements may include:

* Ancient architecture.
* Monumental structures.
* Vast natural landscapes.
* Magical environments.
* Mountain ranges and deep valleys.
* Dense forests and mysterious ruins.
* Fictional settlements and civilizations.
* Elaborate interiors.
* Extraordinary natural formations.

These are possibilities, not mandatory elements.
The depicted environment must always correspond to the source narrative.
Environmental rendering
Use layered visual depth:
Foreground: Detailed textures, stronger contrast, expressive brushwork, and clearly defined objects.
Midground: Carefully balanced structural detail, characters, and primary environmental elements.
Background: Atmospheric perspective, softer silhouettes, reduced saturation, mist, and distant environmental color.
Maintain believable scale and spatial relationships.
6. CINEMATIC LIGHTING
Lighting is one of the most important visual components.
Use dramatic, sophisticated, artistically controlled lighting to strengthen the scene's atmosphere.
Possible techniques:

* Golden-hour illumination.
* Diffused atmospheric sunlight.
* Volumetric light beams.
* Soft environmental bounce light.
* Cool moonlit environments.
* Warm interior illumination.
* Subtle magical light sources when narratively appropriate.
* Dramatic backlighting.
* Carefully shaped shadow masses.
* Atmospheric light scattering.

Use lighting to guide the viewer toward the central narrative subject.
Maintain realistic light relationships while preserving artistic interpretation.
Avoid excessive bloom, artificial lens flares, and generic cinematic effects.
7. MATERIALS AND SURFACE RENDERING
Render materials using detailed but painterly techniques.
Materials should have recognizable visual properties without becoming photorealistic.
Examples:
Stone: Natural mineral variation, weathered edges, layered textures, subtle erosion.
Fabric: Elegant folds, directional brushwork, delicate highlights, believable thickness.
Metal: Controlled reflections, restrained highlights, subtle wear.
Wood: Organic grain, warm color variation, textured brushwork.
Vegetation: Varied leaf masses, natural irregularities, atmospheric depth.
Skin: Soft painterly transitions, believable coloration, natural facial volume.
Avoid repeating identical textures or overly sharp surface details.
8. COMPOSITION AND CINEMATIC STORYTELLING
Create highly intentional compositions inspired by grand cinematic storytelling and traditional fantasy painting.
Use:

* Strong visual hierarchy.
* Carefully balanced asymmetry.
* Dynamic yet readable framing.
* Clear focal points.
* Dramatic environmental scale.
* Natural leading lines.
* Layered depth.
* Meaningful character placement.
* Elegant use of negative space.
* Visually compelling silhouettes.

Scale and perspective
Use perspective to communicate the physical and emotional scale of the scene.
When appropriate, contrast small characters against vast environments.
However, not every scene should be monumental.
Quiet conversations, intimate moments, discoveries, and character-focused scenes must retain the same artistic quality without unnecessary visual spectacle.
The composition must follow the emotional requirements of the narrative.
9. ATMOSPHERE AND ENVIRONMENTAL EFFECTS
Build rich atmospheric depth through subtle environmental effects.
Depending on the scene, introduce:

* Gentle mist.
* Atmospheric haze.
* Soft drifting clouds.
* Natural dust particles.
* Light rain.
* Snow.
* Wind movement.
* Environmental reflections.
* Subtle magical particles where appropriate.

These effects must support the narrative rather than decorate the image without purpose.
Atmospheric effects should be integrated through painterly lighting and color relationships.
Avoid excessive particles, unnecessary glowing elements, and visual clutter.
10. EXPRESSIVE EMOTIONAL STORYTELLING
The visual style must support a broad emotional range.
Possible atmospheres include:

* Wonder and discovery.
* Courage and determination.
* Mystery and anticipation.
* Melancholy and solitude.
* Triumph and celebration.
* Friendship and companionship.
* Adventure and exploration.
* Quiet contemplation.
* Tension and uncertainty.

Do not force every scene to feel heroic, dramatic, or action-oriented.
The image must communicate the specific emotional purpose of the literary passage.
11. LEVEL OF DETAIL AND VISUAL POLISH
The image should feel like a premium fantasy book illustration.
Use high visual detail without making every area equally complex.
Detail distribution
Primary focal point: High detail, refined rendering, strong edge definition.
Secondary subjects: Medium detail, controlled texture, balanced contrast.
Background: Painterly simplification, atmospheric softness, reduced visual complexity.
Preserve visible artistic brushwork in areas that do not require precise detail.
Avoid uniformly sharp images.
The final illustration should look meticulously painted, not artificially sharpened.
12. WORLD CONSISTENCY
When generating multiple illustrations for the same book, preserve consistency in:

* Character appearance.
* Character proportions and distinctive features.
* Costume designs.
* Architectural language.
* Cultural and historical influences.
* Environmental characteristics.
* Fantasy-world visual rules.
* Material rendering.
* Color grading.
* Brushwork technique.
* Lighting philosophy.
* Overall artistic quality.

The same character should remain visually recognizable across different scenes.
Locations must remain coherent when revisited.
Do not invent new visual characteristics that contradict previously established illustrations or the source material.
13. ARTISTIC ORIGINALITY
Every generated illustration must be an original visual interpretation.
Do not recreate recognizable characters, famous franchise costumes, iconic fantasy locations, copyrighted visual compositions, or distinctive proprietary designs.
Use general fantasy illustration principles rather than copying a particular artist, movie, game, or franchise.
The objective is to create a distinctive, original fantasy illustration language suitable for a broad library of books.
14. STRICT VISUAL RESTRICTIONS
Avoid:

* Photorealism.
* Photography.
* CGI and 3D renders.
* Plastic-looking materials.
* Video-game screenshots.
* Generic AI fantasy aesthetics.
* Excessive airbrushing.
* Overly smooth surfaces.
* Unnaturally sharpened textures.
* Excessive bloom.
* Random magical particles.
* Unnecessary armor or weapons.
* Generic medieval castles in unrelated scenes.
* Oversaturated colors.
* Flat vector illustration.
* Thick comic-style outlines.
* Anatomical distortions.
* Inconsistent character designs.
* Excessive visual clutter.
* Artificial cinematic filters.
* Recognizable copyrighted characters.
* Text, captions, watermarks, or logos.

15. FINAL ART DIRECTION
Create a breathtaking original fantasy illustration that combines the richness of traditional oil painting, the expressive beauty of handcrafted brushwork, and the atmosphere of sophisticated cinematic concept art.
The illustration must feel immersive, magnificent, emotionally expressive, and artistically authentic.
Prioritize painterly craftsmanship over photorealism.
Visual priority order:

1. Premium hand-painted fantasy illustration quality.
2. Sophisticated cinematic composition.
3. Expressive characters and meaningful visual storytelling.
4. Rich painterly brushwork and natural material textures.
5. Atmospheric environmental depth.
6. Beautifully controlled lighting and color relationships.
7. Narrative accuracy and world consistency.
8. Original character and environment design.

The style must remain recognizable across different books without forcing every story into the same fictional universe.
16. SCENE GENERATION INPUT
Illustrate the following literary scene using the artistic principles defined above.
SCENE DESCRIPTION:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
WORLD AND HISTORICAL CONTEXT:
{{world_context}}
ENVIRONMENT:
{{environment_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
COMPOSITION AND CAMERA ANGLE:
{{composition}}
PREVIOUS CHARACTER AND WORLD REFERENCES:
{{visual_references}}
ASPECT RATIO:
{{aspect_ratio}}
FINAL INSTRUCTION
Generate one complete, original, highly detailed, hand-painted epic fantasy illustration.
Follow the narrative description faithfully.
Use the master style specification exclusively to determine the artistic execution.
Do not introduce unrelated fantasy elements.
Do not copy recognizable characters or existing intellectual property.
No typography, no speech bubbles, no captions, no decorative borders, and no watermarks.$sty$ where id = 'fantasia-epica';
update comic_styles set prompt = $sty$03. FANTASIA SOMBRIA — DARK FANTASY
Style ID: `dark_fantasy_03`
Category: Dark Fantasy / Gothic Fantasy Illustration
Visual Identity: Dark, atmospheric, painterly, mysterious, dramatic, immersive, and handcrafted.
MASTER STYLE PROMPT
Create an extraordinary, original dark fantasy literary illustration combining traditional oil-painting techniques, expressive digital brushwork, gothic visual influences, sophisticated cinematic lighting, and atmospheric fantasy storytelling.
The artwork should resemble a premium hand-painted illustration from a beautifully crafted dark fantasy novel.
The overall appearance must feel mysterious, dramatic, ancient, melancholic, and visually immersive.
Emphasize rich painterly textures, monumental environmental design when appropriate, complex atmospheric depth, sophisticated shadow construction, restrained color palettes, and emotionally expressive compositions.
The illustration must feel handcrafted by an accomplished fantasy illustrator, not produced by a photorealistic rendering engine.
The defining characteristic of this visual style is the combination of sophisticated dark fantasy painting, restrained dramatic lighting, expressive painterly textures, and mysterious atmospheric depth.
The artwork must remain unmistakably illustrated, even when depicting detailed characters, architecture, or environments.
1. ARTISTIC IDENTITY AND PAINTING TECHNIQUE
Use expressive traditional painting principles inspired by classical oil painting, romantic landscape painting, gothic illustration, and high-quality contemporary fantasy book illustration.
The image should possess the tactile richness of a painted artwork.
Primary artistic characteristics

* Rich traditional oil-painting-inspired brushwork.
* Visible, organic, handcrafted paint strokes.
* Sophisticated digital painting techniques.
* Natural variation in brush texture.
* Painterly surfaces with subtle irregularities.
* Carefully controlled edge definition.
* Dark atmospheric color relationships.
* Rich shadow masses.
* Expressive environmental rendering.
* Selective fine details around important subjects.
* Elegant transitions between painted forms.
* Subtle traditional canvas texture.

Maintain a balance between refined detailing and expressive painterly abstraction.
Do not digitally polish every surface.
Preserve the feeling of artistic interpretation rather than photographic reproduction.
2. BRUSHWORK AND ARTISTIC TEXTURE
Brushwork is fundamental to the identity of this style.
Use layered paint application with subtle texture variations.
Brush characteristics

* Broad expressive strokes for environmental masses.
* Medium textured strokes for architecture and clothing.
* Fine controlled strokes for important focal details.
* Dry-brush variations along weathered surfaces.
* Subtle irregular strokes in shadows.
* Organic paint transitions.
* Natural brush direction following the shape of objects.

Create a handcrafted appearance in which individual artistic decisions remain visible.
Some environmental forms may dissolve into loose painterly textures.
Avoid overly smooth gradients, mechanical precision, sterile digital surfaces, and uniformly sharpened details.
3. DARK FANTASY COLOR LANGUAGE
Use sophisticated, restrained, dark atmospheric palettes.
The color treatment should feel dramatic without becoming excessively saturated.
Primary color families
Charcoal and black

* Deep charcoal.
* Soft black.
* Obsidian gray.
* Weathered dark stone.
* Cold graphite.

Crimson and burgundy

* Deep wine red.
* Muted blood crimson.
* Dark burgundy.
* Burnt red.
* Rusted terracotta.

Cold atmospheric colors

* Storm gray.
* Desaturated steel blue.
* Cold slate.
* Dark violet.
* Misty blue-gray.

Earth and environmental colors

* Weathered brown.
* Muted olive.
* Dark forest green.
* Ancient stone beige.
* Desaturated umber.

Controlled highlights

* Antique gold.
* Dim amber.
* Pale moonlight.
* Warm candlelight.
* Subtle copper reflections.

Palette rules
Use dark neutral colors as a foundation when appropriate to the narrative.
Introduce carefully controlled warm accents to create focal points.
Red, amber, or gold should never dominate automatically.
Do not force red moons, red skies, or fiery landscapes into every illustration.
A dark fantasy illustration may also use cold blue moonlight, pale winter landscapes, misty forests, muted green valleys, or almost monochromatic environments.
The emotional atmosphere and painting technique define the style, not one fixed color palette.
4. LIGHTING AND SHADOW
Lighting is one of the defining elements of this style.
Use dramatic but sophisticated lighting inspired by classical chiaroscuro painting and atmospheric cinematic illustration.
Lighting characteristics

* Deep, layered shadows.
* Carefully controlled highlights.
* Dramatic directional illumination.
* Subtle rim lighting.
* Soft atmospheric moonlight.
* Warm light from practical sources.
* Diffused illumination through fog.
* Strong tonal separation.
* Painterly shadow transitions.
* Limited areas of intense brightness.

Use lighting to establish emotional tension, mystery, scale, and visual hierarchy.
Faces and important story elements should remain readable when narratively relevant.
Avoid crushing every detail into complete darkness.
Atmospheric light
When appropriate, integrate light with:

* Distant mist.
* Low clouds.
* Environmental haze.
* Gentle smoke.
* Diffused moonlight.
* Reflected illumination.
* Subtle environmental particles.

Effects must remain restrained and narratively justified.
Avoid artificial bloom, excessive lens flares, and generic fantasy glow effects.
5. CHARACTER DESIGN
Create original dark fantasy characters with sophisticated visual identities appropriate to the source narrative.
Characters should feel believable, expressive, and naturally integrated into the literary world.
Character rendering

* Believable human or creature anatomy.
* Elegant visual silhouettes.
* Natural body proportions.
* Expressive facial features.
* Subtle emotional expressions.
* Carefully designed clothing.
* Organic material textures.
* Natural fabric movement.
* Realistic structural understanding with painterly simplification.
* Distinctive features consistent across illustrations.

Characters may communicate determination, mystery, sorrow, courage, uncertainty, wisdom, or vulnerability according to the narrative.
Avoid exaggerated expressions unless the story requires them.
Clothing and equipment
Use clothing and accessories that reflect the historical, cultural, and fictional setting established by the book.
Possible visual treatments include weathered textiles, layered fabrics, worn leather, embroidered garments, aged metal, or ceremonial clothing.
These elements are optional.
Do not automatically dress every character in dark armor, hooded cloaks, or battle equipment.
A dark fantasy story may take place in an ancient city, an ordinary village, an elegant palace, a quiet interior, or a mysterious natural environment.
The narrative determines what the characters wear and carry.
6. ARCHITECTURE AND WORLD DESIGN
Create sophisticated environments that communicate history, mystery, and atmospheric depth.
When appropriate to the narrative, use monumental gothic or ancient architectural influences.
Potential architectural characteristics:

* Tall vertical structures.
* Ancient stone constructions.
* Gothic arches.
* Weathered masonry.
* Forgotten ruins.
* Intricate structural silhouettes.
* Dramatic architectural proportions.
* Dark interior spaces.
* Massive bridges and elevated structures.
* Elaborate historical buildings.

These are stylistic possibilities, not mandatory objects.
The visual world must be based on the literary passage.
Do not insert castles, gothic cathedrals, graveyards, or medieval ruins into unrelated scenes.
Environmental storytelling
Architecture and landscapes should suggest that the world has a history.
Use selective surface wear, atmospheric deterioration, vegetation, and material variation where appropriate.
Environments should feel inhabited and believable rather than generic fantasy backdrops.
7. LANDSCAPES AND NATURAL ENVIRONMENTS
Create immersive, atmospheric landscapes with sophisticated painterly depth.
Possible environmental treatments include:

* Ancient forests.
* Rocky mountains.
* Mist-covered valleys.
* Dramatic coastlines.
* Remote settlements.
* Desolate plains.
* Quiet lakes.
* Stormy skies.
* Forgotten pathways.
* Dense atmospheric woodlands.

Select environments exclusively according to the narrative.
Use strong natural silhouettes, layered visual depth, and restrained environmental detail.
Depth organization
Foreground: Richer textures, stronger values, more defined edges.
Midground: Primary environmental structures and narrative elements.
Background: Atmospheric perspective, desaturated colors, softened details, and painterly abstraction.
Preserve a coherent spatial relationship between characters and surroundings.
8. GOTHIC AND ROMANTIC INFLUENCES
Introduce selected artistic characteristics associated with gothic illustration and romantic landscape painting.
Emphasize:

* Emotional intensity.
* Mysterious architecture.
* Expressive natural environments.
* Monumental scale when appropriate.
* Dramatic relationships between light and darkness.
* Melancholic atmosphere.
* Beautiful visual contrasts.
* A sense of wonder mixed with uncertainty.

Dark fantasy should feel beautiful and unsettling at the same time.
Avoid reducing the entire style to horror imagery.
The illustration can portray peaceful, intimate, reflective, or hopeful moments while retaining its dark fantasy artistic identity.
9. CINEMATIC COMPOSITION
Create beautifully structured compositions with sophisticated visual storytelling.
Use:

* Strong focal points.
* Carefully controlled negative space.
* Natural leading lines.
* Dramatic but believable perspective.
* Layered atmospheric depth.
* Elegant asymmetry.
* Meaningful character placement.
* Expressive silhouettes.
* Natural environmental framing.
* Carefully controlled visual complexity.

Narrative composition
Adapt the framing to the moment being illustrated.
For expansive scenes, use wide environmental compositions with a strong sense of scale.
For intimate scenes, use closer framing that emphasizes facial expressions, gestures, and subtle lighting.
For mysterious scenes, use controlled visibility and negative space to build anticipation.
For quiet scenes, use restrained visual rhythm and soft environmental detail.
Do not automatically transform every passage into an epic battle or monumental landscape.
10. ATMOSPHERE AND MOOD
The illustration should communicate a sophisticated range of emotions.
Possible emotional characteristics include:

* Mystery.
* Melancholy.
* Solitude.
* Wonder.
* Unease.
* Determination.
* Nostalgia.
* Anticipation.
* Discovery.
* Quiet hope.
* Emotional tension.
* Contemplation.

The mood must be derived from the literary passage.
Do not introduce fear, danger, or conflict when the narrative does not support those emotions.
The dark fantasy visual style should enhance the scene's emotional meaning rather than replace it.
11. MATERIAL RENDERING
Render materials with sophisticated painterly craftsmanship.
Stone
Weathered surfaces, natural mineral variation, subtle cracks, expressive brush texture, and controlled highlights.
Fabric
Natural folds, rich layered shadows, subtle texture, and expressive directional brushwork.
Metal
Restrained reflections, worn surfaces, nuanced value transitions, and carefully placed highlights.
Wood
Organic grain patterns, muted natural colors, and delicate surface irregularities.
Vegetation
Painterly leaf masses, natural silhouette variations, layered atmospheric depth, and selective detail.
Skin
Believable coloration, controlled painterly transitions, subtle facial volume, and natural light interaction.
Materials must look painted, never photorealistically simulated.
12. DETAIL DISTRIBUTION
Use premium illustration quality with intentional detail placement.
Primary focal points
High detail, carefully refined edges, expressive textures, and clear visual hierarchy.
Secondary subjects
Moderate detail, controlled contrast, and simplified painterly forms.
Background
Atmospheric abstraction, softer edges, reduced saturation, and selective environmental detail.
Not every part of the image should have equal sharpness.
Allow the viewer's attention to naturally move toward the most important elements.
13. VISUAL CONTINUITY ACROSS A BOOK
When illustrating multiple scenes from the same book, maintain consistency in:

* Character identity.
* Facial features and body proportions.
* Hair and clothing.
* Recurring objects and accessories.
* Architecture and environment.
* Cultural and historical references.
* Color treatment.
* Brushwork.
* Lighting philosophy.
* Material rendering.
* Level of visual detail.
* Overall dark fantasy atmosphere.

A character must remain recognizable across different scenes.
Recurring locations must maintain their established architectural identity.
Lighting and weather may change according to the narrative without changing the underlying artistic style.
14. ORIGINALITY AND INTELLECTUAL PROPERTY
All characters, creatures, costumes, architecture, and environments must be original visual interpretations of the supplied narrative.
Do not reproduce recognizable copyrighted characters, iconic costumes, signature fictional locations, or famous compositions from existing movies, games, comics, or television series.
Do not imitate the distinctive visual identity of a particular contemporary franchise.
Use broad historical painting traditions, gothic visual principles, and original fantasy design.
Create unique visual identities suitable for commercial literary illustration.
15. STRICT NEGATIVE PROMPT
Avoid:

* Photorealism.
* Hyperrealistic rendering.
* Photography.
* CGI and 3D renders.
* Unreal Engine aesthetics.
* Video-game screenshots.
* Glossy digital surfaces.
* Plastic materials.
* Perfect airbrushed gradients.
* Artificial sharpness.
* Excessive bloom.
* Neon colors unless narratively appropriate.
* Oversaturated crimson.
* Generic fantasy character designs.
* Unnecessary medieval armor.
* Random castles and ruins.
* Unnecessary monsters or supernatural creatures.
* Excessive magical particles.
* Flat vector illustration.
* Thick comic-book outlines.
* Cartoon exaggeration.
* Inconsistent character anatomy.
* Excessive visual clutter.
* Unreadable dark areas.
* Generic horror clichés.
* Recognizable copyrighted characters.
* Logos, typography, captions, and watermarks.

16. FINAL ART DIRECTION
Generate a premium, original dark fantasy literary illustration that combines traditional oil-painting craftsmanship, sophisticated cinematic atmosphere, gothic artistic influences, and expressive environmental storytelling.
The final result must feel immersive, mysterious, elegant, emotionally compelling, and artistically handcrafted.
Use restrained color palettes, dramatic tonal relationships, rich painterly textures, and carefully controlled lighting.
Preserve the visual richness of fantasy painting without becoming photorealistic.
Visual Priority Order

1. Sophisticated dark fantasy painting.
2. Organic handcrafted brushwork.
3. Dramatic cinematic lighting and shadow.
4. Atmospheric depth and painterly environmental detail.
5. Original character and world design.
6. Rich but restrained color relationships.
7. Expressive emotional storytelling.
8. Narrative fidelity and visual consistency.

The style defines the artistic execution, not the narrative content.
17. DYNAMIC SCENE INPUT — BOOKMOO
Use the following information to illustrate a specific literary scene.
SCENE DESCRIPTION:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
WORLD AND HISTORICAL CONTEXT:
{{world_context}}
ENVIRONMENT:
{{environment_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
LIGHTING AND TIME OF DAY:
{{lighting_context}}
COMPOSITION AND CAMERA ANGLE:
{{composition}}
PREVIOUS CHARACTER AND WORLD REFERENCES:
{{visual_references}}
ASPECT RATIO:
{{aspect_ratio}}
FINAL GENERATION INSTRUCTION
Create one complete, original, beautifully composed, hand-painted dark fantasy illustration.
Faithfully represent the provided literary passage and established characters.
Apply the dark fantasy visual language through painterly brushwork, color, lighting, atmosphere, texture, and composition.
Do not automatically introduce dark fantasy objects, costumes, creatures, or environments that are absent from the narrative.
Preserve character identity and visual continuity across scenes.
No text, no typography, no speech bubbles, no borders, no logos, and no watermarks.$sty$ where id = 'fantasia-sombria';
update comic_styles set prompt = $sty$04. TERROR GÓTICO — GOTHIC HORROR
Style ID: `gothic_horror_04`
Category: Gothic Horror / Victorian Gothic Illustration
Visual Identity: Mysterious, elegant, atmospheric, monochromatic, haunting, handcrafted, and dramatically illuminated.
MASTER STYLE PROMPT
Create an extraordinary, original gothic horror literary illustration combining traditional nineteenth-century book engraving, expressive pen-and-ink drawing, delicate etching techniques, atmospheric charcoal illustration, and sophisticated cinematic chiaroscuro.
The artwork must resemble a beautifully crafted illustration from an antique gothic literature collection, interpreted through premium contemporary editorial illustration techniques.
Prioritize expressive handcrafted ink linework, dramatic shadows, intricate architectural details, mysterious atmospheric depth, delicate engraved textures, and sophisticated visual storytelling.
The image must feel haunting, elegant, melancholic, mysterious, and artistically timeless.
Avoid photorealistic horror aesthetics.
The defining characteristic of this style is the combination of detailed hand-drawn engraving, expressive ink textures, dramatic chiaroscuro, and restrained monochromatic painting.
The final artwork must remain unmistakably illustrated.
1. ARTISTIC IDENTITY AND HISTORICAL INFLUENCES
Use traditional illustration techniques inspired by nineteenth-century literary engraving, Victorian gothic book illustration, classical etching, romantic-era drawing, and atmospheric pen-and-ink artwork.
The final image should resemble an original handcrafted illustration produced using fine ink pens, engraving tools, charcoal, graphite, and subtle monochromatic watercolor washes.
Primary artistic characteristics

* Fine traditional pen-and-ink drawing.
* Detailed engraved linework.
* Expressive crosshatching.
* Delicate parallel hatching.
* Traditional etching textures.
* Deep black ink masses.
* Organic hand-drawn contours.
* Subtle charcoal shading.
* Atmospheric ink washes.
* Restrained tonal transitions.
* Complex but elegant shadow construction.
* Fine architectural illustration details.
* Visible artistic imperfections.

The artwork should feel historically influenced without becoming a reproduction of a specific antique illustration.
Maintain a sophisticated balance between traditional visual craftsmanship and contemporary cinematic composition.
2. LINEWORK — THE PRIMARY VISUAL SIGNATURE
Linework is one of the most important characteristics of this visual style.
Use fine, organic, expressive black ink strokes with natural variations in thickness, density, pressure, and direction.
Primary contours
Create delicate yet confident ink outlines.
Contours should have:

* Subtle irregularities.
* Naturally variable thickness.
* Occasional broken edges.
* Fine expressive curves.
* Handcrafted imperfections.
* Selective dark accents.
* Elegant anatomical and structural definition.

Avoid perfectly uniform vector outlines.
Traditional engraved shading
Use carefully controlled line-based shading techniques.
Parallel hatching: Fine directional lines establishing gentle volume and surface transitions.
Crosshatching: Overlapping line structures creating rich tonal density.
Stippling: Small irregular ink dots used sparingly to suggest textures and atmospheric variation.
Drypoint-inspired marks: Delicate irregular strokes that create a tactile engraved appearance.
Black ink masses: Deep solid shadows that reinforce dramatic composition.
Hatching density should increase gradually in darker areas.
Avoid covering every surface with excessive crosshatching.
The linework must remain readable and visually elegant.
3. COLOR PALETTE
Use a restrained, predominantly monochromatic color palette.
Primary colors

* Deep black.
* Charcoal gray.
* Graphite.
* Warm ivory.
* Aged paper white.
* Cool silver-gray.
* Muted slate.
* Soft sepia.
* Desaturated blue-gray.

Optional accent colors
Use extremely restrained accent colors only when relevant to the narrative.
Possible accents include:

* Warm amber candlelight.
* Muted antique gold.
* Pale moonlight blue.
* Subtle burgundy.
* Desaturated forest green.

The image should feel predominantly black-and-white, with occasional atmospheric tonal variation.
Avoid vibrant, saturated color schemes.
Never force a specific color accent into every illustration.
The literary context determines whether accent colors are necessary.
4. LIGHTING AND CHIAROSCURO
Use dramatic chiaroscuro as a fundamental component of the visual language.
Construct strong visual relationships between deep shadows and carefully placed illumination.
Lighting characteristics

* Intense directional contrast.
* Deep atmospheric shadows.
* Restrained highlights.
* Soft moonlight.
* Candlelight and lantern illumination when appropriate.
* Controlled rim lighting.
* Diffused light through mist.
* Strong silhouettes.
* Carefully illuminated facial expressions.
* Gradual tonal transitions through engraved shading.

Light should reveal only the most narratively important areas.
Allow selected environmental elements to disappear into darkness.
However, maintain enough visual information for characters and meaningful objects to remain recognizable.
Shadow construction
Combine solid ink shadows with fine crosshatched tonal transitions.
Use shadow to create mystery, depth, emotional tension, and visual hierarchy.
Avoid excessively crushed blacks that remove essential narrative information.
5. CHARACTER DESIGN
Create original characters with sophisticated gothic literary illustration characteristics.
Characters must reflect the historical, cultural, and narrative setting of the source material.
Character rendering

* Believable anatomy.
* Elegant, expressive silhouettes.
* Natural facial proportions.
* Subtle emotional expressions.
* Carefully illustrated hair.
* Expressive eyes and gestures.
* Fine engraved shading.
* Detailed but controlled clothing textures.
* Natural posture and body language.
* Hand-drawn anatomical imperfections.

Faces should communicate emotions such as uncertainty, curiosity, sorrow, determination, suspicion, or apprehension according to the narrative.
Clothing
Use historically appropriate clothing when supported by the story.
Potential visual influences include:

* Victorian formalwear.
* Edwardian garments.
* Gothic historical fashion.
* Traditional coats and dresses.
* Period-specific accessories.
* Elaborate fabrics.
* Antique jewelry.

These are optional visual references.
Do not automatically dress every character in Victorian clothing.
The style must also work with contemporary or fictional settings.
Avoid recognizable copyrighted character designs.
6. ARCHITECTURE AND ENVIRONMENT
Render environments through detailed traditional ink illustration.
Architecture should have elegant structural definition, intricate surface detail, and sophisticated atmospheric depth.
Possible gothic architectural influences

* Pointed arches.
* Tall narrow windows.
* Ornate stone structures.
* Wrought-iron gates.
* Historical mansions.
* Antique interiors.
* Monumental staircases.
* Weathered masonry.
* Ancient corridors.
* Elaborate wooden doors.
* Decorative structural elements.

Use these elements only when appropriate to the narrative.
Do not insert gothic mansions, cemeteries, or churches into unrelated scenes.
Environmental rendering
Use expressive engraved contours for architecture, vegetation, furniture, and environmental objects.
Allow distant structures to become partially obscured by mist, shadow, or reduced line density.
Preserve strong structural readability.
7. ATMOSPHERE AND ENVIRONMENTAL EFFECTS
Atmosphere should feel mysterious, quiet, and emotionally immersive.
Use carefully controlled atmospheric elements.
Potential techniques:

* Fine engraved fog.
* Soft charcoal haze.
* Thin atmospheric mist.
* Subtle rain.
* Diffused moonlight.
* Dark cloud formations.
* Delicate environmental shadows.
* Gentle dust particles.
* Soft ink-wash gradients.

Atmospheric effects should be integrated naturally with the illustration.
Avoid artificial digital fog overlays and excessive visual effects.
Do not introduce storms, full moons, or supernatural phenomena unless appropriate to the scene.
8. GOTHIC LITERARY ATMOSPHERE
The illustration should communicate mystery, unease, psychological tension, and poetic melancholy.
Use visual storytelling to suggest uncertainty and hidden meaning.
Emotional characteristics

* Mystery.
* Isolation.
* Suspense.
* Elegance.
* Melancholy.
* Unease.
* Psychological tension.
* Nostalgia.
* Curiosity.
* Silent anticipation.
* Supernatural ambiguity.

The atmosphere should emerge from composition, lighting, environmental detail, and character expression.
Avoid relying on graphic violence, disturbing imagery, or exaggerated horror clichés.
Gothic horror is defined by atmosphere and psychological storytelling, not graphic content.
9. COMPOSITION AND VISUAL STORYTELLING
Create sophisticated literary compositions with a strong cinematic sensibility.
Use:

* Strong visual hierarchy.
* Dramatic negative space.
* Asymmetrical framing.
* Carefully composed silhouettes.
* Architectural leading lines.
* Intimate character portraits.
* Elegant perspective.
* Atmospheric depth.
* Meaningful foreground elements.
* Controlled distribution of detail.

Framing principles
For character-focused scenes, emphasize facial expressions, lighting, and psychological atmosphere.
For environmental scenes, use architecture, scale, and perspective to communicate mystery.
For intimate scenes, use carefully controlled shadow and subtle composition.
For suspenseful scenes, suggest uncertainty through selective visibility and negative space.
The composition must remain faithful to the literary passage.
10. TEXTURE AND MATERIALITY
The artwork should have the tactile qualities of traditional ink on paper.
Material characteristics

* Fine paper grain.
* Slightly uneven ink absorption.
* Delicate engraving imperfections.
* Natural variations in line density.
* Subtle charcoal smudging.
* Fine dry-ink textures.
* Restrained antique-paper characteristics.
* Organic surface irregularities.

Texture must remain subtle and naturally integrated.
Avoid excessive distressed-paper overlays, artificial scratches, stains, and heavy digital noise.
The illustration should feel carefully preserved rather than damaged or dirty.
11. DEPTH AND SPATIAL TREATMENT
Create depth through differences in line density, tonal contrast, and atmospheric definition.
Foreground
Use stronger black values, sharper engraved lines, rich textures, and carefully rendered details.
Midground
Maintain moderate contrast, readable structural forms, and balanced shading.
Background
Use reduced line density, softer tonal transitions, delicate atmospheric washes, and simplified silhouettes.
Depth should feel natural without depending on photographic depth-of-field effects.
12. ARTISTIC DETAIL DISTRIBUTION
Use premium literary illustration quality with intentional control over detail.
Primary focal points
Fine engraving, carefully constructed crosshatching, strong contrast, and expressive contours.
Secondary elements
Moderate line density, simplified textures, and controlled shadow transitions.
Atmospheric background
Soft charcoal washes, delicate silhouettes, reduced detail, and restrained tonal variation.
Avoid uniformly detailed compositions.
The visual hierarchy should guide the viewer naturally toward the important narrative elements.
13. CHARACTER AND WORLD CONSISTENCY
When generating multiple illustrations from the same book, preserve consistency in:

* Character appearance.
* Facial features and proportions.
* Clothing and accessories.
* Architectural characteristics.
* Historical details.
* Recurring objects.
* Environment design.
* Engraving techniques.
* Linework density.
* Paper texture.
* Monochromatic palette.
* Lighting philosophy.
* Overall gothic atmosphere.

Recurring characters must remain visually recognizable.
Locations must retain their established identities.
Changes in lighting or environment must reflect the narrative rather than arbitrary artistic variation.
14. ORIGINALITY AND COPYRIGHT
Every illustration must be an original interpretation of the supplied literary narrative.
Do not reproduce recognizable characters, costumes, environments, or iconic compositions from existing movies, comics, television series, or games.
Use general gothic literature, historical engraving techniques, and classical illustration principles rather than imitating the distinctive visual identity of a particular copyrighted property.
Create original characters and visually coherent environments suitable for a commercial literary illustration library.
15. STRICT NEGATIVE PROMPT
Avoid:

* Photorealism.
* Photography.
* Hyperrealistic rendering.
* CGI.
* 3D rendering.
* Unreal Engine aesthetics.
* Glossy digital painting.
* Plastic-looking materials.
* Flat vector illustration.
* Corporate illustration.
* Modern cartoon aesthetics.
* Anime character proportions.
* Comic-book superhero styling.
* Bright saturated colors.
* Neon lighting.
* Excessive bloom.
* Artificial lens flares.
* Heavy digital airbrushing.
* Perfectly clean vector contours.
* Uniform line thickness.
* Excessive crosshatching.
* Unreadable black areas.
* Excessively distressed textures.
* Generic horror clichés.
* Unnecessary supernatural figures.
* Unnecessary gothic buildings.
* Graphic violence.
* Excessive visual clutter.
* Recognizable copyrighted characters.
* Logos.
* Text.
* Typography.
* Captions.
* Watermarks.
* Decorative page borders.

16. FINAL ART DIRECTION
Create an original, sophisticated gothic horror literary illustration combining fine traditional engraving, expressive pen-and-ink drawing, elegant charcoal shading, dramatic chiaroscuro, and mysterious atmospheric storytelling.
The image must feel handcrafted, timeless, haunting, and visually refined.
Prioritize artistic linework, sophisticated shadow construction, atmospheric depth, and emotional visual storytelling over photorealistic rendering.
Visual Priority Order

1. Traditional gothic engraving and pen-and-ink craftsmanship.
2. Fine expressive linework and controlled crosshatching.
3. Dramatic chiaroscuro and sophisticated shadow treatment.
4. Restrained monochromatic color palette.
5. Elegant architectural and character illustration.
6. Atmospheric mystery and psychological tension.
7. Original narrative-appropriate character design.
8. Visual consistency across multiple illustrations.

The illustration technique defines the style. The literary scene determines the content.
17. DYNAMIC SCENE INPUT — BOOKMOO
Illustrate the following literary scene using the gothic horror artistic principles established above.
SCENE DESCRIPTION:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
HISTORICAL AND CULTURAL CONTEXT:
{{world_context}}
ENVIRONMENT:
{{environment_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
LIGHTING AND TIME OF DAY:
{{lighting_context}}
COMPOSITION AND CAMERA ANGLE:
{{composition}}
PREVIOUS CHARACTER AND WORLD REFERENCES:
{{visual_references}}
ASPECT RATIO:
{{aspect_ratio}}
FINAL GENERATION INSTRUCTION
Generate one complete, original, beautifully composed gothic horror literary illustration.
Use sophisticated traditional engraving techniques, expressive ink contours, carefully controlled crosshatching, dramatic chiaroscuro, monochromatic atmospheric painting, and elegant gothic visual storytelling.
Follow the provided literary passage faithfully.
Maintain consistent character identities, environmental details, and visual style across multiple illustrations.
Do not introduce unrelated gothic architecture, supernatural elements, or horror imagery.
The illustration must remain artistically handcrafted and visually sophisticated.
No text, no captions, no speech bubbles, no typography, no logos, no decorative borders, and no watermarks.$sty$ where id = 'terror-gotico';
update comic_styles set prompt = $sty$05. FICÇÃO CIENTÍFICA — SCIENCE FICTION
Style ID: `science_fiction_05`
Category: Science Fiction / Futuristic Concept Art
Visual Identity: Futuristic, cinematic, technological, atmospheric, sophisticated, immersive, and painterly.
MASTER STYLE PROMPT
Create an extraordinary, original science fiction literary illustration combining premium cinematic concept art, sophisticated digital painting, futuristic environmental design, expressive character illustration, and atmospheric visual storytelling.
The artwork must resemble a beautifully crafted illustration from a high-quality science fiction novel, combining the artistic sophistication of traditional painting with the imaginative visual language of futuristic world-building.
Prioritize believable technological design, sophisticated lighting, immersive environmental depth, carefully constructed futuristic architecture, expressive human characters, and elegant painterly craftsmanship.
The illustration should feel cinematic, imaginative, atmospheric, intellectually intriguing, and visually extraordinary.
The defining characteristic of this style is the combination of believable futuristic design, premium painterly science fiction illustration, sophisticated cinematic lighting, and immersive environmental storytelling.
The result must remain unmistakably illustrated rather than resembling a photograph, 3D render, or video-game screenshot.
1. ARTISTIC IDENTITY AND PAINTING TECHNIQUE
Use sophisticated digital painting techniques influenced by traditional oil painting, architectural concept art, science fiction illustration, and cinematic visual development.
The visual result must feel carefully designed and painted by an accomplished science fiction illustrator.
Primary artistic characteristics

* Premium hand-painted digital concept art.
* Expressive but controlled brushwork.
* Sophisticated environmental painting.
* Believable futuristic structures.
* Carefully rendered technological surfaces.
* Strong architectural silhouettes.
* Natural painterly imperfections.
* Cinematic atmospheric perspective.
* Elegant character rendering.
* Rich but restrained material textures.
* Selectively detailed focal points.
* Soft atmospheric transitions.
* Strong visual hierarchy.

Maintain a balance between technical precision and expressive artistic painting.
Architectural and mechanical structures may feature controlled geometric lines, but the overall illustration must retain visible brushwork and organic artistic interpretation.
Avoid perfectly sterile digital rendering.
2. LINEWORK AND VISUAL CONSTRUCTION
Use a combination of precise structural design and expressive painterly edges.
Unlike traditional ink illustration, this style should rely primarily on painted forms, lighting, atmospheric depth, and material rendering.
Structural linework

* Clean architectural perspective.
* Carefully defined mechanical structures.
* Sophisticated technological silhouettes.
* Controlled geometric details.
* Elegant industrial design.
* Thin technical accents where appropriate.
* Believable dimensional construction.

Painterly treatment

* Natural variation in edge sharpness.
* Soft transitions in atmospheric areas.
* Visible handcrafted brushwork.
* Selective imperfect strokes.
* Organic material variations.
* Reduced detail outside focal areas.

Technical objects should feel engineered and believable without becoming mechanically over-rendered.
Do not cover every surface with unnecessary futuristic lines, circuits, or decorative machinery.
3. COLOR LANGUAGE
Use sophisticated science fiction color palettes adapted to the fictional world and emotional atmosphere.
Primary color families
Cool futuristic tones

* Deep midnight blue.
* Atmospheric cyan.
* Steel blue.
* Desaturated teal.
* Slate gray.
* Cool silver.
* Deep navy.

Technological neutrals

* Titanium gray.
* Brushed aluminum.
* Matte graphite.
* Ceramic white.
* Carbon black.
* Soft industrial beige.

Environmental colors

* Deep space violet.
* Muted planetary orange.
* Mineral green.
* Atmospheric lavender.
* Dusty red.
* Desaturated desert brown.

Controlled accents

* Soft electric cyan.
* Warm amber.
* Pale holographic blue.
* Muted orange.
* Restrained luminous white.

Palette principles
Use carefully controlled warm and cool relationships.
Allow each fictional civilization, planet, historical period, or technological environment to establish a distinct color identity.
Reserve highly saturated colors for narratively meaningful light sources, interfaces, or focal points.
Do not automatically make every science fiction scene blue, neon, or metallic.
A science fiction story may contain warm domestic interiors, natural landscapes, ancient environments, or ordinary human settings.
Preserve the science fiction illustration technique while respecting the world described by the book.
4. CINEMATIC LIGHTING
Lighting is fundamental to the visual identity of this style.
Use sophisticated cinematic illumination inspired by high-quality science fiction concept art.
Lighting characteristics

* Atmospheric directional lighting.
* Soft volumetric illumination.
* Controlled technological light sources.
* Subtle environmental reflections.
* Cinematic rim lighting.
* Natural light interacting with futuristic materials.
* Diffused illumination through atmospheric particles.
* Carefully balanced warm and cool light.
* Soft reflected light.
* Sophisticated shadow construction.

Possible light sources

* Natural sunlight.
* Planetary atmospheric illumination.
* Artificial interior lighting.
* Laboratory illumination.
* Spacecraft windows.
* Technological displays.
* Industrial lighting.
* Distant celestial light.

Use these sources only when narratively appropriate.
Avoid excessive neon, artificial bloom, random holographic lighting, and unnecessary lens flares.
Lighting should feel believable within the fictional world's physical and technological rules.
5. CHARACTER DESIGN
Create original, sophisticated science fiction characters appropriate to the literary narrative.
Characters must feel emotionally believable and visually integrated into the world.
Character rendering

* Believable human anatomy.
* Natural facial proportions.
* Expressive eyes and gestures.
* Carefully designed silhouettes.
* Sophisticated costume design.
* Natural posture.
* Painterly skin rendering.
* Controlled facial detail.
* Appropriate material textures.
* Consistent visual identities.

Character design should reflect the fictional society, technological development, environment, and cultural background established by the source material.
Futuristic clothing
Possible designs may include:

* Advanced functional clothing.
* Minimalist technological uniforms.
* Scientific protective garments.
* Space exploration suits.
* Civilian futuristic fashion.
* Industrial workwear.
* Environmental protection equipment.
* Culturally distinctive fictional garments.

These elements are optional.
Do not automatically place every character in a spacesuit, military armor, or futuristic combat uniform.
A science fiction narrative may feature ordinary people living in technologically advanced environments.
Clothing must correspond to the actual scene.
6. FUTURISTIC TECHNOLOGY DESIGN
Technology must feel visually coherent, functional, and appropriate to the fictional world.
Avoid generic decorative science fiction machinery.
Design principles

* Believable mechanical construction.
* Consistent technological language.
* Functional interfaces and control systems.
* Carefully designed materials.
* Realistic structural relationships.
* Coherent industrial design.
* Purposeful technological details.
* Clear visual hierarchy.
* Distinctive fictional engineering.

Potential technological elements include spacecraft, scientific instruments, robotics, advanced transportation, artificial intelligence systems, communication devices, and environmental technologies.
Use these objects only when present or strongly implied by the narrative.
Technology rendering
Represent technological surfaces through sophisticated painterly materials.
Use restrained reflections, controlled highlights, subtle wear, and carefully designed details.
Avoid unnecessary glowing circuits, random mechanical components, and excessively intricate machinery.
Technology must serve the story rather than dominate every illustration.
7. ARCHITECTURE AND FUTURISTIC ENVIRONMENTS
Create immersive architectural environments that suggest believable technological civilizations.
Possible architectural influences

* Futuristic minimalism.
* Monumental science fiction structures.
* Advanced research facilities.
* Sustainable future cities.
* Orbital habitats.
* Interplanetary settlements.
* Industrial space infrastructure.
* Advanced transportation terminals.
* Modular technological environments.
* Brutalist futuristic architecture.
* Biophilic architectural systems.

Architectural forms should reflect the society and technological context described by the book.
Environmental rendering
Use believable spatial relationships, sophisticated perspective, and carefully controlled material variation.
Architecture should suggest a functional world with history, infrastructure, and purpose.
Avoid filling every environment with generic futuristic skyscrapers.
The design of the environment must be determined by the literary world, not by futuristic stereotypes.
8. SPACE AND PLANETARY ENVIRONMENTS
When the narrative involves space exploration, create spectacular but believable science fiction environments.
Space environment characteristics

* Carefully composed celestial bodies.
* Immersive planetary landscapes.
* Atmospheric horizons.
* Believable spacecraft silhouettes.
* Sophisticated environmental lighting.
* Painterly nebulae when appropriate.
* Realistic spatial relationships.
* Strong contrast between illuminated and shadowed structures.
* Natural planetary color variation.

Planetary landscapes
Use original environmental designs based on the fictional world's established characteristics.
Potential elements include rocky terrain, unusual vegetation, alien geological formations, extreme climates, distant settlements, or unfamiliar atmospheric conditions.
Do not automatically introduce extraterrestrial creatures, futuristic cities, or spacecraft.
Preserve narrative accuracy.
Space scenes should feel grand and immersive without becoming generic astronomy wallpapers.
9. ROBOTICS AND ARTIFICIAL INTELLIGENCE
When the narrative includes robots or artificial intelligence, create original, visually coherent technological designs.
Robotics principles

* Functional mechanical construction.
* Believable articulation.
* Carefully designed proportions.
* Consistent material language.
* Clear mechanical silhouettes.
* Purposeful sensor placement.
* Natural interaction with environments.
* Expressive visual identities when relevant.

Avoid copying recognizable robots from popular movies, games, or franchises.
Robotic characters should possess distinctive forms appropriate to their fictional purpose.
AI systems without physical bodies should not automatically be represented as humanoid robots.
Their depiction must follow the source narrative.
10. COMPOSITION AND CINEMATIC STORYTELLING
Create sophisticated compositions with the visual quality of premium science fiction concept art.
Use:

* Strong visual hierarchy.
* Cinematic framing.
* Elegant asymmetry.
* Believable perspective.
* Carefully positioned characters.
* Natural leading lines.
* Layered environmental depth.
* Strong silhouettes.
* Meaningful negative space.
* Controlled distribution of detail.

Narrative framing
Exploration scenes: Emphasize scale, environment, discovery, and spatial relationships.
Character-driven scenes: Prioritize faces, gestures, expressions, and emotional interaction.
Scientific scenes: Emphasize meaningful technology, instruments, and human interaction with scientific environments.
Mysterious scenes: Use controlled visibility, atmospheric lighting, and deliberate composition.
Quiet scenes: Preserve intimacy, simplicity, and emotional depth without unnecessary spectacle.
Do not automatically turn every science fiction scene into an epic space battle or a monumental cityscape.
11. MATERIALS AND SURFACE RENDERING
Render materials using sophisticated painterly techniques with believable physical characteristics.
Metal
Controlled reflections, subtle surface wear, realistic structural shading, and restrained highlights.
Glass
Believable transparency, environmental reflections, subtle distortion, and natural light interaction.
Advanced ceramics
Smooth matte surfaces, subtle variations in color, controlled highlights, and elegant structural details.
Fabric
Natural folds, believable material thickness, restrained surface texture, and painterly shadow transitions.
Synthetic materials
Sophisticated surface treatment reflecting the technological level of the fictional world.
Natural materials
Organic texture, realistic environmental variation, and painterly interpretation.
Avoid excessive photorealistic microtextures.
Materials must feel painted rather than physically rendered by a 3D engine.
12. ATMOSPHERE AND ENVIRONMENTAL DEPTH
Build immersive environments through atmospheric perspective and sophisticated light interaction.
Use environmental effects when appropriate:

* Subtle atmospheric haze.
* Fine dust particles.
* Planetary mist.
* Environmental reflections.
* Diffused artificial illumination.
* Gentle smoke from industrial environments.
* Atmospheric light scattering.
* Soft volumetric depth.

These effects should reinforce scale and visual storytelling.
Avoid excessive fog, random particle effects, and generic cinematic decoration.
13. EMOTIONAL AND THEMATIC RANGE
Science fiction illustration must support a wide range of literary emotions.
Possible visual atmospheres include:

* Wonder and discovery.
* Scientific curiosity.
* Isolation.
* Mystery.
* Hope.
* Technological optimism.
* Existential contemplation.
* Nostalgia.
* Human connection.
* Uncertainty.
* Exploration.
* Melancholy.
* Quiet contemplation.

The emotional atmosphere must be derived from the source passage.
Do not force every scene to feel dystopian, dangerous, or technologically overwhelming.
Science fiction may be intimate, peaceful, philosophical, or emotionally delicate.
The illustration style must support all these possibilities.
14. LEVEL OF DETAIL
Use carefully controlled detail distribution.
Primary subjects
High visual detail, refined forms, sophisticated textures, and clear focal emphasis.
Secondary elements
Moderate detail, balanced contrast, and simplified material rendering.
Background
Atmospheric abstraction, reduced texture density, softer edges, and controlled environmental detail.
Maintain high overall artistic quality without making every surface equally sharp.
Preserve visible painterly brushwork.
Avoid artificial sharpening and excessively detailed technological noise.
15. WORLD-BUILDING CONSISTENCY
When generating multiple illustrations from the same book, maintain strict consistency in:

* Character identity.
* Facial features and proportions.
* Clothing and equipment.
* Spaceship and vehicle design.
* Robotic characters.
* Architecture.
* Technology level.
* Interface design language.
* Materials.
* Color grading.
* Lighting philosophy.
* Planetary environments.
* Fictional cultures.
* Painterly rendering technique.

Recurring characters must remain recognizable.
Technological objects and environments must preserve their established designs.
Do not arbitrarily change the visual identity of spaceships, cities, uniforms, or other recurring elements.
Technological coherence
Respect the fictional world's technological rules.
Do not introduce advanced holographic systems into a narrative that only describes analog technology.
Do not automatically replace existing historical or mechanical objects with futuristic alternatives.
The illustration must accurately represent the world established by the book.
16. ORIGINALITY AND COPYRIGHT
Every illustration must be an original visual interpretation of the supplied literary narrative.
Do not reproduce recognizable copyrighted characters, iconic spacecraft, famous robotic designs, recognizable uniforms, signature fictional cities, or distinctive compositions from existing movies, television series, games, or comics.
Use broad science fiction illustration principles, architectural design, industrial design, and original futuristic imagination.
Create unique characters, environments, machines, and civilizations suitable for a commercial literary illustration library.
17. STRICT NEGATIVE PROMPT
Avoid:

* Photorealism.
* Photography.
* Hyperrealistic rendering.
* CGI.
* 3D rendering.
* Unreal Engine aesthetics.
* Video-game screenshots.
* Plastic-looking materials.
* Excessively smooth digital surfaces.
* Flat vector illustration.
* Corporate illustration.
* Generic AI-generated science fiction aesthetics.
* Excessive neon.
* Cyberpunk aesthetics unless required by the narrative.
* Random holograms.
* Unnecessary glowing circuits.
* Excessive blue lighting.
* Oversaturated colors.
* Excessive bloom.
* Artificial lens flares.
* Overly complicated mechanical details.
* Incoherent futuristic technology.
* Random spacecraft.
* Unnecessary robots.
* Generic futuristic skyscrapers.
* Inconsistent character anatomy.
* Artificially sharpened surfaces.
* Excessive visual clutter.
* Recognizable copyrighted characters.
* Iconic licensed spacecraft or robots.
* Logos.
* Text.
* Typography.
* Captions.
* Speech bubbles.
* Watermarks.
* Decorative borders.

18. FINAL ART DIRECTION
Generate an original, extraordinary science fiction literary illustration combining premium futuristic concept art, sophisticated digital painting, believable technological design, cinematic lighting, and immersive environmental storytelling.
The result must feel imaginative, cinematic, artistically handcrafted, and visually coherent.
Prioritize expressive painterly craftsmanship, sophisticated composition, atmospheric depth, believable technology, and emotional narrative accuracy.
Maintain a beautiful balance between advanced futuristic visual design and traditional illustration sensibility.
Visual Priority Order

1. Premium painterly science fiction concept art.
2. Believable futuristic design and technological coherence.
3. Sophisticated cinematic composition.
4. Atmospheric environmental depth.
5. Original characters and expressive storytelling.
6. Carefully controlled lighting and materials.
7. Elegant, story-appropriate color relationships.
8. Consistent fictional world-building.
9. Faithful representation of the literary passage.

The visual style defines how the scene is illustrated. The narrative determines what must appear in the image.
19. DYNAMIC SCENE INPUT — BOOKMOO
Illustrate the following literary scene using the science fiction artistic principles established above.
SCENE DESCRIPTION:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
FICTIONAL WORLD AND TECHNOLOGICAL CONTEXT:
{{world_context}}
ENVIRONMENT:
{{environment_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
LIGHTING AND TIME OF DAY:
{{lighting_context}}
COMPOSITION AND CAMERA ANGLE:
{{composition}}
PREVIOUS CHARACTER AND WORLD REFERENCES:
{{visual_references}}
ASPECT RATIO:
{{aspect_ratio}}
FINAL GENERATION INSTRUCTION
Generate one complete, original, beautifully composed, premium science fiction literary illustration.
Apply sophisticated futuristic concept art techniques, expressive painterly brushwork, cinematic environmental lighting, believable technological design, and immersive atmospheric storytelling.
Follow the supplied literary passage faithfully.
Maintain established character identities, technological consistency, environmental continuity, and coherent visual design across multiple illustrations.
Do not introduce unrelated spacecraft, robots, futuristic architecture, holograms, or advanced technological elements unless supported by the narrative.
Do not imitate copyrighted characters or recognizable fictional franchises.
The final image must remain distinctly illustrated rather than photorealistic.
No text, no captions, no typography, no speech bubbles, no logos, no decorative borders, and no watermarks.$sty$ where id = 'ficcao-cientifica';
update comic_styles set prompt = $sty$06. CYBERPUNK — NEON DYSTOPIA
Style ID: `cyberpunk_06`
Category: Cyberpunk / Dystopian Science Fiction Illustration
Visual Identity: Neon-lit, futuristic, urban, cinematic, atmospheric, gritty, technologically sophisticated, and richly illustrated.
MASTER STYLE PROMPT
Create an extraordinary, original cyberpunk literary illustration combining premium futuristic concept art, expressive digital painting, cinematic neo-noir photography principles, sophisticated environmental design, and atmospheric science fiction storytelling.
The artwork must resemble a beautifully illustrated scene from a premium cyberpunk graphic novel or dystopian science fiction art book.
Prioritize sophisticated urban world-building, expressive painterly textures, atmospheric lighting, carefully constructed futuristic architecture, visually compelling original characters, and believable technological details.
The illustration should feel immersive, mysterious, futuristic, emotionally expressive, and visually extraordinary.
The defining characteristic of this style is the combination of densely layered technological environments, sophisticated neon illumination, painterly cinematic atmosphere, and striking neo-noir visual storytelling.
The final image must remain unmistakably an illustration rather than a photograph, video-game screenshot, or CGI rendering.
1. ARTISTIC IDENTITY AND PAINTING TECHNIQUE
Use sophisticated digital illustration techniques inspired by traditional oil painting, premium science fiction concept art, hand-painted environmental design, and contemporary graphic novel aesthetics.
The image should feel meticulously crafted by an accomplished illustrator.
Primary artistic characteristics

* Premium cinematic digital painting.
* Expressive and visible brushwork.
* Sophisticated futuristic environmental illustration.
* Strong visual silhouettes.
* Carefully designed urban architecture.
* Rich atmospheric perspective.
* Controlled reflections and wet surfaces.
* Vibrant but balanced artificial illumination.
* Elegant character rendering.
* Organic painterly imperfections.
* Selectively detailed focal points.
* Sophisticated shadow construction.
* Rich material variation.
* Subtle graphic novel influences.

Preserve visible brushwork in selected areas.
Avoid sterile digital surfaces and excessively smooth rendering.
The illustration must have an artistic personality rather than looking like a generic futuristic 3D environment.
2. LINEWORK AND PAINTERLY CONSTRUCTION
Use a sophisticated combination of structural drawing and expressive painterly rendering.
Structural design
Architecture, technological objects, vehicles, and machinery should demonstrate believable geometric construction.
Use:

* Accurate architectural perspective.
* Carefully defined structural silhouettes.
* Precise mechanical construction.
* Elegant industrial design.
* Controlled technological details.
* Thin technical line accents.
* Natural dimensional relationships.

Painterly treatment
Integrate expressive painted edges throughout the scene.
Use:

* Organic brush strokes.
* Slightly irregular painted contours.
* Soft transitions in atmospheric areas.
* Selective sharp edges around important objects.
* Subtle texture variation.
* Expressive strokes for clothing, hair, and environmental details.

The illustration should balance technical accuracy with traditional artistic craftsmanship.
Avoid overly precise vector-like rendering.
3. CYBERPUNK COLOR LANGUAGE
Use a sophisticated, cinematic cyberpunk palette characterized by dramatic relationships between artificial lighting and dark atmospheric environments.
Primary color families
Electric neon

* Vibrant magenta.
* Deep violet.
* Electric cyan.
* Saturated blue.
* Neon pink.
* Controlled ultraviolet.

Dark urban neutrals

* Carbon black.
* Charcoal gray.
* Midnight blue.
* Wet asphalt gray.
* Deep indigo.
* Industrial graphite.

Warm artificial illumination

* Amber.
* Warm orange.
* Muted red.
* Golden yellow.
* Industrial tungsten.

Technological accents

* Turquoise.
* Pale holographic cyan.
* Soft electric green.
* Desaturated silver.
* Metallic blue-gray.

Color relationships
Use strong warm-versus-cool lighting contrast.
A scene may feature deep blue shadows illuminated by magenta signs or warm amber interiors contrasted with cold cyan city lights.
Maintain visual balance.
Do not saturate the entire image equally.
Reserve the most intense colors for meaningful visual focal points.
Important palette rule
Cyberpunk does not mean that every scene must contain pink and blue neon.
Daytime environments, private interiors, industrial spaces, underground facilities, and quiet character moments should retain the same artistic identity while adapting the palette.
The cyberpunk style must remain recognizable through architecture, material treatment, lighting philosophy, and urban atmosphere—not through a single fixed color combination.
4. CINEMATIC NEON LIGHTING
Lighting is one of the most important characteristics of the cyberpunk visual language.
Use sophisticated combinations of artificial illumination, cinematic contrast, and atmospheric environmental light.
Lighting characteristics

* Dramatic neon illumination.
* Strong warm and cool light contrast.
* Subtle colored rim lighting.
* Layered environmental reflections.
* Atmospheric light diffusion.
* Soft illuminated haze.
* High-contrast shadow masses.
* Carefully controlled highlights.
* Realistic light interaction with materials.
* Complex but visually coherent urban illumination.

Potential light sources

* Building signage.
* Architectural lighting.
* Public transportation infrastructure.
* Industrial lamps.
* Electronic displays.
* Vehicle headlights.
* Interior ambient lights.
* Streetlights.
* Interactive technological interfaces.

Use these elements only when appropriate to the narrative.
Lighting philosophy
Every significant light source must have a believable origin.
Colored illumination should interact naturally with faces, clothing, metallic surfaces, windows, and nearby environments.
Avoid random colored highlights without corresponding light sources.
Avoid excessive bloom and exaggerated lens flares.
5. CHARACTER DESIGN
Create sophisticated, original cyberpunk characters with believable anatomy, strong silhouettes, and compelling visual identities.
Characters should communicate personality through clothing, gestures, expressions, and environmental interaction.
Character illustration

* Natural human proportions.
* Expressive facial features.
* Strong visual silhouettes.
* Distinctive hairstyles.
* Believable body language.
* Natural fabric folds.
* Detailed but painterly skin rendering.
* Carefully designed clothing.
* Sophisticated lighting on faces.
* Appropriate technological accessories.
* Consistent character appearance across scenes.

Characters should feel like real individuals inhabiting a technologically advanced society.
Clothing design
Possible visual influences include:

* Futuristic streetwear.
* Technical jackets.
* Layered urban clothing.
* Functional industrial fashion.
* Advanced synthetic textiles.
* Minimalist corporate attire.
* Protective environmental garments.
* Contemporary clothing adapted to a futuristic setting.
* Distinctive subcultural fashion.

These are optional design possibilities.
Do not automatically dress every character in black leather, glowing armor, or futuristic combat equipment.
Costume design must reflect the character's identity, socioeconomic context, and narrative role.
6. CYBERNETICS AND HUMAN AUGMENTATION
When the literary narrative includes cybernetic implants, artificial body components, or advanced human augmentation, create visually believable original designs.
Cybernetic design principles

* Functional mechanical construction.
* Anatomically coherent integration.
* Realistic articulation.
* Sophisticated material transitions.
* Carefully designed technological interfaces.
* Purposeful details.
* Believable structural connections.
* Restrained illuminated elements.
* Original industrial design language.

Integration with characters
Cybernetic components must feel naturally integrated into the fictional world's technology.
Avoid unnecessary mechanical complexity.
Do not introduce cybernetic implants into characters who are not described as having them.
The visual style must not invent physical modifications absent from the source material.
7. FUTURISTIC URBAN ENVIRONMENTS
Create immersive cyberpunk environments that communicate technological development, urban density, social complexity, and layered infrastructure.
Architectural characteristics
Potential visual elements include:

* Dense futuristic cityscapes.
* Vertical urban structures.
* Layered transportation networks.
* Industrial architectural systems.
* Advanced residential buildings.
* Elevated walkways.
* Massive commercial districts.
* Underground urban environments.
* Brutalist architecture.
* Futuristic corporate towers.
* Modular buildings.
* Technologically integrated street environments.

Use architectural influences appropriate to the fictional world.
Urban storytelling
Environments should suggest the everyday functioning of a technologically advanced society.
Use details that reveal infrastructure, commerce, transportation, architecture, social organization, and cultural identity.
The city should feel inhabited rather than merely decorative.
Avoid filling every scene with random glowing signs and futuristic skyscrapers.
8. ENVIRONMENTAL ATMOSPHERE
Build sophisticated atmospheric depth using light, shadow, perspective, and environmental conditions.
Atmospheric techniques

* Subtle urban haze.
* Diffused artificial lighting.
* Layered environmental depth.
* Atmospheric color separation.
* Gentle smoke when appropriate.
* Light interacting with moisture.
* Controlled environmental reflections.
* Soft distant silhouettes.
* Selective depth reduction.
* Painterly light scattering.

Rain and wet surfaces
When narratively appropriate, use rain-soaked streets and reflective surfaces.
Represent wet materials through:

* Distorted colored reflections.
* Subtle puddles.
* Irregular reflected light.
* Soft atmospheric highlights.
* Painterly surface variation.
* Carefully controlled specular accents.

Rain must not be mandatory.
A cyberpunk scene can take place under bright sunlight, inside a sterile technological facility, or in an ordinary residential environment.
Adapt the visual atmosphere to the actual narrative.
9. TECHNOLOGY AND INDUSTRIAL DESIGN
Create believable futuristic technological objects with consistent fictional engineering.
Possible technological categories include:

* Advanced communication devices.
* Robotics.
* Artificial intelligence interfaces.
* Autonomous transportation.
* Scientific instruments.
* Augmented reality systems.
* Industrial machinery.
* Advanced security infrastructure.
* Wearable technology.
* High-density computing systems.

Design rules
Every technological object must have a clear functional purpose.
Use coherent material language, believable mechanisms, and consistent structural design.
Technology should communicate the fictional society's level of development.
Avoid visually incoherent machinery and random decorative technological components.
Interface representation
When interfaces are necessary, use abstract shapes, restrained light, and non-readable graphical indicators.
Do not generate random pseudo-text, invented typography, or meaningless symbols.
If readable interface text is required, it should be handled separately by the application.
10. ARCHITECTURAL SCALE AND COMPOSITION
Cyberpunk environments often communicate complexity through architectural scale.
Use this characteristic selectively.
Large-scale scenes
Emphasize:

* Monumental architectural structures.
* Layered city infrastructure.
* Deep environmental perspective.
* Atmospheric silhouettes.
* Strong spatial relationships.
* Scale contrast between humans and buildings.

Character-focused scenes
Prioritize:

* Natural expressions.
* Emotional atmosphere.
* Carefully designed lighting.
* Strong character silhouettes.
* Meaningful environmental details.
* Balanced negative space.

Interior scenes
Use thoughtful spatial design, believable furniture, technological integration, and controlled artificial lighting.
Do not force wide city panoramas into intimate narrative scenes.
11. NEO-NOIR INFLUENCE
Introduce sophisticated visual characteristics associated with neo-noir cinematography.
Visual principles

* Strong light and shadow relationships.
* Dramatic urban silhouettes.
* Cinematic asymmetrical compositions.
* Expressive reflections.
* Restrained atmospheric haze.
* Carefully controlled darkness.
* High-contrast focal points.
* Intimate character framing.
* Environmental storytelling.
* Emotional ambiguity.

The neo-noir influence should enhance mood without overpowering the narrative.
Avoid treating every cyberpunk scene as a crime thriller.
Cyberpunk stories may also contain humor, romance, wonder, peaceful moments, or philosophical reflection.
12. MATERIALS AND SURFACE RENDERING
Use sophisticated painterly material rendering.
Metal
Controlled reflections, worn industrial surfaces, subtle environmental color, and believable edge highlights.
Glass
Layered transparency, soft architectural reflections, subtle distortion, and cinematic light interaction.
Synthetic fabrics
Detailed but painterly folds, natural material thickness, restrained surface variation, and colored light response.
Concrete
Weathered textures, industrial color variations, subtle imperfections, and expressive brushwork.
Plastic and composite materials
Matte or semi-reflective finishes with realistic structural qualities.
Skin
Natural painterly shading, controlled highlights, subtle color variations, and believable environmental lighting.
Materials must appear illustrated rather than physically simulated through photorealistic rendering.
13. EMOTIONAL STORYTELLING
The cyberpunk style should support diverse emotional atmospheres.
Possible narrative moods include:

* Urban isolation.
* Technological wonder.
* Social tension.
* Melancholy.
* Discovery.
* Human connection.
* Suspense.
* Nostalgia.
* Curiosity.
* Determination.
* Existential reflection.
* Quiet contemplation.
* Hope.
* Uncertainty.

The emotional atmosphere must be derived from the literary passage.
Do not automatically add danger, violence, or dystopian conflict when absent from the story.
The image should communicate the relationship between people, technology, and society through visual storytelling.
14. VISUAL DETAIL DISTRIBUTION
Use highly controlled detail placement.
Primary focal points
High rendering quality, refined character details, sophisticated lighting, and strong edge definition.
Secondary subjects
Moderate detail, balanced contrast, and simplified technological surfaces.
Background
Atmospheric abstraction, softened edges, reduced detail density, and carefully controlled color relationships.
Do not render every sign, building, machine, and character with equal sharpness.
Allow important visual information to dominate naturally.
Preserve a rich painterly quality throughout the composition.
15. VISUAL CONTINUITY ACROSS A BOOK
When illustrating multiple scenes from the same literary work, maintain consistent:

* Character identities.
* Facial features and proportions.
* Clothing designs.
* Cybernetic components.
* Technological devices.
* Architecture.
* Transportation systems.
* Urban infrastructure.
* Fictional cultures.
* Industrial design language.
* Color grading.
* Lighting philosophy.
* Material rendering.
* Illustration technique.

Recurring characters must remain recognizable.
Repeated locations should preserve their established architectural characteristics.
Do not invent new technological features that contradict previous scenes or the source material.
Maintain consistent rules for the fictional world's technology.
16. ORIGINALITY AND COPYRIGHT
Create original characters, technological objects, costumes, architecture, vehicles, and futuristic environments.
Do not reproduce recognizable copyrighted characters, iconic futuristic cities, famous robotic designs, signature vehicles, or recognizable costumes from existing games, movies, comics, or television series.
Do not imitate specific franchise compositions or proprietary design languages.
Use broad cyberpunk genre conventions, industrial design principles, neo-noir cinematography, and original futuristic imagination.
The result must be an original illustration suitable for a commercial literary application.
17. STRICT NEGATIVE PROMPT
Avoid:

* Photorealism.
* Photography.
* CGI.
* 3D rendering.
* Unreal Engine aesthetics.
* Video-game screenshots.
* Generic AI-generated futuristic art.
* Excessively polished surfaces.
* Plastic-looking characters.
* Perfect digital smoothness.
* Flat vector illustration.
* Corporate illustration.
* Uniformly sharp details.
* Excessive neon saturation.
* Random magenta and cyan lighting.
* Artificial bloom.
* Unnecessary lens flares.
* Excessive rain.
* Mandatory nighttime environments.
* Unnecessary holograms.
* Random glowing circuits.
* Incoherent futuristic machinery.
* Excessively complicated cybernetic implants.
* Unnecessary weapons.
* Generic futuristic costumes.
* Repetitive city architecture.
* Excessive environmental clutter.
* Inconsistent character designs.
* Unrelated futuristic elements.
* Recognizable copyrighted characters.
* Licensed technology or iconic vehicles.
* Logos.
* Text.
* Typography.
* Captions.
* Speech bubbles.
* Watermarks.
* Decorative borders.

18. FINAL ART DIRECTION
Generate an extraordinary, original cyberpunk literary illustration combining sophisticated futuristic concept art, expressive painterly brushwork, cinematic neo-noir lighting, immersive technological environments, and emotionally compelling visual storytelling.
The image must feel artistically handcrafted, technologically sophisticated, and visually cinematic.
Prioritize believable futuristic design, atmospheric depth, carefully constructed artificial lighting, and strong narrative composition.
Preserve the visual complexity of cyberpunk aesthetics without overwhelming the illustration with unnecessary details.
Visual Priority Order

1. Premium painterly cyberpunk illustration.
2. Sophisticated neon and artificial light treatment.
3. Immersive futuristic urban design.
4. Cinematic neo-noir atmosphere.
5. Original character design.
6. Believable technological details.
7. Expressive narrative composition.
8. Controlled color relationships.
9. Consistent fictional world-building.
10. Faithful representation of the source passage.

The cyberpunk style determines how the scene is illustrated. The source narrative determines what actually appears in the image.
19. DYNAMIC SCENE INPUT — BOOKMOO
Illustrate the following literary scene using the cyberpunk artistic principles established above.
SCENE DESCRIPTION:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
FICTIONAL WORLD AND TECHNOLOGICAL CONTEXT:
{{world_context}}
ENVIRONMENT:
{{environment_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
LIGHTING AND TIME OF DAY:
{{lighting_context}}
COMPOSITION AND CAMERA ANGLE:
{{composition}}
PREVIOUS CHARACTER AND WORLD REFERENCES:
{{visual_references}}
ASPECT RATIO:
{{aspect_ratio}}
FINAL GENERATION INSTRUCTION
Create one complete, original, beautifully composed cyberpunk literary illustration.
Apply sophisticated digital painting, futuristic architectural design, expressive character illustration, cinematic artificial lighting, neo-noir atmospheric depth, and premium concept art craftsmanship.
Follow the supplied literary passage faithfully.
Maintain consistent character appearances, technological rules, and environmental identities across multiple illustrations.
Do not automatically introduce neon signs, rain, implants, flying vehicles, weapons, or futuristic skyscrapers when absent from the narrative.
Do not reproduce copyrighted characters, iconic vehicles, or recognizable fictional franchises.
Preserve visible painterly craftsmanship and avoid photorealistic rendering.
No text, no captions, no typography, no speech bubbles, no logos, no decorative borders, and no watermarks.$sty$ where id = 'cyberpunk';
update comic_styles set prompt = $sty$07. ROMANCE EM AQUARELA — ROMANTIC WATERCOLOR
Style ID: `romantic_watercolor_07`
Category: Romantic Watercolor / Literary Editorial Illustration
Visual Identity: Delicate, painterly, elegant, emotionally expressive, atmospheric, handcrafted, intimate, and timeless.
MASTER STYLE PROMPT
Create an extraordinary, original romantic literary illustration combining sophisticated traditional watercolor painting, delicate gouache, expressive editorial illustration, subtle hand-drawn linework, and beautifully composed cinematic visual storytelling.
The artwork must resemble a premium hand-painted illustration created for an elegant contemporary or classic literary novel.
Prioritize emotionally expressive characters, delicate painterly textures, sophisticated color harmony, graceful compositions, natural gestures, and soft atmospheric illumination.
The image must feel intimate, poetic, elegant, emotionally compelling, and unmistakably handcrafted.
Avoid generic romantic digital art, artificial beauty filters, exaggerated facial features, or overly polished character rendering.
The defining characteristic of this style is the combination of delicate watercolor painting, refined editorial illustration, subtle character expressions, graceful silhouettes, and sophisticated emotional storytelling.
The illustration should possess the artistic sensitivity of a beautifully illustrated literary book.
1. ARTISTIC IDENTITY AND PAINTING TECHNIQUE
Use traditional watercolor painting principles combined with expressive gouache, delicate pencil drawing, and sophisticated contemporary editorial illustration.
The artwork should look as though an accomplished illustrator carefully painted it on fine watercolor paper.
Primary artistic characteristics

* Elegant traditional watercolor washes.
* Delicate gouache layering.
* Subtle hand-drawn contours.
* Organic painterly brushwork.
* Graceful character silhouettes.
* Soft atmospheric transitions.
* Naturally imperfect color boundaries.
* Sophisticated tonal relationships.
* Fine traditional-paper textures.
* Selective pencil-like construction marks.
* Beautifully simplified forms.
* Emotional visual storytelling.
* Refined editorial composition.

Maintain a balance between artistic elegance and visible handmade imperfections.
The painting should never look mechanically perfect.
Preserve the expressive nature of traditional illustration.
2. LINEWORK AND CHARACTER CONTOURS
Use delicate, expressive hand-drawn linework to define important character features, clothing, objects, and environmental elements.
Primary line characteristics

* Fine pencil and ink contours.
* Soft charcoal-gray lines.
* Warm sepia strokes.
* Natural variations in thickness.
* Slightly imperfect curves.
* Occasional unfinished outlines.
* Gentle overlapping construction strokes.
* Subtle contour irregularities.
* Organic hand-drawn movement.

Avoid heavy black comic-book outlines.
Character silhouettes should emerge from a combination of soft painted edges and delicate drawing.
Edge treatment
Some contours should be softly defined by color rather than explicit lines.
Allow selected watercolor boundaries to dissolve into the surrounding atmosphere.
Use sharper edges near faces, hands, and emotionally important details.
Keep secondary visual elements more loosely painted.
The image should feel elegantly drawn without appearing excessively outlined.
3. WATERCOLOR AND GOUACHE TECHNIQUE
Use sophisticated watercolor layering with naturally translucent pigments.
Watercolor characteristics

* Translucent color washes.
* Gentle pigment diffusion.
* Slightly irregular painted edges.
* Soft color transitions.
* Delicate watercolor granulation.
* Subtle pigment accumulation.
* Natural color bleeding.
* Organic brush direction.
* Visible paper interaction.
* Restrained wet-on-wet effects.

Gouache characteristics
Introduce matte opaque color areas to establish elegant shapes and controlled visual contrast.
Use gouache for:

* Clothing silhouettes.
* Selected architectural forms.
* Soft shadow masses.
* Interior objects.
* Decorative environmental details.
* Subtle highlights.
* Simplified character volumes.

The relationship between watercolor and gouache should remain balanced.
Avoid excessive opacity or plastic-looking digital painting.
4. COLOR LANGUAGE
Use sophisticated, harmonious, emotionally expressive color palettes.
Colors should feel carefully selected by a professional literary illustrator.
Primary color families
Warm romantic tones

* Dusty rose.
* Muted terracotta.
* Soft coral.
* Warm peach.
* Antique blush.
* Subtle burgundy.

Elegant neutrals

* Warm ivory.
* Cream.
* Soft beige.
* Pale taupe.
* Natural linen.
* Muted warm gray.

Cool atmospheric tones

* Dusty blue.
* Muted lavender.
* Soft slate.
* Pale turquoise.
* Desaturated indigo.
* Gentle blue-gray.

Natural accents

* Sage green.
* Olive.
* Warm ochre.
* Muted gold.
* Earthy brown.

Color principles
Use balanced warm and cool relationships.
Reserve saturated colors for emotionally meaningful focal points.
Maintain delicate transitions and natural watercolor transparency.
Do not automatically make every romantic illustration pink, pastel, or floral.
A romantic novel may contain dark dramatic scenes, winter landscapes, sophisticated urban settings, historical interiors, or melancholic environments.
Adapt colors to the narrative while preserving the romantic watercolor artistic identity.
5. CHARACTER DESIGN
Create original, sophisticated literary characters with expressive facial features, natural anatomy, and graceful body language.
Character design must feel emotionally believable and artistically refined.
Character characteristics

* Believable human proportions.
* Slightly stylized anatomical simplification.
* Expressive but natural facial features.
* Elegant silhouettes.
* Delicate facial shading.
* Natural hair movement.
* Carefully painted clothing.
* Graceful posture.
* Subtle emotional gestures.
* Distinctive individual identities.
* Soft but convincing volume.
* Harmonious relationship with the environment.

Characters should resemble beautifully painted editorial illustrations rather than generic animated-film characters.
Facial expression
Facial expressions are fundamental to this style.
Use delicate visual cues to communicate emotions:

* Slight changes in eye direction.
* Natural eyebrow movement.
* Subtle mouth expressions.
* Gentle facial tension.
* Relaxed or restrained gestures.
* Meaningful glances.
* Thoughtful posture.
* Natural emotional reactions.

Emotions should feel sincere and nuanced.
Avoid exaggerated cartoon expressions.
6. EMOTIONAL BODY LANGUAGE
Use character gestures and positioning to communicate relationships, emotions, and narrative meaning.
Visual storytelling principles

* Natural proximity between characters.
* Meaningful eye contact.
* Expressive hand gestures.
* Subtle posture changes.
* Delicate interpersonal interactions.
* Emotionally meaningful spatial distance.
* Thoughtful character positioning.
* Natural facial reactions.
* Quiet moments of reflection.

A scene should be able to communicate affection, longing, uncertainty, companionship, or emotional distance without explicit explanation.
Do not automatically depict couples embracing or kissing.
Romantic storytelling also includes conversations, memories, waiting, personal growth, family relationships, and quiet moments.
The narrative determines the emotional interaction.
7. CLOTHING AND FABRIC RENDERING
Render clothing with delicate watercolor textures and elegant hand-painted folds.
Fabric characteristics

* Soft, natural folds.
* Graceful directional brushwork.
* Subtle fabric texture.
* Matte gouache shadow areas.
* Natural movement.
* Simplified but believable construction.
* Refined highlights.
* Organic color transitions.

Costumes must reflect the historical period, cultural context, social environment, and personality of the characters.
Possible visual contexts include contemporary fashion, historical garments, elegant formalwear, casual clothing, or fictional cultural costumes.
Do not automatically introduce Victorian dresses or formal clothing.
Clothing must follow the actual literary description.
8. LIGHTING AND ATMOSPHERE
Use soft, emotionally expressive lighting with refined painterly transitions.
Lighting should create intimacy and visual elegance.
Lighting characteristics

* Diffused natural daylight.
* Gentle window illumination.
* Soft golden-hour light.
* Subtle ambient shadows.
* Warm interior lighting.
* Delicate reflected light.
* Atmospheric evening illumination.
* Restrained directional highlights.
* Soft environmental color blending.
* Natural shadow gradients.

Lighting philosophy
Light should feel interpreted by an illustrator rather than physically calculated.
Use warm and cool tonal relationships to emphasize emotional atmosphere.
Allow faces and important gestures to remain clearly readable.
Avoid exaggerated bloom, lens flares, excessive glowing effects, or photorealistic lighting simulation.
9. ENVIRONMENTS AND ARCHITECTURE
Create beautifully illustrated environments with elegant painterly simplification.
The environment must support the characters and emotional atmosphere.
Possible environments

* Contemporary urban settings.
* Historical architecture.
* Elegant interiors.
* Quiet residential spaces.
* Countryside landscapes.
* Gardens.
* Streets and public spaces.
* Coastal environments.
* Natural landscapes.
* Literary locations.

These are examples, not mandatory elements.
Environmental rendering
Use soft watercolor washes, delicate structural details, graceful architectural perspective, and subtle atmospheric depth.
Architecture should be recognizable but not excessively detailed.
Background elements may dissolve into loose painterly forms.
Preserve enough environmental information to establish time, place, and narrative context.
Avoid inserting flowers, gardens, cafés, or picturesque streets into unrelated scenes.
10. EDITORIAL ILLUSTRATION INFLUENCE
Introduce sophisticated visual principles associated with premium literary editorial illustration.
Editorial characteristics

* Elegant visual simplification.
* Strong silhouettes.
* Carefully controlled negative space.
* Refined compositional balance.
* Harmonious color relationships.
* Subtle visual symbolism.
* Restrained decorative elements.
* Sophisticated use of texture.
* Expressive character staging.
* Clear narrative communication.

The image should look suitable for a beautifully illustrated literary edition.
Avoid overly generic commercial romance-cover aesthetics.
Do not automatically center two characters facing each other.
Vary compositions according to narrative importance.
11. CINEMATIC COMPOSITION
Create beautiful, emotionally expressive compositions with sophisticated visual hierarchy.
Composition principles

* Natural and believable framing.
* Elegant asymmetry.
* Carefully balanced negative space.
* Strong narrative focal points.
* Graceful visual rhythm.
* Meaningful character placement.
* Controlled background detail.
* Atmospheric depth.
* Natural leading lines.
* Expressive silhouettes.

Character-focused scenes
Use close or medium framing to emphasize faces, expressions, gestures, and emotional interaction.
Environmental scenes
Use wider compositions to communicate the emotional relationship between characters and their surroundings.
Quiet scenes
Preserve negative space, visual simplicity, and gentle atmospheric lighting.
Dramatic scenes
Introduce stronger tonal contrast, more expressive compositions, and carefully controlled visual tension.
The emotional context should guide the composition.
12. TEXTURE AND PAPER MATERIALITY
The illustration must possess authentic traditional watercolor-paper characteristics.
Texture characteristics

* Fine watercolor-paper grain.
* Subtle pigment granulation.
* Delicate dry-brush marks.
* Natural pigment absorption.
* Slightly imperfect paint boundaries.
* Organic brush layering.
* Fine pencil construction marks.
* Soft matte surfaces.
* Minimal paper irregularities.

Texture must feel naturally integrated into the artwork.
Avoid artificial grunge effects, excessive grain overlays, heavy paper stains, and digital noise.
The final result should feel handcrafted yet sophisticated.
13. EMOTIONAL AND NARRATIVE RANGE
The romantic watercolor style must support a broad range of emotions.
Possible atmospheres include:

* Affection.
* Nostalgia.
* Longing.
* Joy.
* Melancholy.
* Hope.
* Uncertainty.
* Friendship.
* Emotional distance.
* Introspection.
* Companionship.
* Personal discovery.
* Reconciliation.
* Quiet contemplation.
* Dramatic tension.

Do not force every illustration to feel cheerful, sentimental, or romanticized.
The style should support complex literary emotions.
A sad or dramatic scene may use subdued colors, stronger shadows, and restrained compositions without abandoning the delicate watercolor technique.
14. DETAIL DISTRIBUTION
Use carefully controlled artistic detail.
Primary characters
Refined expressions, delicate facial shading, elegant silhouettes, and carefully painted clothing.
Secondary subjects
Moderate detail, softened contours, and harmonious colors.
Background
Loose watercolor washes, simplified structural details, subtle atmospheric perspective, and reduced contrast.
Preserve visual clarity around the most important narrative elements.
Avoid uniformly sharp details.
Maintain visible watercolor brushwork throughout the composition.
15. VISUAL CONSISTENCY ACROSS MULTIPLE ILLUSTRATIONS
When generating multiple illustrations for the same book, preserve consistency in:

* Character facial features.
* Character proportions.
* Hairstyle and distinctive characteristics.
* Clothing and accessories.
* Recurring environments.
* Historical details.
* Watercolor rendering.
* Gouache treatment.
* Linework characteristics.
* Paper texture.
* Lighting philosophy.
* Overall level of visual simplification.
* Artistic color treatment.

Characters must remain visually recognizable across different scenes.
Recurring locations should preserve their established architectural and environmental characteristics.
Different emotional scenes may use different palettes while maintaining the same artistic language.
16. ORIGINALITY AND COPYRIGHT
Every illustration must be an original visual interpretation of the provided literary narrative.
Do not reproduce recognizable copyrighted characters, famous romantic movie compositions, iconic costumes, or distinctive proprietary character designs.
Do not imitate a specific contemporary illustrator's recognizable visual identity.
Use general watercolor painting principles, traditional editorial illustration, and original artistic interpretation.
The resulting visual language must be suitable for a commercial literary illustration application.
17. STRICT NEGATIVE PROMPT
Avoid:

* Photorealism.
* Photography.
* Hyperrealistic rendering.
* CGI.
* 3D rendering.
* Glossy digital painting.
* Plastic-looking skin.
* Generic AI-generated romance-cover aesthetics.
* Excessive airbrushing.
* Artificial beauty filters.
* Exaggerated facial perfection.
* Anime character proportions.
* Thick comic-book outlines.
* Flat vector illustration.
* Corporate illustration.
* Uniformly clean digital contours.
* Oversaturated pink palettes.
* Excessive pastel colors.
* Unnecessary flowers.
* Random romantic decorations.
* Mandatory kissing or embracing.
* Excessively dramatic poses.
* Unrealistic body proportions.
* Generic character faces.
* Excessive environmental detail.
* Heavy digital blur.
* Artificial bloom.
* Inconsistent character appearances.
* Recognizable copyrighted characters.
* Logos.
* Text.
* Typography.
* Captions.
* Speech bubbles.
* Watermarks.
* Decorative borders.

18. FINAL ART DIRECTION
Generate an original, premium romantic watercolor literary illustration combining delicate traditional painting, elegant editorial character design, expressive hand-drawn details, sophisticated atmospheric lighting, and emotionally compelling storytelling.
The artwork must feel intimate, timeless, graceful, and artistically authentic.
Preserve visible watercolor textures, sophisticated color relationships, naturally imperfect brushwork, and refined facial expressions.
Prioritize emotional authenticity over decorative romantic clichés.
Visual Priority Order

1. Sophisticated traditional watercolor illustration.
2. Expressive and believable characters.
3. Delicate handmade brushwork.
4. Elegant editorial composition.
5. Emotional visual storytelling.
6. Soft atmospheric lighting.
7. Harmonious narrative-appropriate colors.
8. Natural traditional-paper textures.
9. Consistent character identities.
10. Faithful representation of the literary passage.

The style defines the artistic execution. The literary narrative determines the characters, environment, relationships, and emotions.
19. DYNAMIC SCENE INPUT — BOOKMOO
Illustrate the following literary scene using the romantic watercolor artistic principles established above.
SCENE DESCRIPTION:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
HISTORICAL AND CULTURAL CONTEXT:
{{world_context}}
ENVIRONMENT:
{{environment_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
LIGHTING AND TIME OF DAY:
{{lighting_context}}
COMPOSITION AND CAMERA ANGLE:
{{composition}}
PREVIOUS CHARACTER AND WORLD REFERENCES:
{{visual_references}}
ASPECT RATIO:
{{aspect_ratio}}
FINAL GENERATION INSTRUCTION
Create one complete, original, beautifully composed romantic watercolor literary illustration.
Apply delicate traditional watercolor painting, subtle gouache, elegant expressive characters, sophisticated editorial illustration techniques, and soft atmospheric lighting.
Follow the supplied literary passage faithfully.
Preserve the established characters, historical context, emotional relationships, and environmental continuity.
Do not automatically introduce couples, flowers, romantic poses, pink colors, or decorative elements absent from the narrative.
Do not reproduce recognizable copyrighted characters, iconic fictional designs, or famous cinematic compositions.
The final image must remain distinctly illustrated, handcrafted, and emotionally sophisticated.
No text, no captions, no typography, no speech bubbles, no logos, no decorative borders, and no watermarks.$sty$ where id = 'romance-aquarela';
update comic_styles set prompt = $sty$08. PINTURA HISTÓRICA — HISTORICAL FINE ART
Style ID: `historical_fine_art_08`
Category: Historical Fine Art / Classical Oil Painting Illustration
Visual Identity: Classical, elegant, painterly, historically immersive, sophisticated, atmospheric, handcrafted, and timeless.
MASTER STYLE PROMPT
Create an extraordinary, original historical literary illustration combining the artistic craftsmanship of classical oil painting, sophisticated traditional portraiture, historical narrative painting, naturalistic lighting, and beautifully detailed period environments.
The artwork must resemble a masterfully executed oil painting created by an accomplished classical artist, adapted for a premium illustrated literary edition.
Prioritize authentic historical atmosphere, rich oil-painting textures, believable human anatomy, elegant character expressions, sophisticated natural lighting, carefully researched period clothing, and beautifully composed environments.
The illustration should feel timeless, emotionally compelling, culturally authentic, and unmistakably handcrafted.
The defining characteristic of this style is the combination of traditional oil-painting craftsmanship, historically grounded visual design, elegant figurative painting, and sophisticated naturalistic illumination.
The image must remain a painterly illustration rather than a photograph, photorealistic digital render, or 3D reconstruction.
1. ARTISTIC IDENTITY AND CLASSICAL PAINTING TECHNIQUE
Use sophisticated traditional oil-painting techniques informed by classical figurative art, historical narrative painting, academic drawing, and naturalistic landscape painting.
The artwork should feel as though it was carefully created using physical brushes, layered oil pigments, and a traditional prepared canvas.
Primary artistic characteristics

* Classical oil-on-canvas appearance.
* Expressive traditional brushwork.
* Beautifully modeled human anatomy.
* Rich layered pigments.
* Sophisticated tonal transitions.
* Subtle glazing effects.
* Organic handcrafted textures.
* Elegant compositional balance.
* Delicate canvas grain.
* Carefully controlled highlights.
* Naturalistic color relationships.
* Painterly atmospheric perspective.
* Refined historical storytelling.

Preserve the visible craftsmanship of traditional painting.
Avoid excessive digital smoothness.
The artwork should feel created by a skilled human painter who understands anatomy, composition, light, materials, and historical visual culture.
2. BRUSHWORK AND PAINT APPLICATION
Brushwork must remain an essential component of the visual identity.
Use sophisticated variations of traditional oil-painting techniques.
Brush characteristics

* Broad painterly strokes for large environmental masses.
* Refined brushwork for faces and hands.
* Directional paint strokes following the structure of fabrics.
* Delicate brush marks in architectural details.
* Subtle impasto-like highlights.
* Thin transparent glazing in shadow regions.
* Organic surface irregularities.
* Painterly transitions between adjacent colors.
* Controlled edge softness.
* Natural variations in paint thickness.

Painterly edge treatment
Use varied edge definitions.
Important facial features, hands, and narrative objects should receive more carefully controlled edges.
Secondary elements may remain loosely painted.
Selected contours should dissolve naturally into surrounding shadows or atmospheric color.
Avoid perfectly sharpened outlines.
The image must feel painted, not digitally traced.
3. CLASSICAL COLOR LANGUAGE
Use sophisticated historical painting palettes built around natural pigments, elegant neutrals, and restrained saturated accents.
Earth pigments

* Raw umber.
* Burnt umber.
* Burnt sienna.
* Yellow ochre.
* Venetian red.
* Warm terracotta.
* Natural brown.

Elegant neutrals

* Ivory.
* Antique cream.
* Warm gray.
* Soft charcoal.
* Stone beige.
* Muted taupe.
* Deep brown.

Historical accent colors

* Ultramarine blue.
* Deep burgundy.
* Emerald green.
* Antique gold.
* Muted crimson.
* Prussian blue.
* Olive green.
* Deep violet.

Color principles
Use sophisticated warm-versus-cool color relationships.
Shadows should contain subtle color variation rather than uniform black.
Highlights should feel naturally integrated into the surrounding environment.
Use saturated pigments selectively.
Maintain rich color depth without excessive saturation.
Do not impose a permanent sepia filter or artificially aged appearance on every illustration.
Historical painting can contain vibrant pigments, bright natural daylight, colorful clothing, and luminous outdoor environments.
The palette must correspond to the historical setting, narrative mood, and available artistic materials.
4. CLASSICAL LIGHTING AND CHIAROSCURO
Use sophisticated naturalistic lighting informed by traditional figurative painting.
Light should reveal the physical structure of characters, architecture, clothing, and environmental elements.
Lighting characteristics

* Soft natural daylight.
* Elegant window illumination.
* Carefully modeled facial shadows.
* Subtle reflected light.
* Warm interior illumination.
* Balanced highlights and midtones.
* Rich tonal depth.
* Natural atmospheric diffusion.
* Restrained directional lighting.
* Sophisticated chiaroscuro where appropriate.

Chiaroscuro
Use controlled relationships between illuminated subjects and darker surroundings.
Important narrative subjects may emerge naturally from shadows.
Avoid excessive theatrical darkness.
Not every historical painting requires dramatic chiaroscuro.
Bright outdoor scenes should retain natural, believable illumination.
Lighting consistency
The lighting must correspond to the actual time of day, architecture, weather, and historical environment described in the narrative.
Do not introduce modern electric lighting into historical periods where it would be inappropriate.
5. CHARACTER DESIGN AND CLASSICAL PORTRAITURE
Create original, historically grounded characters with believable anatomy, natural proportions, and sophisticated emotional expression.
Human figures should resemble carefully painted classical portraits or narrative paintings.
Character rendering

* Natural human anatomy.
* Believable facial structure.
* Individual facial characteristics.
* Subtle skin color variation.
* Elegant but natural body language.
* Accurate hand anatomy.
* Expressive gestures.
* Realistic structural proportions.
* Painterly skin textures.
* Carefully controlled facial highlights.
* Distinctive character identities.
* Natural asymmetry.

Facial expression
Use restrained, emotionally authentic expressions.
Communicate emotions through:

* Eye direction.
* Subtle mouth movements.
* Natural eyebrow positioning.
* Facial tension.
* Head orientation.
* Hand gestures.
* Posture.
* Interactions between characters.

Avoid exaggerated theatrical expressions unless directly supported by the narrative.
Do not idealize every character into the same conventionally beautiful face.
Preserve age, individuality, physical characteristics, and distinguishing traits described by the book.
6. HISTORICAL CLOTHING AND FABRIC
Clothing accuracy is essential.
Create garments appropriate to the geographical location, historical period, social class, cultural background, climate, and specific character description.
Fabric painting
Use sophisticated traditional painting techniques to render:

* Linen.
* Wool.
* Cotton.
* Silk.
* Velvet.
* Leather.
* Brocade.
* Embroidery.
* Lace.
* Historical textiles.

Visual characteristics

* Natural fabric folds.
* Believable material thickness.
* Carefully painted highlights.
* Detailed but restrained textile patterns.
* Authentic garment construction.
* Appropriate historical accessories.
* Painterly material variation.
* Realistic fabric movement.

Historical authenticity
Respect the actual clothing conventions of the period.
Avoid combining garments from unrelated centuries.
Do not automatically dress every historical character in European aristocratic clothing.
Historical literature may be set in Asia, Africa, the Americas, the Middle East, or any other cultural and geographical context.
Represent each setting according to its documented visual characteristics and the source material.
Historical accuracy takes priority over generic period aesthetics.
7. ARCHITECTURE AND PERIOD ENVIRONMENTS
Create beautiful historical environments that accurately represent the setting of the literary work.
Possible architectural contexts

* Ancient civilizations.
* Classical antiquity.
* Medieval settlements.
* Renaissance cities.
* Baroque interiors.
* Georgian architecture.
* Victorian environments.
* Colonial-era settlements.
* Historical Asian architecture.
* Traditional African architecture.
* Historical Middle Eastern environments.
* Indigenous architectural traditions.
* Rural historical communities.

These are contextual possibilities, not mandatory visual elements.
Architectural principles

* Historically appropriate construction.
* Believable structural proportions.
* Accurate period materials.
* Culturally coherent ornamentation.
* Natural architectural weathering.
* Carefully composed interior spaces.
* Realistic building details.
* Sophisticated perspective.

Do not combine unrelated architectural traditions without narrative justification.
Do not automatically introduce European castles, palaces, cathedrals, or grand mansions.
8. ENVIRONMENTAL PAINTING
Render landscapes and environments using classical painting principles.
Natural landscapes

* Soft atmospheric perspective.
* Rich natural pigment variation.
* Expressive vegetation.
* Beautiful cloud formations.
* Natural terrain details.
* Subtle environmental shadows.
* Painterly sky gradients.
* Controlled distant silhouettes.

Urban environments

* Believable historical streets.
* Period-appropriate infrastructure.
* Authentic building materials.
* Naturally populated environments where appropriate.
* Carefully designed architectural perspective.
* Historically coherent transportation.

Interior environments

* Authentic furniture.
* Period-appropriate decoration.
* Natural light behavior.
* Believable textiles.
* Historically consistent objects.
* Sophisticated material rendering.

Do not introduce elaborate interiors into scenes that require simplicity.
The environmental design must reflect the characters' circumstances and the narrative.
9. CLASSICAL COMPOSITION
Use sophisticated composition principles associated with traditional narrative and figurative painting.
Composition characteristics

* Harmonious visual balance.
* Elegant asymmetry.
* Strong focal hierarchy.
* Natural perspective.
* Carefully arranged figure groups.
* Meaningful spatial relationships.
* Controlled use of negative space.
* Graceful leading lines.
* Painterly atmospheric depth.
* Expressive gestures.
* Sophisticated distribution of light and shadow.

Historical portrait compositions
For character-focused scenes, emphasize natural posture, expressive faces, hand gestures, and carefully controlled background detail.
Historical narrative compositions
For scenes involving multiple characters, establish clear relationships between individuals through placement, gesture, and perspective.
Environmental compositions
Use architectural structure and landscape depth to communicate location and period.
Do not automatically make every image resemble a formal royal portrait.
The illustration should serve the narrative rather than reproduce one fixed classical composition.
10. MATERIALS AND SURFACE RENDERING
Render materials with sophisticated traditional oil-painting techniques.
Skin
Natural coloration, subtle anatomical shading, realistic volume, and refined painterly transitions.
Fabric
Rich pigment layering, natural folds, soft highlights, and material-specific brushwork.
Wood
Organic grain, subdued reflections, natural wear, and warm color variation.
Stone
Mineral texture, architectural weathering, subtle surface irregularities, and realistic structural shading.
Metal
Controlled highlights, historically appropriate finishes, and restrained reflections.
Glass
Natural transparency, subtle reflections, and historically appropriate material characteristics.
Ceramics
Believable surface finishes, pigment variation, and carefully painted reflections.
Avoid photorealistic microtextures.
Every material should retain the artistic characteristics of traditional oil painting.
11. HISTORICAL ATMOSPHERE AND STORYTELLING
The illustration must communicate the atmosphere of the historical period without relying on historical clichés.
Possible emotional qualities include:

* Elegance.
* Nostalgia.
* Contemplation.
* Melancholy.
* Human connection.
* Discovery.
* Mystery.
* Hope.
* Cultural richness.
* Personal conflict.
* Social tension.
* Quiet domestic life.
* Historical grandeur.
* Intimate emotional storytelling.

The emotional atmosphere must originate from the literary passage.
Avoid making every historical scene appear solemn, royal, luxurious, or ceremonial.
Historical stories also contain everyday activities, ordinary households, rural communities, personal conversations, and simple human moments.
The style must accommodate all these possibilities.
12. HISTORICAL ACCURACY AND CULTURAL COHERENCE
Treat historical and cultural accuracy as a fundamental requirement.
Accuracy principles

* Respect the historical period.
* Respect geographical context.
* Respect established cultural traditions.
* Preserve the book's descriptions.
* Avoid anachronistic objects.
* Avoid modern technology in historical settings.
* Use appropriate architecture.
* Use authentic clothing conventions.
* Maintain coherent social and environmental details.
* Represent cultural settings without stereotypes.

When historical information is incomplete, prefer restrained, plausible visual interpretation.
Do not invent elaborate historical details that could contradict the source material.
Period consistency
Recurring environments, garments, furniture, and objects should remain consistent across illustrations.
Do not mix historical centuries or artistic conventions arbitrarily.
13. EMOTIONAL PORTRAITURE
Character expressions and body language should carry the emotional depth of literary storytelling.
Use carefully controlled painterly techniques to convey subtle psychological states.
Portrait characteristics

* Expressive eyes.
* Natural skin rendering.
* Sophisticated light modeling.
* Individual facial characteristics.
* Delicate emotional gestures.
* Subtle asymmetry.
* Refined anatomical accuracy.
* Natural posture.
* Authentic age representation.

Avoid excessive beautification or digitally idealized facial features.
The characters should look like believable individuals from the fictional or historical world.
14. ARTISTIC TEXTURE AND CANVAS MATERIALITY
The artwork must retain the tactile quality of traditional oil painting.
Texture characteristics

* Fine canvas weave.
* Subtle layered paint.
* Organic brush marks.
* Delicate pigment irregularities.
* Controlled impasto highlights.
* Natural glazing transitions.
* Slight variations in surface opacity.
* Painterly edge imperfections.
* Subtle pigment depth.

Texture should be integrated naturally into the painted forms.
Avoid artificial distressed-paper overlays, heavy cracks, exaggerated aging, or digital grunge.
The illustration should resemble a well-preserved original painting, not a damaged antique reproduction.
15. DETAIL DISTRIBUTION AND VISUAL HIERARCHY
Use professional classical painting techniques to control visual detail.
Primary focal points
Refined facial features, expressive hands, carefully rendered clothing, and sophisticated light modeling.
Secondary elements
Moderate detail, controlled textures, and harmonious color relationships.
Background
Looser painterly rendering, atmospheric perspective, reduced contrast, and simplified architectural or natural details.
Preserve visible brushwork.
Avoid uniformly sharp and excessively detailed images.
The final painting should feel rich but visually balanced.
16. CONSISTENCY ACROSS MULTIPLE ILLUSTRATIONS
When generating multiple illustrations for the same book, preserve consistency in:

* Character identity.
* Facial features.
* Age and physical characteristics.
* Clothing and accessories.
* Historical period.
* Architecture.
* Furniture.
* Cultural details.
* Recurring locations.
* Oil-painting technique.
* Brushwork.
* Material rendering.
* Lighting philosophy.
* Historical color palette.
* Degree of visual realism.

Characters must remain recognizable.
Recurring locations must preserve established details.
Historical objects and clothing should remain coherent throughout the narrative timeline.
17. ORIGINALITY AND COPYRIGHT
Create original interpretations of literary characters and historical environments.
Do not recreate famous paintings, recognizable copyrighted movie characters, distinctive film costumes, or iconic compositions from existing visual adaptations.
Use broad historical fine-art traditions and authentic historical references.
Do not imitate the exact composition of a particular artwork.
For public-domain literary characters, create original visual designs based on their written descriptions rather than reproducing the designs of modern adaptations.
18. STRICT NEGATIVE PROMPT
Avoid:

* Photorealism.
* Photography.
* Hyperrealistic rendering.
* CGI.
* 3D rendering.
* Video-game aesthetics.
* Plastic-looking skin.
* Glossy digital painting.
* Artificial beauty filters.
* Excessively smooth digital gradients.
* Generic AI-generated historical imagery.
* Modern cinematic lens flares.
* Excessive bloom.
* Inaccurate historical costumes.
* Anachronistic technology.
* Incorrect architecture.
* Unrelated historical styles.
* Generic medieval castles.
* Mandatory aristocratic clothing.
* Excessive sepia filters.
* Artificially aged photographs.
* Heavy canvas cracks.
* Excessive grunge overlays.
* Uniformly sharp details.
* Flat vector illustration.
* Cartoon proportions.
* Anime character design.
* Thick comic-book outlines.
* Unrealistically idealized faces.
* Inconsistent character identities.
* Historical stereotypes.
* Recognizable copyrighted characters.
* Famous painting reproductions.
* Logos.
* Text.
* Typography.
* Captions.
* Speech bubbles.
* Watermarks.
* Decorative borders.

19. FINAL ART DIRECTION
Generate an extraordinary, original historical literary illustration combining masterful classical oil-painting craftsmanship, refined figurative art, authentic historical world-building, sophisticated natural lighting, and emotionally expressive visual storytelling.
The final image must feel timeless, elegant, immersive, culturally coherent, and artistically handcrafted.
Prioritize traditional painting techniques, historical accuracy, beautiful compositions, naturalistic character rendering, and subtle emotional expression.
Visual Priority Order

1. Authentic classical oil-painting craftsmanship.
2. Historical and cultural accuracy.
3. Sophisticated figurative painting.
4. Naturalistic lighting and classical chiaroscuro.
5. Elegant traditional composition.
6. Rich handcrafted brushwork.
7. Historically appropriate clothing and environments.
8. Expressive emotional storytelling.
9. Consistent character and world design.
10. Faithful representation of the literary passage.

The historical painting style determines the artistic execution. The literary narrative determines the historical period, culture, characters, and events.
20. DYNAMIC SCENE INPUT — BOOKMOO
Illustrate the following literary scene using the historical fine-art painting principles established above.
SCENE DESCRIPTION:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
HISTORICAL PERIOD:
{{historical_period}}
GEOGRAPHICAL AND CULTURAL CONTEXT:
{{world_context}}
ENVIRONMENT AND ARCHITECTURE:
{{environment_context}}
CLOTHING AND PERIOD DETAILS:
{{costume_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
LIGHTING AND TIME OF DAY:
{{lighting_context}}
COMPOSITION AND CAMERA ANGLE:
{{composition}}
PREVIOUS CHARACTER AND WORLD REFERENCES:
{{visual_references}}
ASPECT RATIO:
{{aspect_ratio}}
FINAL GENERATION INSTRUCTION
Create one complete, original, beautifully composed historical fine-art literary illustration.
Apply traditional oil-painting craftsmanship, elegant classical composition, sophisticated naturalistic lighting, historically accurate costume design, refined human portraiture, and expressive painterly textures.
Follow the supplied literary passage faithfully.
Maintain established character identities, historical accuracy, cultural coherence, and environmental continuity across multiple illustrations.
Do not automatically introduce castles, palaces, royal costumes, European architecture, or other historical clichés unless supported by the narrative.
Avoid modern anachronisms and historically inaccurate objects.
Do not reproduce famous paintings, copyrighted characters, or recognizable visual adaptations.
The final image must resemble a premium handcrafted classical painting rather than photography or CGI.
No text, no captions, no typography, no speech bubbles, no logos, no decorative borders, and no watermarks.$sty$ where id = 'pintura-historica';
update comic_styles set prompt = $sty$09. NOIR & MISTÉRIO — DETECTIVE NOIR
Style ID: `detective_noir_09`
Category: Detective Noir / Cinematic Mystery Illustration
Visual Identity: Monochromatic, cinematic, mysterious, shadow-driven, sophisticated, atmospheric, handcrafted, and psychologically expressive.
MASTER STYLE PROMPT
Create an extraordinary, original noir literary illustration combining sophisticated black-and-white ink painting, expressive brushwork, classical film noir cinematography, mid-century editorial illustration, and dramatic visual storytelling.
The artwork must resemble a premium hand-illustrated scene from a beautifully crafted detective novel or literary mystery collection.
Prioritize dramatic black-and-white contrast, expressive hand-inked shadows, cinematic compositions, elegant character silhouettes, sophisticated atmospheric lighting, and psychologically compelling visual storytelling.
The image must feel mysterious, intelligent, cinematic, emotionally restrained, and unmistakably illustrated.
The defining characteristic of this style is the combination of bold cinematic shadow shapes, expressive monochromatic ink illustration, sophisticated noir lighting, and elegant narrative composition.
The final result must look like an accomplished illustrator's original artwork rather than a photograph, 3D render, or digitally processed movie still.
1. ARTISTIC IDENTITY AND ILLUSTRATION TECHNIQUE
Use a sophisticated combination of traditional brush-and-ink drawing, black-and-white editorial illustration, charcoal rendering, and classical cinematic composition.
The illustration should preserve the tactile qualities of traditional handmade artwork.
Primary artistic characteristics

* Expressive black ink brushwork.
* Bold monochromatic shadow masses.
* Sophisticated grayscale painting.
* High-contrast cinematic lighting.
* Elegant character silhouettes.
* Fine ink contour accents.
* Organic handcrafted textures.
* Controlled atmospheric perspective.
* Dramatic compositional framing.
* Selective crosshatching.
* Soft charcoal tonal transitions.
* Refined editorial illustration techniques.
* Intentional areas of negative space.

The artwork should have the sophisticated visual restraint of premium literary illustration.
Avoid generic comic-book styling and excessively decorative ink textures.
The image must remain visually cohesive and elegantly composed.
2. LINEWORK AND INK BRUSH TECHNIQUE
Linework is essential to this illustration style.
Use expressive traditional ink techniques to define characters, architecture, objects, and atmospheric details.
Primary contours

* Rich black ink.
* Organic variable line thickness.
* Confident brush strokes.
* Natural contour irregularities.
* Selectively broken outlines.
* Fine directional line accents.
* Expressive hand-drawn silhouettes.
* Subtle calligraphic brush movement.

Expressive brushwork
Use broad black brush strokes to establish deep shadow areas.
Combine large, confident ink shapes with delicate details.
Allow some character contours to disappear into surrounding darkness.
Use fine lines to reveal essential facial features, gestures, clothing folds, and environmental structures.
Secondary shading techniques
Use restrained:

* Parallel hatching.
* Crosshatching.
* Dry-brush shading.
* Charcoal-like blending.
* Stippling.
* Ink-wash gradients.
* Fine directional texture marks.

These techniques should support form and atmosphere.
Avoid covering the entire illustration with dense engraving.
Unlike gothic engraving, noir illustration should rely primarily on bold cinematic shadow masses, strong silhouettes, and selective ink details.
3. MONOCHROMATIC COLOR LANGUAGE
Use an elegant, predominantly monochromatic palette.
Primary tones

* Deep ink black.
* Soft carbon black.
* Charcoal gray.
* Graphite.
* Neutral mid-gray.
* Cool silver-gray.
* Warm ivory.
* Soft off-white.
* Subtle paper white.

Optional tonal influences
When appropriate, introduce restrained:

* Cool blue-gray.
* Muted warm sepia.
* Desaturated steel tones.
* Subtle silver highlights.

Color principles
Create visual depth through tonal contrast rather than saturated color.
Use strong relationships between black, white, and carefully selected intermediate grays.
Allow entire areas to remain almost completely black.
Preserve bright illuminated areas as meaningful visual focal points.
Avoid excessive gradients and unnecessary tonal complexity.
Selective color rule
If the narrative explicitly requires a meaningful color accent, it may be introduced sparingly.
Otherwise, maintain a sophisticated black-and-white visual identity.
Do not automatically introduce red accents, neon lighting, or brightly colored objects.
The emotional identity of noir should emerge from light, shadow, composition, and atmosphere rather than decorative colors.
4. CINEMATIC CHIAROSCURO
Lighting is the most recognizable component of this style.
Use strong, cinematic chiaroscuro influenced by classical black-and-white film photography.
Lighting characteristics

* Dramatic directional illumination.
* Deep geometric shadow shapes.
* Strong illuminated silhouettes.
* Carefully controlled facial highlights.
* High-contrast lighting ratios.
* Restrained rim lighting.
* Soft atmospheric diffusion.
* Bold shadow intersections.
* Selective illuminated details.
* Sophisticated spatial darkness.

Potential lighting sources

* Window illumination.
* Streetlights.
* Interior lamps.
* Natural moonlight.
* Daylight entering through architecture.
* Vehicle headlights.
* Reflections from glass.
* Directional sunlight.

Use light sources only when appropriate to the narrative.
Shadow construction
Shadows should feel intentionally composed.
Use large dark masses to define the image's visual structure.
Allow shadows to intersect with architecture, furniture, clothing, and characters.
Maintain enough tonal separation for important story elements to remain recognizable.
Do not make every scene excessively dark.
A daylight investigation scene should still retain sophisticated noir contrast without forcing artificial nighttime lighting.
5. SHADOWS AS A STORYTELLING ELEMENT
Use shadows not merely for realism, but as a visual storytelling language.
Shadow principles

* Strong silhouettes.
* Carefully positioned negative space.
* Directional architectural shadows.
* Partial concealment of secondary details.
* Expressive facial shadowing.
* Shadow patterns that support composition.
* Controlled separation between illuminated and obscured areas.

Shadows may communicate uncertainty, isolation, contemplation, mystery, or emotional distance.
Avoid using shadows to hide essential narrative information.
Psychological atmosphere
Create subtle visual tension through partial visibility.
Use selective illumination to direct attention toward meaningful gestures, objects, expressions, or environmental details.
Mystery should emerge through artistic restraint.
Do not automatically introduce threatening figures or danger.
6. CHARACTER DESIGN
Create original, sophisticated literary characters with believable anatomy and expressive silhouettes.
Characters must feel visually distinctive and appropriate to the source narrative.
Character characteristics

* Natural human anatomy.
* Believable facial proportions.
* Elegant silhouettes.
* Individual facial features.
* Restrained emotional expressions.
* Natural body language.
* Sophisticated ink shading.
* Carefully designed clothing.
* Expressive gestures.
* Consistent visual identities.

Facial rendering
Use light and shadow to define facial structure.
Carefully render:

* Eyes.
* Eyebrows.
* Nose.
* Mouth.
* Cheekbones.
* Jawline.
* Hair.
* Facial expressions.

Faces should remain recognizable even when partially illuminated.
Avoid exaggerated comic-book anatomy or overly stylized facial proportions.
7. COSTUME AND CHARACTER STYLING
Clothing must reflect the narrative's historical period, location, cultural context, and character identity.
Potential costume influences

* Classic tailored coats.
* Mid-century urban fashion.
* Contemporary everyday clothing.
* Detective attire.
* Formal suits.
* Historical garments.
* Practical occupational clothing.
* Minimalist urban fashion.

These are optional references.
Do not automatically dress every character in a trench coat, fedora, or formal suit.
Noir is an illustration language, not a mandatory historical costume.
The style must work for mysteries set in contemporary cities, small towns, historical periods, or fictional environments.
Clothing rendering
Use directional brushwork, strong shadow masses, and selective ink contours to define folds and materials.
Preserve natural material behavior.
Avoid excessive decorative fabric detail.
8. ARCHITECTURE AND ENVIRONMENT DESIGN
Create immersive environments with sophisticated cinematic composition and strong structural readability.
Potential environmental contexts

* Urban streets.
* Residential interiors.
* Office buildings.
* Historical neighborhoods.
* Train stations.
* Hotels.
* Public institutions.
* Quiet suburban areas.
* Industrial districts.
* Countryside locations.
* Contemporary metropolitan environments.

The narrative determines the location.
Architectural treatment
Use strong linear perspective, bold structural silhouettes, and expressive light-and-shadow patterns.
Architectural features may be simplified into elegant geometric masses.
Preserve believable dimensions and spatial relationships.
Urban noir influence
When appropriate, incorporate visual qualities associated with classic urban noir:

* Narrow streets.
* Dramatic vertical architecture.
* Deep architectural shadows.
* Illuminated windows.
* Reflective pavement.
* Layered urban depth.
* Strong foreground silhouettes.

These elements must not appear automatically.
A mystery set in a rural landscape should retain the noir illustration technique without being transformed into an urban environment.
9. ATMOSPHERE AND ENVIRONMENTAL EFFECTS
Create sophisticated atmospheric depth through monochromatic tonal variation and cinematic lighting.
Possible effects

* Gentle atmospheric haze.
* Soft fog.
* Delicate rain.
* Subtle smoke.
* Diffused window light.
* Soft environmental reflections.
* Faint distant silhouettes.
* Controlled background abstraction.

Environmental effects should feel naturally integrated.
Rain treatment
When the narrative requires rain, render it with delicate directional ink marks, irregular reflections, and soft atmospheric contrast.
Avoid making every scene rainy.
Fog treatment
Use restrained grayscale washes to soften distant objects.
Maintain readable foreground details and clear narrative focal points.
Avoid excessive artificial blur.
10. CINEMATIC CAMERA LANGUAGE
Use carefully composed cinematic framing inspired by classical noir cinematography.
Composition techniques

* Strong asymmetrical framing.
* Low-angle perspectives.
* High-angle compositions.
* Carefully positioned silhouettes.
* Architectural leading lines.
* Dramatic foreground framing.
* Natural depth layering.
* Reflective visual surfaces.
* Negative space.
* Strong tonal focal points.

Character portraits
Use controlled close-up or medium framing to emphasize psychological expression.
Investigative scenes
Highlight meaningful interactions between characters, environments, and important objects.
Environmental scenes
Use architecture, lighting, and spatial depth to establish atmosphere.
Quiet scenes
Favor thoughtful composition, restrained detail, and sophisticated tonal relationships.
Avoid automatically using extreme camera angles or dramatic compositions when the narrative calls for simplicity.
11. EDITORIAL ILLUSTRATION INFLUENCE
Introduce refined visual principles from classic literary and newspaper illustration.
Editorial characteristics

* Economical visual storytelling.
* Bold graphic shapes.
* Elegant silhouette design.
* Carefully controlled detail.
* High readability.
* Expressive ink marks.
* Strong compositional rhythm.
* Sophisticated negative space.
* Visually meaningful contrast.

The image should communicate narrative meaning without relying on unnecessary visual complexity.
Avoid making the artwork resemble an advertisement, movie poster, or promotional graphic.
It must feel like a complete scene from an illustrated novel.
12. OBJECTS AND INVESTIGATIVE DETAILS
When the scene contains narratively important objects, render them with sufficient clarity to preserve their meaning.
Possible objects include letters, photographs, books, keys, personal belongings, furniture, documents, or technological devices.
These are examples rather than required elements.
Object-rendering principles

* Clear silhouettes.
* Believable proportions.
* Controlled reflective highlights.
* Selective surface details.
* Meaningful placement.
* Consistent scale.
* Strong visual readability.

Important objects may receive more refined drawing than surrounding environmental elements.
Do not invent clues, documents, or investigative objects that are not present in the narrative.
If readable text is essential to the story, preserve the composition without generating inaccurate lettering; text should be added separately by the application.
13. PSYCHOLOGICAL AND EMOTIONAL STORYTELLING
The noir illustration style must support a broad emotional range.
Possible atmospheres include:

* Mystery.
* Suspense.
* Curiosity.
* Isolation.
* Melancholy.
* Uncertainty.
* Reflection.
* Determination.
* Nostalgia.
* Psychological tension.
* Discovery.
* Emotional restraint.
* Quiet contemplation.
* Human connection.

The emotional atmosphere must come from the literary passage.
Do not automatically portray every character as suspicious, threatening, or distressed.
An ordinary conversation may remain calm and natural while retaining sophisticated noir lighting and composition.
14. MATERIAL RENDERING
Render materials through black-and-white ink painting, controlled highlights, and restrained tonal variation.
Fabric
Strong shadow folds, directional ink strokes, simplified texture, and expressive silhouette construction.
Glass
Selective white reflections, controlled transparency, subtle environmental shapes, and elegant light accents.
Metal
Sharp highlights, dark reflective areas, and carefully positioned tonal transitions.
Concrete and stone
Simplified geometric forms, subtle charcoal texture, and natural surface variation.
Wood
Directional ink marks, restrained grain details, and sophisticated shadow transitions.
Skin
Careful value modeling, expressive facial structure, and restrained tonal blending.
Avoid photorealistic material textures.
Every surface should retain the visual language of handcrafted monochromatic illustration.
15. TEXTURE AND HANDCRAFTED MATERIALITY
The artwork must preserve subtle evidence of traditional ink illustration.
Texture characteristics

* Organic ink absorption.
* Fine paper grain.
* Subtle charcoal variation.
* Delicate brush irregularities.
* Natural ink-wash transitions.
* Slightly imperfect line edges.
* Soft dry-brush textures.
* Controlled tonal grain.

Texture must be integrated naturally into the drawing.
Avoid artificial film-grain overlays that overwhelm the illustration.
Do not introduce heavy paper stains, distressed effects, or vintage scratches unless explicitly requested.
The result should feel like a refined original artwork rather than a damaged archival print.
16. VISUAL DETAIL DISTRIBUTION
Use sophisticated visual hierarchy through selective detail.
Primary subjects
Refined facial features, meaningful gestures, carefully designed silhouettes, and strong tonal contrast.
Secondary subjects
Moderate line detail, simplified shading, and controlled edge definition.
Background
Broad ink masses, atmospheric grayscale washes, simplified architecture, and reduced contrast.
Allow large areas of the image to remain visually quiet.
Avoid excessive surface texture.
The illustration should feel rich without becoming unnecessarily complicated.
17. VISUAL CONSISTENCY ACROSS MULTIPLE ILLUSTRATIONS
When generating multiple illustrations from the same book, preserve consistency in:

* Character identities.
* Facial features and proportions.
* Hairstyles.
* Clothing and accessories.
* Recurring objects.
* Architecture.
* Historical context.
* Environment design.
* Ink brush technique.
* Shadow construction.
* Monochromatic palette.
* Contrast treatment.
* Paper texture.
* Overall cinematic language.

Recurring characters must remain recognizable.
Recurring locations must retain their established spatial and architectural identity.
Changes in weather or lighting must follow the narrative.
The underlying noir illustration technique must remain coherent throughout the book.
18. ORIGINALITY AND COPYRIGHT
Every illustration must be an original interpretation of the supplied narrative.
Do not reproduce recognizable copyrighted detectives, movie characters, iconic cinematic compositions, costumes, or signature fictional settings.
Avoid imitating a specific film, television series, comic franchise, or contemporary illustrator's distinctive visual identity.
Use general principles of classical noir cinematography, black-and-white editorial illustration, traditional ink painting, and original narrative design.
Create original character appearances and visually coherent environments suitable for a commercial literary illustration application.
19. STRICT NEGATIVE PROMPT
Avoid:

* Photorealism.
* Photography.
* CGI.
* 3D rendering.
* Hyperrealistic material textures.
* Video-game screenshots.
* Glossy digital painting.
* Excessively smooth gradients.
* Plastic-looking characters.
* Generic AI-generated detective imagery.
* Flat corporate vector illustrations.
* Heavy superhero comic aesthetics.
* Exaggerated cartoon anatomy.
* Anime character proportions.
* Excessively detailed gothic engraving.
* Uniformly thick outlines.
* Bright saturated colors.
* Unnecessary neon.
* Excessive lens flares.
* Artificial bloom.
* Overly dramatic camera distortion.
* Excessive environmental clutter.
* Unnecessary rain.
* Mandatory nighttime settings.
* Generic detective stereotypes.
* Mandatory trench coats and hats.
* Invented evidence or investigative objects.
* Incoherent architectural perspective.
* Unreadable shadows.
* Graphic violence.
* Recognizable copyrighted characters.
* Famous movie-scene recreations.
* Logos.
* Text.
* Typography.
* Captions.
* Speech bubbles.
* Watermarks.
* Decorative borders.

20. FINAL ART DIRECTION
Create an extraordinary, original detective noir literary illustration combining sophisticated black-and-white brush-and-ink painting, dramatic cinematic chiaroscuro, elegant character silhouettes, expressive psychological storytelling, and refined monochromatic composition.
The artwork must feel handcrafted, cinematic, intelligent, mysterious, and visually timeless.
Use bold shadow masses, sophisticated negative space, carefully controlled lighting, and expressive ink details to establish a unique visual identity.
Avoid reducing the style to generic detective clichés.
Visual Priority Order

1. Sophisticated black-and-white noir illustration.
2. Bold cinematic shadow masses.
3. Expressive traditional ink brushwork.
4. High-contrast chiaroscuro lighting.
5. Elegant cinematic composition.
6. Psychologically expressive characters.
7. Refined architectural and environmental design.
8. Handcrafted texture and organic imperfections.
9. Narrative fidelity.
10. Visual consistency across multiple illustrations.

The noir visual style determines how the scene is illustrated. The literary narrative determines which characters, objects, environments, and events appear.
21. DYNAMIC SCENE INPUT — BOOKMOO
Illustrate the following literary scene using the detective noir artistic principles established above.
SCENE DESCRIPTION:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
HISTORICAL AND CULTURAL CONTEXT:
{{world_context}}
ENVIRONMENT:
{{environment_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
LIGHTING AND TIME OF DAY:
{{lighting_context}}
COMPOSITION AND CAMERA ANGLE:
{{composition}}
IMPORTANT NARRATIVE OBJECTS:
{{narrative_objects}}
PREVIOUS CHARACTER AND WORLD REFERENCES:
{{visual_references}}
ASPECT RATIO:
{{aspect_ratio}}
FINAL GENERATION INSTRUCTION
Create one complete, original, beautifully composed black-and-white detective noir literary illustration.
Apply expressive traditional ink painting, bold cinematic shadows, sophisticated chiaroscuro, elegant monochromatic tonal relationships, refined character illustration, and psychologically compelling visual storytelling.
Follow the supplied literary passage faithfully.
Maintain consistent character identities, environment design, historical context, and visual continuity across illustrations.
Do not automatically introduce detectives, trench coats, urban streets, nighttime environments, rain, or investigative objects when absent from the narrative.
Do not recreate copyrighted characters or iconic cinematic compositions.
Preserve the handcrafted illustration appearance.
No text, no typography, no captions, no speech bubbles, no logos, no decorative borders, and no watermarks.$sty$ where id = 'noir-misterio';
update comic_styles set prompt = $sty$10. THRILLER CINEMATOGRÁFICO — CINEMATIC THRILLER
Style ID: `cinematic_thriller_10`
Category: Cinematic Thriller / Realistic Narrative Illustration
Visual Identity: Cinematic, atmospheric, dramatic, sophisticated, psychologically expressive, realistic, immersive, and painterly.
MASTER STYLE PROMPT
Create an extraordinary, original cinematic thriller literary illustration combining premium realistic digital painting, sophisticated cinematic visual storytelling, contemporary editorial illustration, atmospheric environmental design, and dramatic naturalistic lighting.
The artwork must resemble a masterfully painted frame from a premium illustrated thriller novel, with the visual sophistication of contemporary cinematic concept art.
Prioritize believable characters, expressive facial details, carefully controlled lighting, realistic environments, atmospheric depth, nuanced color grading, and meaningful cinematic composition.
The illustration must feel immersive, emotionally compelling, psychologically intriguing, and visually sophisticated.
The defining characteristic of this style is the combination of realistic painterly illustration, dramatic cinematic lighting, sophisticated film-inspired composition, and subtle psychological storytelling.
The final artwork must remain unmistakably illustrated, avoiding the appearance of a photograph, film screenshot, or 3D render.
1. ARTISTIC IDENTITY AND PAINTING TECHNIQUE
Use sophisticated realistic digital painting techniques informed by traditional oil painting, contemporary cinematic concept art, premium editorial illustration, and professional visual development.
The illustration should demonstrate expert knowledge of anatomy, perspective, color theory, cinematography, and visual storytelling.
Primary artistic characteristics

* Premium realistic digital painting.
* Visible handcrafted brushwork.
* Sophisticated cinematic lighting.
* Naturalistic character anatomy.
* Expressive facial rendering.
* Carefully controlled environmental detail.
* Rich but restrained color palettes.
* Organic painterly textures.
* Sophisticated material rendering.
* Atmospheric depth.
* Selectively sharp focal areas.
* Natural transitions between light and shadow.
* Visually compelling compositions.

Preserve a distinct artistic quality.
Do not create an image that looks like a photograph with a digital painting filter applied.
Every surface should reveal subtle evidence of painterly interpretation.
2. REALISTIC PAINTERLY RENDERING
Use realistic structural drawing combined with expressive painterly execution.
Characters, objects, architecture, and environments should have believable physical proportions.
However, avoid excessive photographic precision.
Painting characteristics

* Natural brush strokes.
* Sophisticated value transitions.
* Carefully controlled edge definition.
* Painterly material textures.
* Subtle surface irregularities.
* Selective fine details.
* Restrained digital smoothing.
* Organic tonal variations.
* Controlled atmospheric abstraction.

Edge hierarchy
Use sharper edges around important narrative subjects.
Soften secondary environmental elements.
Allow selected contours to dissolve naturally into shadows and atmospheric color.
Avoid uniformly sharp details.
Artistic balance
The illustration should feel approximately 75% naturalistic in structural representation and 25% interpretative in painterly execution.
This ratio is a conceptual art-direction guideline, not a literal mathematical requirement.
Maintain convincing anatomy, perspective, and lighting while retaining visible artistic brushwork.
3. COLOR LANGUAGE AND CINEMATIC GRADING
Use sophisticated contemporary cinematic color palettes.
The image should feel color-graded through deliberate artistic choices rather than automatic digital filters.
Primary color families
Cool atmospheric tones

* Deep navy.
* Desaturated teal.
* Steel blue.
* Slate gray.
* Muted cyan.
* Storm gray.

Warm cinematic accents

* Amber.
* Burnt orange.
* Warm tungsten.
* Muted gold.
* Soft terracotta.
* Desaturated red.

Natural neutrals

* Charcoal.
* Graphite.
* Warm beige.
* Stone gray.
* Soft taupe.
* Deep brown.

Color principles
Use complementary warm and cool color relationships.
Maintain sophisticated saturation control.
Reserve vivid colors for narratively meaningful focal elements.
Build visual tension through tonal relationships rather than excessive color intensity.
Important rule
Do not automatically apply teal-and-orange color grading to every image.
The palette must adapt to the literary scene.
A daylight conversation, a quiet countryside setting, a historical location, or a contemporary city may require completely different color relationships.
The style must remain recognizable through cinematic composition, realistic painterly rendering, and sophisticated lighting.
4. CINEMATIC LIGHTING
Lighting is one of the most important characteristics of this style.
Use naturalistic but dramatically controlled cinematic illumination.
Lighting techniques

* Directional key lighting.
* Soft ambient fill light.
* Carefully controlled rim lighting.
* Practical environmental illumination.
* Sophisticated shadow construction.
* Subtle reflected light.
* Atmospheric lighting.
* Natural light falloff.
* Controlled highlight intensity.
* Balanced tonal contrast.

Potential light sources

* Natural sunlight.
* Window light.
* Streetlights.
* Interior lamps.
* Vehicle lights.
* Architectural illumination.
* Overcast daylight.
* Soft evening light.
* Moonlight.
* Indoor fluorescent lighting.

Use only sources appropriate to the scene.
Lighting philosophy
Lighting should reinforce emotional meaning.
A scene involving uncertainty may use directional shadows and partial illumination.
A moment of discovery may emphasize meaningful objects through controlled light.
A calm conversation may use soft, balanced lighting.
Avoid creating dramatic darkness when the narrative does not require it.
5. PSYCHOLOGICAL VISUAL STORYTELLING
The illustration should communicate subtle psychological states through visual composition.
Use restrained emotional cues rather than exaggerated expressions.
Storytelling characteristics

* Meaningful eye direction.
* Subtle facial tension.
* Natural body language.
* Expressive posture.
* Carefully controlled character spacing.
* Purposeful negative space.
* Environmental context.
* Selective visibility.
* Subtle atmospheric tension.
* Narrative-focused lighting.

Emotional range
Support emotions such as:

* Suspense.
* Curiosity.
* Uncertainty.
* Determination.
* Doubt.
* Isolation.
* Discovery.
* Melancholy.
* Reflection.
* Relief.
* Surprise.
* Quiet confidence.
* Anticipation.

The emotional state must be derived from the source narrative.
Do not automatically portray every character as distressed, frightened, or suspicious.
Psychological complexity should emerge naturally from the illustrated scene.
6. CHARACTER DESIGN AND ANATOMY
Create original characters with believable human anatomy, distinctive facial characteristics, and natural body proportions.
Character characteristics

* Convincing anatomical structure.
* Natural facial proportions.
* Individual facial features.
* Realistic body language.
* Expressive eyes.
* Subtle emotional gestures.
* Carefully painted skin.
* Natural hair textures.
* Believable clothing.
* Consistent physical characteristics.
* Distinctive personal identities.

Facial rendering
Use sophisticated painterly techniques to render facial features.
Prioritize natural expression over exaggerated drama.
Maintain realistic relationships between eyes, nose, mouth, ears, and facial structure.
Avoid unnaturally symmetrical faces.
Characters should look like individuals rather than generic digital models.
Visual continuity
Recurring characters must preserve their established appearances.
Do not alter hair, facial structure, age, or distinctive characteristics between scenes without narrative justification.
7. CLOTHING AND MATERIAL DESIGN
Render contemporary or historically appropriate clothing using sophisticated realistic digital painting.
Clothing characteristics

* Natural fabric folds.
* Believable material thickness.
* Directional brushwork.
* Appropriate clothing construction.
* Controlled highlights.
* Natural wear when appropriate.
* Subtle material texture.
* Realistic movement.

Clothing must reflect the character's personality, profession, environment, and cultural context.
Potential outfits may include everyday clothing, professional attire, formal garments, historical costumes, or specialized occupational uniforms.
Do not automatically dress characters in dark jackets, tactical clothing, or espionage-inspired outfits.
The source narrative determines clothing and accessories.
8. ENVIRONMENTAL DESIGN
Create sophisticated, believable environments using realistic painterly construction.
Environments should feel lived-in, spatially coherent, and narratively meaningful.
Possible settings

* Modern cities.
* Residential interiors.
* Office buildings.
* Quiet suburban streets.
* Historical environments.
* Rural landscapes.
* Transportation hubs.
* Public buildings.
* Natural environments.
* Industrial architecture.
* Institutional interiors.

These are possibilities, not required elements.
Environmental rendering
Use accurate perspective, sophisticated lighting, natural material relationships, and carefully controlled atmospheric detail.
Create environmental depth without excessive visual complexity.
Important objects should remain clearly readable.
Avoid filling scenes with unrelated details merely to make them appear cinematic.
9. CINEMATIC CAMERA LANGUAGE
Use sophisticated framing inspired by professional cinematography.
The image should feel like a deliberately composed moment from a visually refined dramatic film, expressed through painting.
Composition techniques

* Rule of thirds.
* Strong visual hierarchy.
* Balanced asymmetry.
* Natural leading lines.
* Layered foreground and background.
* Meaningful negative space.
* Carefully controlled perspective.
* Environmental framing.
* Expressive silhouettes.
* Emotionally significant spatial relationships.

Camera framing
Extreme wide shot
Use when the environment, geographical context, or character isolation is narratively important.
Wide shot
Use to establish relationships between characters and the surrounding environment.
Medium shot
Use for conversations, body language, and character interactions.
Close-up
Use to emphasize subtle facial expressions or narratively important objects.
Over-the-shoulder composition
Use when a scene involves meaningful interaction or observation.
High-angle composition
Use selectively to communicate spatial relationships.
Low-angle composition
Use selectively when appropriate to the narrative perspective.
Important camera rule
Do not automatically use dramatic low angles or extreme close-ups.
Camera placement must support the specific narrative moment.
10. CINEMATIC DEPTH AND FOCUS
Create sophisticated depth through perspective, detail distribution, light, and atmospheric separation.
Foreground
Use clear shapes, refined material rendering, and selective visual detail.
Midground
Place the central narrative subjects with strong readability.
Background
Use painterly simplification, atmospheric perspective, controlled contrast, and softer edges.
Depth-of-field treatment
Use subtle cinematic focus separation when appropriate.
Do not rely on excessive photographic background blur.
The image must continue to resemble an illustrated painting.
Maintain enough environmental readability to preserve the narrative setting.
11. NATURALISTIC MATERIAL RENDERING
Render materials with believable physical properties and visible painterly craftsmanship.
Skin
Natural color variation, carefully controlled facial highlights, soft shadow transitions, and subtle texture.
Fabric
Directional painterly folds, natural material thickness, and restrained surface detail.
Glass
Subtle environmental reflections, believable transparency, and controlled highlights.
Metal
Natural reflections, realistic surface variation, and sophisticated lighting relationships.
Concrete
Organic texture, restrained imperfections, and realistic structural shading.
Wood
Natural grain variation, warm color relationships, and painterly surface treatment.
Water
Believable reflection patterns, soft environmental color, and expressive brushwork.
Avoid photorealistic microtextures and excessive digital sharpening.
12. ATMOSPHERE AND ENVIRONMENTAL EFFECTS
Use environmental atmosphere to reinforce emotional storytelling.
Potential techniques include:

* Subtle atmospheric haze.
* Diffused natural light.
* Soft rain when appropriate.
* Restrained environmental mist.
* Controlled reflections.
* Gentle airborne particles.
* Atmospheric color separation.
* Soft environmental shadows.

Atmospheric philosophy
Atmospheric effects should never be mandatory.
A bright, dry afternoon may be more appropriate than a dark, rainy street.
Do not automatically introduce smoke, fog, rain, or darkness to create suspense.
Tension can emerge from framing, character expression, and visual composition.
13. EDITORIAL THRILLER ILLUSTRATION
Introduce sophisticated visual principles from contemporary narrative editorial illustration.
Editorial characteristics

* Strong visual clarity.
* Focused storytelling.
* Thoughtful composition.
* Controlled detail.
* Subtle symbolism.
* Strong character silhouettes.
* Meaningful object placement.
* Elegant visual restraint.
* Sophisticated contrast.
* Narrative coherence.

The final image should be suitable for inclusion inside a premium illustrated thriller novel.
Avoid promotional movie-poster compositions.
Do not automatically center one dramatic character against an action-filled background.
Illustrate a complete narrative moment rather than a generic genre advertisement.
14. NARRATIVE OBJECTS AND VISUAL DETAILS
Important objects should be rendered accurately according to the literary description.
Object principles

* Believable proportions.
* Consistent material characteristics.
* Appropriate historical or technological context.
* Meaningful visual placement.
* Sufficient detail for recognition.
* Coherent relationship with characters and environment.

Do not invent objects, symbols, documents, devices, or narrative clues that are absent from the source material.
When the passage identifies a meaningful object, preserve its established appearance across subsequent illustrations.
Avoid generating inaccurate readable text on documents or screens.
Textual content should be handled separately by the application if necessary.
15. EMOTIONAL AND NARRATIVE FLEXIBILITY
The cinematic thriller style must support both intense and quiet literary scenes.
Suspenseful scenes
Use controlled contrast, purposeful framing, meaningful shadows, and expressive body language.
Investigative scenes
Focus on character observation, significant environments, and narratively relevant objects.
Emotional scenes
Prioritize believable facial expressions, natural gestures, and intimate lighting.
Ordinary scenes
Preserve natural daylight, realistic surroundings, and calm composition.
Atmospheric scenes
Use environmental depth, color grading, and deliberate visual hierarchy.
Do not force suspense into passages that are peaceful, reflective, or emotionally neutral.
The style remains cinematic without requiring constant drama.
16. VISUAL DETAIL DISTRIBUTION
Use premium realistic illustration quality with careful control over detail.
Primary focal points
High-quality character rendering, refined expressions, detailed important objects, and precise visual storytelling.
Secondary subjects
Moderate detail, balanced contrast, and simplified painterly surfaces.
Background
Controlled atmospheric abstraction, softer contours, reduced texture density, and coherent environmental details.
Avoid uniformly sharp or excessively detailed rendering.
The viewer's attention should naturally follow the narrative focus.
17. VISUAL CONSISTENCY ACROSS MULTIPLE ILLUSTRATIONS
When generating multiple illustrations for the same book, preserve consistency in:

* Character identities.
* Facial features and body proportions.
* Hairstyles and distinctive characteristics.
* Clothing and accessories.
* Recurring environments.
* Architecture.
* Vehicles and objects.
* Historical context.
* Color grading philosophy.
* Lighting techniques.
* Painterly rendering.
* Material treatment.
* Camera language.
* Overall level of realism.

Recurring characters must remain recognizable.
Recurring environments must maintain their established spatial characteristics.
The same object should retain its design, proportions, and visual features across scenes.
Do not arbitrarily change established narrative details.
18. ORIGINALITY AND COPYRIGHT
Every illustration must be an original visual interpretation of the supplied literary narrative.
Do not recreate recognizable movie characters, iconic thriller compositions, distinctive franchise costumes, or famous cinematic scenes.
Avoid copying the visual identity of a particular film, television series, video game, or contemporary illustrator.
Use general principles of cinematography, realistic digital painting, editorial illustration, and original character design.
For literary characters appearing in existing adaptations, create original appearances based on the book's descriptions rather than reproducing those adaptations.
The artwork should be suitable for a commercial literary illustration application.
19. STRICT NEGATIVE PROMPT
Avoid:

* Photography.
* Photorealistic film stills.
* Hyperrealism.
* CGI.
* 3D rendering.
* Unreal Engine aesthetics.
* Video-game screenshots.
* Plastic-looking skin.
* Artificial beauty filters.
* Excessively smooth digital surfaces.
* Generic AI-generated movie-poster aesthetics.
* Overprocessed cinematic filters.
* Excessive teal-and-orange grading.
* Artificial lens flares.
* Excessive bloom.
* Mandatory nighttime environments.
* Excessive rain.
* Random atmospheric smoke.
* Unnecessary action scenes.
* Generic spy stereotypes.
* Unrelated tactical clothing.
* Exaggerated facial expressions.
* Unrealistic anatomy.
* Excessive contrast that obscures narrative details.
* Unnecessary dramatic camera angles.
* Excessive photographic background blur.
* Uniformly sharp textures.
* Excessive visual clutter.
* Graphic violence.
* Recognizable copyrighted characters.
* Famous movie compositions.
* Logos.
* Text.
* Typography.
* Captions.
* Speech bubbles.
* Watermarks.
* Decorative borders.

20. FINAL ART DIRECTION
Generate an extraordinary, original cinematic thriller literary illustration combining sophisticated realistic digital painting, professional cinematic composition, psychologically expressive characters, dramatic naturalistic lighting, and visually compelling environmental storytelling.
The artwork must feel immersive, sophisticated, contemporary, emotionally believable, and artistically handcrafted.
Preserve subtle painterly textures, beautiful tonal relationships, realistic structural drawing, and carefully controlled atmospheric depth.
Prioritize narrative fidelity and emotional authenticity over generic thriller clichés.
Visual Priority Order

1. Premium realistic painterly illustration.
2. Sophisticated cinematic composition.
3. Naturalistic dramatic lighting.
4. Psychologically expressive characters.
5. Believable environments and materials.
6. Controlled cinematic color grading.
7. Atmospheric depth.
8. Clear narrative storytelling.
9. Original character and environment designs.
10. Consistent visual identity across illustrations.

The cinematic thriller style determines the artistic treatment. The literary narrative determines the characters, events, environments, and emotional atmosphere.
21. DYNAMIC SCENE INPUT — BOOKMOO
Illustrate the following literary scene using the cinematic thriller artistic principles established above.
SCENE DESCRIPTION:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
HISTORICAL AND CULTURAL CONTEXT:
{{world_context}}
ENVIRONMENT:
{{environment_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
LIGHTING AND TIME OF DAY:
{{lighting_context}}
COMPOSITION AND CAMERA ANGLE:
{{composition}}
IMPORTANT NARRATIVE OBJECTS:
{{narrative_objects}}
PREVIOUS CHARACTER AND WORLD REFERENCES:
{{visual_references}}
ASPECT RATIO:
{{aspect_ratio}}
FINAL GENERATION INSTRUCTION
Create one complete, original, beautifully composed cinematic thriller literary illustration.
Apply sophisticated realistic digital painting, expressive painterly brushwork, cinematic naturalistic lighting, carefully constructed environments, believable characters, and emotionally compelling visual storytelling.
Follow the supplied literary passage faithfully.
Maintain established character identities, environmental details, historical context, and narrative continuity across multiple illustrations.
Do not automatically introduce crime scenes, espionage elements, dramatic confrontations, darkness, rain, or suspenseful objects when they are not present in the narrative.
Do not reproduce copyrighted characters or famous cinematic compositions.
The final result must resemble an original premium illustrated novel scene rather than a photographic movie still.
No text, no captions, no typography, no speech bubbles, no logos, no decorative borders, and no watermarks.$sty$ where id = 'thriller-cinematografico';
update comic_styles set prompt = $sty$11. MANGÁ TRADICIONAL — JAPANESE MANGA
Style ID: `traditional_manga_11`
Category: Japanese Manga / Traditional Black & White Illustration
Visual Identity: Expressive, hand-inked, monochromatic, detailed, emotionally dynamic, graphic, elegant, and authentically illustrated.
MASTER STYLE PROMPT
Create an extraordinary, original Japanese manga illustration combining professional traditional manga drawing techniques, expressive black-and-white pen-and-ink artwork, sophisticated screentone shading, dynamic character illustration, and refined visual storytelling.
The artwork must resemble a beautifully crafted illustration from a premium professionally published Japanese manga.
Prioritize expressive characters, sophisticated hand-drawn linework, elegant black-and-white composition, carefully controlled ink contrast, delicate screentone textures, and emotionally compelling visual storytelling.
The image must feel authentic, artistically handcrafted, visually striking, and unmistakably manga.
The defining characteristic of this style is the combination of expressive Japanese manga character design, precise but organic ink linework, traditional screentone shading, and sophisticated monochromatic visual composition.
The artwork must remain a true 2D ink illustration.
Avoid digital painting aesthetics, 3D rendering, photographic textures, and generic Western cartoon styling.
1. ARTISTIC IDENTITY AND TRADITIONAL MANGA TECHNIQUE
Use professional manga illustration techniques inspired by traditional Japanese pen-and-ink drawing, hand-applied screentones, expressive character art, and black-and-white narrative illustration.
The artwork should appear carefully drawn using professional manga tools.
Primary artistic characteristics

* Traditional black-and-white manga illustration.
* Expressive G-pen-style ink contours.
* Fine technical pen details.
* Organic variations in line thickness.
* Professional screentone application.
* Controlled crosshatching.
* Expressive character silhouettes.
* Sophisticated facial expression drawing.
* Carefully constructed manga anatomy.
* Dynamic yet readable compositions.
* Elegant black shadow masses.
* Selective white highlights.
* Detailed environmental linework.
* Fine hand-drawn textures.
* Beautifully controlled negative space.

Maintain a balance between technical precision and organic artistic expression.
The illustration must feel professionally hand-drawn rather than mechanically generated.
2. LINEWORK — THE PRIMARY VISUAL SIGNATURE
Linework is the most important component of this style.
Use expressive black ink strokes with natural variation in pressure, thickness, and direction.
Primary contours

* Strong black outlines around important figures.
* Delicate internal character details.
* Organic variations in ink thickness.
* Confident flowing curves.
* Controlled angular accents.
* Naturally tapered line endings.
* Subtle handmade irregularities.
* Selective broken contours.
* Elegant silhouette construction.

Line-weight hierarchy
Use thicker lines for:

* Important character silhouettes.
* Foreground objects.
* Areas of strong shadow.
* Selected hair contours.
* Dramatic folds.
* High-contrast focal elements.

Use thinner lines for:

* Facial features.
* Hair strands.
* Clothing details.
* Background architecture.
* Environmental textures.
* Subtle anatomical details.
* Fine material rendering.

Artistic quality
The linework must feel confident, elegant, and intentionally designed.
Avoid uniform digital stroke widths.
Avoid excessive mechanical perfection.
Preserve the subtle variations of traditional pen-and-ink illustration.
3. SCREENTONES AND TONAL SHADING
Traditional manga screentones are essential to the visual identity.
Use sophisticated grayscale halftone patterns to establish shadows, material variation, atmospheric depth, and visual hierarchy.
Screentone techniques
Fine dot screentones
Use delicate halftone dot patterns to represent intermediate gray values.
Gradient screentones
Use subtle density transitions to establish smooth tonal changes.
Textured screentones
Apply restrained patterned tones to fabrics, environmental materials, and atmospheric areas.
Shadow screentones
Use carefully selected dot densities to create soft character and environmental shadows.
Atmospheric screentones
Use reduced contrast and subtle tonal variation for distant objects.
Screentone principles

* Maintain consistent halftone density.
* Use clean, readable dot patterns.
* Preserve fine details.
* Avoid excessive texture overlap.
* Keep facial areas visually clear.
* Use tonal contrast to establish depth.
* Combine screentones with solid ink shadows.
* Maintain coherent gray-value relationships.

Screentones must look like authentic manga production techniques rather than digital noise or photographic grain.
Do not apply halftone textures uniformly across the entire image.
4. MONOCHROMATIC COLOR LANGUAGE
Use a sophisticated black-and-white visual palette.
Primary values

* Pure ink black.
* Deep charcoal.
* Dark screentone gray.
* Medium halftone gray.
* Light screentone gray.
* Warm paper white.
* Pure white highlights.

Tonal principles
Create visual depth through relationships between black, white, and halftone gray.
Use strong contrast around important subjects.
Allow selected areas to remain completely white.
Use solid black masses strategically.
Maintain subtle tonal differentiation in environments and clothing.
Important rule
The default style is strictly black and white.
Do not automatically introduce colored hair, colored eyes, vibrant backgrounds, or digital color gradients.
If the application explicitly requests a colorized manga variation, color should be handled as a separate style configuration.
Preserve the authentic black-and-white manga aesthetic by default.
5. MANGA CHARACTER DESIGN
Create original characters using sophisticated Japanese manga illustration principles.
Characters must be visually distinctive, emotionally expressive, and appropriate to the literary narrative.
Character characteristics

* Elegant stylized anatomy.
* Believable body proportions.
* Expressive facial features.
* Carefully designed eyes.
* Natural yet stylized hairstyles.
* Strong individual silhouettes.
* Dynamic body language.
* Distinctive clothing.
* Graceful gestures.
* Clear emotional expression.
* Consistent character identities.
* Sophisticated ink rendering.

Anatomical principles
Use believable anatomical construction with controlled manga stylization.
Character proportions may vary according to age, personality, narrative genre, and artistic intention.
Avoid exaggerated anatomy unless justified by the selected manga substyle.
The characters should feel like original individuals rather than generic manga templates.
Character identity
Preserve the original literary descriptions.
Do not automatically change ethnicity, hairstyle, clothing, age, cultural identity, or personality merely to fit manga conventions.
Manga determines the drawing language, not the nationality or cultural background of the characters.
6. FACIAL EXPRESSIONS
Facial expressiveness is fundamental to this style.
Use refined manga facial illustration techniques to communicate emotional meaning.
Eyes

* Carefully designed eye shapes.
* Expressive eyelids.
* Natural gaze direction.
* Controlled highlights.
* Delicate eyelashes when appropriate.
* Character-specific eye proportions.
* Emotional variation in eye structure.

Eyebrows
Use subtle changes in shape, angle, and position to communicate emotions.
Mouth
Use controlled mouth shapes appropriate to the emotional intensity of the scene.
Facial structure
Preserve believable relationships between the eyes, nose, mouth, jawline, and ears.
Emotional range
Support:

* Joy.
* Curiosity.
* Sadness.
* Surprise.
* Determination.
* Uncertainty.
* Fear.
* Affection.
* Melancholy.
* Reflection.
* Excitement.
* Quiet contemplation.

Avoid exaggerated comedic facial distortions in serious scenes.
Do not automatically add sweat drops, oversized tears, exaggerated blush marks, or symbolic expression effects.
Use visual exaggeration only when appropriate to the narrative and selected manga substyle.
7. HAIR ILLUSTRATION
Create expressive manga hairstyles with sophisticated linework and strong shape design.
Hair rendering

* Clear primary hair masses.
* Fine individual strand details.
* Natural directional movement.
* Carefully controlled line thickness.
* Strong silhouette readability.
* Selective solid black areas.
* White highlight shapes.
* Delicate screentone shading.
* Natural interaction with lighting.

Hair should have recognizable structure and believable movement.
Do not automatically use exaggerated spiky hairstyles.
Use character-specific hairstyles informed by the source material.
Maintain consistent hair silhouettes across illustrations.
8. CLOTHING AND FABRIC
Render clothing using sophisticated traditional manga techniques.
Fabric illustration

* Expressive fold lines.
* Natural fabric movement.
* Carefully controlled ink contours.
* Solid black shadow shapes.
* Delicate screentone shading.
* Fine material texture.
* Believable garment construction.
* Dynamic linework.
* Selective highlights.

Costume accuracy
Clothing must follow the narrative's historical, cultural, and environmental context.
Possible settings include:

* Contemporary cities.
* Historical periods.
* Fantasy worlds.
* Science fiction environments.
* Everyday domestic settings.
* Formal events.
* Rural communities.

Do not automatically dress every character in a Japanese school uniform.
Do not introduce traditional Japanese clothing unless relevant to the story.
9. BACKGROUND AND ENVIRONMENTAL ILLUSTRATION
Create detailed manga environments using professional architectural perspective, fine ink linework, and sophisticated screentone shading.
Environmental characteristics

* Carefully constructed perspective.
* Fine architectural contours.
* Natural environmental textures.
* Delicate vegetation drawing.
* Controlled black shadow masses.
* Layered screentone values.
* Subtle atmospheric perspective.
* Selective structural detail.
* Balanced environmental complexity.

Architecture
Use precise perspective construction while maintaining the appearance of traditional ink illustration.
Buildings, interiors, furniture, and environmental objects should be visually coherent.
Natural environments
Render trees, mountains, water, vegetation, skies, and landscapes through expressive ink strokes and delicate tonal patterns.
Background hierarchy
Foreground elements should have stronger contours and contrast.
Midground elements should retain structural clarity.
Background elements may use lighter screentones and reduced line density.
Avoid photorealistic background textures.
The entire environment should feel drawn by the same manga illustrator.
10. MANGA COMPOSITION AND VISUAL STORYTELLING
Create sophisticated manga compositions with strong narrative readability.
Use:

* Dynamic visual hierarchy.
* Expressive character placement.
* Carefully designed negative space.
* Strong silhouettes.
* Elegant perspective.
* Emotionally meaningful framing.
* Controlled visual rhythm.
* Natural leading lines.
* Expressive body language.
* Purposeful focal points.

Default composition
Generate one complete manga illustration representing a single literary moment.
Do not automatically create comic panels, page borders, or sequential layouts.
Optional panel composition
Only when explicitly requested, arrange multiple narrative moments into a coherent manga page layout.
Use carefully designed panel shapes, meaningful reading flow, and consistent character continuity.
For multi-panel output, maintain the requested reading direction and clear visual separation.
Important rule
A manga illustration does not require panels to look like manga.
The artistic language should remain recognizable through ink drawing, character construction, screentones, and composition.
11. CAMERA ANGLES AND FRAMING
Use expressive manga-inspired visual framing appropriate to the literary scene.
Possible framing
Close-up
Emphasize facial expressions, thoughts, and meaningful emotional reactions.
Medium shot
Focus on character interactions and body language.
Wide shot
Establish the environment and spatial relationships.
Low-angle shot
Communicate scale or narrative emphasis when appropriate.
High-angle shot
Establish environmental context or character placement.
Dynamic perspective
Introduce visual energy when the scene requires movement.
Camera principles
Avoid excessive perspective distortion.
Do not force every scene into an action-oriented composition.
Quiet scenes may benefit from restrained framing and negative space.
The composition must always follow the source narrative.
12. MOTION LINES AND VISUAL ENERGY
Use traditional manga motion-line techniques selectively.
Motion techniques

* Fine directional speed lines.
* Expressive action strokes.
* Controlled radial emphasis.
* Dynamic fabric movement.
* Gesture-based contour extensions.
* Selective environmental movement.
* Strong directional silhouettes.

Motion effects should reinforce movement already present in the scene.
Do not add speed lines to static conversations, peaceful landscapes, or contemplative moments unless artistically justified.
Energy control
Use stronger visual effects for dynamic movement.
Use restrained linework and clean negative space for quiet moments.
The style must support both energetic and emotionally subtle storytelling.
13. LIGHTING AND SHADOW
Use sophisticated monochromatic lighting expressed through ink, screentones, and negative space.
Lighting characteristics

* Strong graphic shadow masses.
* Controlled white highlights.
* Directional tonal separation.
* Fine halftone gradients.
* Elegant silhouette lighting.
* Restrained rim highlights.
* Natural atmospheric value transitions.

Shadow treatment
Represent shadows through:

* Solid ink shapes.
* Medium-density screentones.
* Light halftone patterns.
* Fine hatching.
* Selective white negative space.

Do not simulate photorealistic lighting.
The illumination must remain consistent with traditional manga illustration.
14. MANGA SUBSTYLE ADAPTATION
The master style should support different types of manga while preserving the same fundamental drawing language.
Shōnen-inspired treatment

* Expressive movement.
* Clear silhouettes.
* Dynamic compositions.
* Confident ink contours.
* Energetic visual storytelling.

Shōjo-inspired treatment

* Delicate character linework.
* Refined facial expression.
* Graceful composition.
* Elegant negative space.
* Sophisticated emotional storytelling.

Seinen-inspired treatment

* More naturalistic proportions.
* Detailed environments.
* Controlled tonal contrast.
* Subtle psychological expression.
* Refined anatomical construction.

Josei-inspired treatment

* Natural human proportions.
* Sophisticated fashion illustration.
* Expressive interpersonal gestures.
* Subtle facial expressions.
* Elegant visual restraint.

Important rule
These are artistic directions, not mandatory audience or demographic classifications.
Do not assume that a character's gender determines the illustration substyle.
Select visual characteristics according to the literary narrative and the desired artistic tone.
Unless specified otherwise, use a balanced, premium traditional manga aesthetic with expressive characters, refined ink work, and professional screentone shading.
15. ATMOSPHERE AND EMOTIONAL STORYTELLING
The manga style must adapt to a wide range of narrative genres.
Possible atmospheres include:

* Adventure.
* Mystery.
* Fantasy.
* Romance.
* Drama.
* Comedy.
* Suspense.
* Historical fiction.
* Science fiction.
* Everyday life.
* Melancholy.
* Personal discovery.
* Emotional reflection.

A fantasy scene may use dramatic perspective and expressive environmental drawing.
A romantic scene may prioritize facial expressions and subtle gestures.
A mystery scene may use sophisticated shadow masses and careful composition.
A quiet literary scene may use delicate screentones and elegant negative space.
Do not force every illustration into action, comedy, romance, or exaggerated emotional expression.
The narrative determines the emotional atmosphere.
16. TRADITIONAL PAPER AND INK TEXTURE
Preserve subtle handmade material qualities.
Texture characteristics

* Fine manga-paper texture.
* Natural ink absorption.
* Slight line irregularities.
* Delicate dry-ink marks.
* Subtle nib-pressure variation.
* Carefully applied halftone patterns.
* Fine handcrafted shading.
* Clean but organic print quality.

The artwork should resemble a premium printed manga illustration.
Avoid excessive film grain, artificial paper damage, heavy grunge overlays, and blurred screentone patterns.
Maintain professional print-like clarity.
17. VISUAL DETAIL DISTRIBUTION
Use sophisticated detail hierarchy.
Primary characters
Refined facial features, expressive anatomy, carefully drawn clothing, and precise ink contours.
Secondary elements
Moderate line detail, controlled screentones, and simplified shapes.
Background
Reduced contrast, softer tonal treatment, carefully structured perspective, and selective environmental detail.
Visual balance
Avoid excessive line density across the entire composition.
Use clean white areas to provide visual breathing room.
Reserve strong contrast and intricate details for important narrative subjects.
18. CHARACTER AND WORLD CONSISTENCY
When generating multiple illustrations from the same book, maintain consistency in:

* Character facial features.
* Eye shape and proportions.
* Hairstyles.
* Body proportions.
* Clothing.
* Distinctive accessories.
* Environmental designs.
* Architecture.
* Historical details.
* Ink line weights.
* Screentone density.
* Shadow construction.
* Manga substyle.
* Overall visual quality.

Characters must remain recognizable across different scenes.
Do not arbitrarily change facial structures, hairstyles, clothing, or physical traits.
Recurring environments must preserve their established visual identities.
Consistency priority
Maintain the character's silhouette, face, hairstyle, and defining details even when the camera angle, lighting, expression, or pose changes.
Use previously established character illustrations as visual references when available.
19. ORIGINALITY AND COPYRIGHT
All characters, environments, costumes, and visual designs must be original interpretations of the supplied literary narrative.
Do not reproduce recognizable copyrighted manga or anime characters.
Do not recreate iconic costumes, hairstyles, character symbols, signature environments, or famous compositions from existing manga and anime franchises.
Avoid imitating the distinctive visual identity of a particular contemporary manga artist.
Use broad professional Japanese manga illustration techniques rather than copying an existing series.
For public-domain literary characters, create original manga interpretations based on their written descriptions.
The artwork must be suitable for use in a commercial literary illustration application.
20. STRICT NEGATIVE PROMPT
Avoid:

* Photorealism.
* Photography.
* CGI.
* 3D rendering.
* Unreal Engine aesthetics.
* Video-game screenshots.
* Western superhero comic styling.
* Generic digital anime screenshots.
* Glossy digital painting.
* Full-color rendering.
* Watercolor painting.
* Realistic photographic textures.
* Excessively smooth gradients.
* Uniform vector outlines.
* Flat corporate illustration.
* Inconsistent halftone patterns.
* Excessive screentone noise.
* Blurred linework.
* Excessive crosshatching.
* Unnecessary speed lines.
* Mandatory exaggerated expressions.
* Generic manga character faces.
* Unnaturally large eyes in every character.
* Exaggerated anatomy.
* Unnecessary Japanese school uniforms.
* Random Japanese cultural symbols.
* Inconsistent character identities.
* Unnecessary decorative panels.
* Arbitrary comic-page layouts.
* Recognizable copyrighted characters.
* Iconic manga costumes.
* Existing franchise symbols.
* Text.
* Typography.
* Dialogue.
* Captions.
* Speech bubbles.
* Watermarks.
* Decorative page borders.

21. FINAL ART DIRECTION
Generate an extraordinary, original traditional Japanese manga illustration combining expressive professional ink linework, sophisticated black-and-white screentones, elegant character design, refined manga composition, and emotionally compelling visual storytelling.
The artwork must feel professionally hand-drawn, beautifully detailed, expressive, authentic, and visually consistent.
Preserve the traditional qualities of ink-on-paper illustration.
Prioritize narrative accuracy, character continuity, confident linework, sophisticated screentone shading, and elegant visual hierarchy.
Visual Priority Order

1. Authentic professional Japanese manga illustration.
2. Expressive organic black ink linework.
3. Sophisticated traditional screentone shading.
4. Distinctive original character designs.
5. Refined facial expressions and body language.
6. Strong monochromatic composition.
7. Detailed but controlled environmental illustration.
8. Consistent character and world design.
9. Premium handcrafted print-like quality.
10. Faithful representation of the literary passage.

The manga style determines how characters and environments are illustrated. The source narrative determines what appears in the scene.
22. DYNAMIC SCENE INPUT — BOOKMOO
Illustrate the following literary scene using the traditional manga artistic principles established above.
SCENE DESCRIPTION:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
HISTORICAL AND CULTURAL CONTEXT:
{{world_context}}
ENVIRONMENT:
{{environment_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
LIGHTING AND TIME OF DAY:
{{lighting_context}}
COMPOSITION AND CAMERA ANGLE:
{{composition}}
MANGA SUBSTYLE (OPTIONAL):
{{manga_substyle}}
PREVIOUS CHARACTER AND WORLD REFERENCES:
{{visual_references}}
ASPECT RATIO:
{{aspect_ratio}}
FINAL GENERATION INSTRUCTION
Create one complete, original, beautifully composed, professional black-and-white Japanese manga illustration.
Apply expressive hand-drawn ink contours, authentic professional screentones, elegant character anatomy, refined facial expressions, sophisticated monochromatic shading, and beautiful manga visual storytelling.
Faithfully represent the supplied literary scene.
Maintain established character identities, consistent hairstyles, clothing, physical proportions, and environmental details.
Use manga illustration techniques to interpret the narrative without altering its historical, cultural, or fictional context.
Do not automatically introduce action scenes, exaggerated expressions, Japanese cultural objects, or comic panels.
Do not reproduce recognizable copyrighted manga or anime characters.
Unless explicitly requested otherwise, generate a single full-frame illustration rather than a multi-panel manga page.
Strictly black-and-white artwork with refined grayscale screentones.
No text, no captions, no typography, no dialogue, no speech bubbles, no logos, no decorative borders, and no watermarks.$sty$ where id = 'manga-tradicional';
update comic_styles set prompt = $sty$12. ANIME COLORIDO — JAPANESE ANIME
Style ID: `colorful_anime_12`
Category: Japanese Anime / Premium 2D Animation Illustration
Visual Identity: Colorful, expressive, cinematic, hand-drawn, atmospheric, beautifully painted, emotionally engaging, and visually sophisticated.
MASTER STYLE PROMPT
Create an extraordinary, original Japanese anime-style literary illustration combining premium traditional 2D animation aesthetics, expressive hand-drawn character design, sophisticated cel shading, beautifully painted environmental backgrounds, cinematic composition, and atmospheric visual storytelling.
The artwork must resemble a beautifully crafted key visual or exceptionally detailed animation frame from a premium original Japanese 2D animated production.
Prioritize elegant character designs, expressive facial features, clean yet organic outlines, harmonious color palettes, sophisticated environmental painting, beautiful natural lighting, and emotionally compelling visual composition.
The illustration must feel artistically handcrafted, visually immersive, expressive, vibrant, and unmistakably two-dimensional.
The defining characteristic of this style is the combination of expressive 2D anime character illustration, refined cel shading, clean organic linework, beautifully painted backgrounds, and sophisticated cinematic lighting.
The final image must not resemble a 3D animated film, video-game screenshot, or photorealistic digital painting.
1. ARTISTIC IDENTITY AND ANIMATION TECHNIQUE
Use sophisticated visual principles associated with high-quality traditional Japanese 2D animation.
The image should possess the artistic quality of a carefully illustrated animation frame.
Primary artistic characteristics

* Premium hand-drawn 2D anime illustration.
* Clean and expressive character linework.
* Sophisticated cel shading.
* Beautifully painted environmental backgrounds.
* Elegant character proportions.
* Refined facial expressions.
* Organic visual imperfections.
* Cinematic atmospheric composition.
* Harmonious color relationships.
* Strong visual silhouettes.
* Carefully controlled lighting.
* Subtle painterly textures.
* Natural character gestures.
* Professional animation-art direction.

Maintain a clear relationship between simplified character rendering and more detailed environmental painting.
The characters should feel naturally integrated into the illustrated backgrounds.
Avoid generic anime image-generation aesthetics.
Every element should feel deliberately designed by a professional animation art director.
2. LINEWORK — CLEAN AND EXPRESSIVE CONTOURS
Use refined traditional anime-style linework with organic variation in thickness and pressure.
Primary contours

* Clean, confident outlines.
* Natural line-weight variation.
* Slightly tapered strokes.
* Elegant flowing curves.
* Delicate internal details.
* Carefully controlled silhouette edges.
* Subtle handmade irregularities.
* Smooth but not mechanical contours.
* Expressive character construction.

Line-weight hierarchy
Use slightly stronger outlines for primary silhouettes and foreground elements.
Use thinner lines for facial features, hair details, clothing folds, and secondary objects.
Reduce line density in distant environments.
Line color
Outlines do not need to be uniformly black.
Use dark variations of local colors where appropriate.
Examples include deep brown contours for warm environments, dark blue-gray for cool lighting, and charcoal lines for neutral objects.
Important rule
The drawing must feel clean and professionally finished without becoming vector-like.
Avoid excessively thick black outlines, perfectly uniform strokes, or overly sterile digital linework.
Preserve the natural elegance of hand-drawn animation.
3. CEL SHADING — PRIMARY PAINTING TECHNIQUE
Cel shading is one of the fundamental characteristics of this visual style.
Use carefully designed two-dimensional shadow shapes rather than complex photorealistic gradients.
Primary cel-shading principles

* Clearly defined base colors.
* One dominant shadow tone per material.
* Selective secondary shadow tones.
* Simplified light and shadow boundaries.
* Elegantly designed shadow shapes.
* Controlled highlights.
* Strong color readability.
* Consistent directional lighting.
* Smooth matte surfaces.
* Restrained ambient color variation.

Character shading
Use simplified shadow masses to establish facial volume, clothing folds, hair depth, and body structure.
Avoid excessive skin rendering.
Soft-shading integration
Certain areas may incorporate delicate painterly transitions, particularly:

* Atmospheric lighting.
* Environmental backgrounds.
* Subtle reflected light.
* Hair highlights.
* Soft ambient shadows.

Maintain a clear anime illustration identity.
Do not replace cel shading with realistic oil painting, photorealistic material shading, or 3D rendering.
4. COLOR LANGUAGE
Use sophisticated, expressive color palettes inspired by premium 2D animation background and character painting.
Primary palette families
Natural atmospheric colors

* Soft sky blue.
* Muted turquoise.
* Gentle sage green.
* Warm golden ochre.
* Pale lavender.
* Desaturated blue-gray.

Warm expressive colors

* Soft coral.
* Warm peach.
* Terracotta.
* Amber.
* Muted crimson.
* Golden sunlight.

Cool dramatic colors

* Deep navy.
* Indigo.
* Atmospheric violet.
* Steel blue.
* Cool cyan.
* Muted teal.

Neutral colors

* Warm ivory.
* Cream.
* Soft gray.
* Charcoal.
* Earthy brown.
* Natural beige.

Color principles
Use harmonious colors with carefully controlled saturation.
Allow selected areas to contain more vibrant colors when narratively appropriate.
Maintain distinct visual separation between characters and backgrounds.
Create depth through temperature, saturation, and tonal contrast.
Critical rule
Do not automatically make every anime illustration colorful, cheerful, or pastel.
The anime technique must support darker stories, mysteries, historical narratives, emotional dramas, and serious literary scenes.
Adapt color grading to the narrative.
5. CHARACTER DESIGN
Create original anime characters with expressive, sophisticated designs.
Characters must possess distinctive individual identities rather than generic anime appearances.
Character characteristics

* Elegant stylized anatomy.
* Believable body proportions.
* Carefully designed facial features.
* Expressive eyes.
* Distinctive hairstyles.
* Natural body language.
* Strong silhouettes.
* Graceful gestures.
* Visually coherent clothing.
* Consistent character identities.
* Professional 2D character construction.

Anatomical treatment
Use slightly stylized proportions with believable structural anatomy.
The amount of stylization should correspond to the narrative genre, character age, and emotional atmosphere.
Avoid excessively elongated limbs, distorted proportions, and exaggerated character anatomy.
Character individuality
Preserve the physical features specified in the literary source.
Different characters must have recognizable facial structures, hairstyles, silhouettes, and expressions.
Do not generate identical faces with different hair colors.
Critical rule
Anime is the illustration language, not the cultural identity of the characters.
Do not automatically change the nationality, ethnicity, clothing, historical period, or cultural appearance of literary characters.
6. FACIAL EXPRESSIONS AND EMOTIONAL DESIGN
Facial expression is essential to the visual identity of high-quality anime illustration.
Use carefully designed features to communicate subtle and complex emotions.
Eyes

* Expressive shapes.
* Carefully controlled highlights.
* Natural gaze direction.
* Character-specific proportions.
* Delicate eyelid construction.
* Appropriate iris detail.
* Emotionally meaningful expressions.

Eyebrows
Use subtle changes in angle, position, and shape to communicate feelings.
Mouth
Use restrained, readable shapes appropriate to the character's emotional state.
Facial structure
Maintain consistency in:

* Jawline.
* Nose.
* Eye spacing.
* Eyebrow placement.
* Ear proportions.
* Face shape.
* Hairstyle.
* Distinctive facial characteristics.

Emotional range
Support joy, wonder, curiosity, sadness, uncertainty, fear, determination, contemplation, surprise, affection, nostalgia, and melancholy.
Avoid automatically adding exaggerated anime expressions, oversized tears, dramatic blush effects, or comedic symbols.
Use expressive exaggeration only when appropriate to the narrative.
7. HAIR ILLUSTRATION
Create beautifully designed anime hairstyles with clear shapes and controlled internal detail.
Hair-rendering principles

* Strong primary hair masses.
* Natural directional flow.
* Carefully designed locks.
* Refined contour lines.
* Selective individual strands.
* Elegant cel-shaded shadow shapes.
* Controlled highlights.
* Natural movement.
* Believable volume.
* Consistent silhouettes.

Hair color should follow the source narrative.
Do not automatically assign unusual colors to characters.
A character described with ordinary brown hair should remain recognizable as having brown hair.
Hair must retain its established structure across multiple illustrations.
8. CLOTHING AND FABRIC DESIGN
Render clothing with professional anime-style character illustration techniques.
Fabric characteristics

* Clean contour construction.
* Simplified but believable folds.
* Carefully placed cel-shaded shadows.
* Natural material movement.
* Controlled color variation.
* Consistent garment design.
* Sophisticated silhouette readability.
* Refined costume details.

Costume accuracy
Clothing must reflect the narrative's:

* Historical period.
* Cultural context.
* Climate.
* Character personality.
* Social environment.
* Occupation.
* Fictional world.

Do not automatically add Japanese school uniforms, fantasy armor, elaborate robes, or futuristic clothing.
The source material determines the costume.
9. ENVIRONMENTAL PAINTING
Create beautifully painted backgrounds inspired by premium traditional 2D animation environment art.
Environments should possess richer painterly detail than the characters while remaining visually harmonious.
Background characteristics

* Sophisticated hand-painted textures.
* Elegant architectural perspective.
* Beautiful natural color variation.
* Atmospheric depth.
* Organic environmental brushwork.
* Soft environmental shadows.
* Selective detailed surfaces.
* Graceful vegetation.
* Painterly cloud formations.
* Carefully controlled contrast.

Artistic balance
Characters should primarily use clean anime linework and cel shading.
Backgrounds may use more expressive digital painting, watercolor-inspired textures, and delicate atmospheric gradients.
The two techniques must blend naturally.
Avoid creating backgrounds that look like realistic photographs behind cartoon characters.
10. ARCHITECTURE AND WORLD DESIGN
Create coherent environments appropriate to the literary narrative.
Possible settings include:

* Contemporary cities.
* Rural villages.
* Historical architecture.
* Fantasy kingdoms.
* Futuristic environments.
* Domestic interiors.
* Natural landscapes.
* Educational institutions.
* Industrial locations.
* Fictional civilizations.

These are possibilities, not mandatory objects.
Architectural principles

* Believable perspective.
* Clear structural forms.
* Beautiful environmental lighting.
* Appropriate material treatment.
* Cohesive visual design.
* Selective atmospheric detail.
* Consistent fictional architecture.

Do not automatically introduce Japanese buildings, temples, cherry blossoms, or culturally specific architecture into unrelated literary settings.
The visual world must respect the book's actual descriptions.
11. CINEMATIC LIGHTING
Use sophisticated lighting associated with premium 2D animation.
The goal is to create emotionally expressive illumination without losing the flat, illustrated character of anime.
Lighting characteristics

* Beautiful natural daylight.
* Soft atmospheric shadows.
* Warm golden-hour light.
* Controlled rim lighting.
* Subtle reflected illumination.
* Carefully designed highlights.
* Soft ambient color.
* Natural environmental light.
* Elegant shadow silhouettes.
* Delicate atmospheric glow when appropriate.

Character lighting
Use simplified lighting relationships appropriate to cel shading.
Environment lighting
Backgrounds may contain more sophisticated light gradients, atmospheric illumination, and painterly environmental transitions.
Lighting consistency
Every light source should have a believable origin.
Avoid random glowing highlights and unnecessary cinematic effects.
Do not automatically apply golden-hour lighting to every scene.
12. ATMOSPHERE AND ENVIRONMENTAL DEPTH
Create depth through color, perspective, light, and environmental painting.
Atmospheric techniques

* Soft distant haze.
* Subtle aerial perspective.
* Natural cloud layers.
* Gentle environmental color variation.
* Carefully controlled light diffusion.
* Soft painterly gradients.
* Reduced contrast in distant objects.
* Elegant background abstraction.

Atmospheric effects should complement the scene.
Do not automatically add drifting petals, magical particles, stars, rain, or floating lights.
These elements should appear only when narratively appropriate.
13. COMPOSITION AND CINEMATIC STORYTELLING
Create visually engaging, elegantly composed anime illustrations.
Use professional animation framing and cinematic storytelling.
Composition principles

* Clear focal points.
* Strong character silhouettes.
* Balanced negative space.
* Carefully designed visual hierarchy.
* Natural leading lines.
* Expressive body language.
* Meaningful character placement.
* Sophisticated environmental depth.
* Clean scene readability.
* Harmonious visual rhythm.

Framing options
Close-up: Emphasize subtle facial expressions and emotional moments.
Medium shot: Show character interactions and natural gestures.
Wide shot: Establish environments and relationships between characters and locations.
Establishing shot: Communicate geography, atmosphere, or world-building.
Dynamic perspective: Add energy when movement is an important part of the narrative.
Critical composition rule
Do not automatically turn every scene into an action shot or dramatic anime poster.
Quiet conversations, ordinary activities, introspective moments, and subtle interactions must receive equally sophisticated visual treatment.
14. TRADITIONAL 2D ANIMATION INFLUENCE
Introduce the visual craftsmanship associated with carefully produced traditional animation.
Animation principles

* Clear character silhouettes.
* Consistent character construction.
* Expressive pose design.
* Clean color separation.
* Elegant cel-shaded surfaces.
* Carefully controlled line weights.
* Simplified character volumes.
* Beautifully painted environments.
* Deliberate visual hierarchy.
* Emotionally meaningful staging.

The illustration should resemble an original key animation illustration with premium finishing.
Avoid crude animation screenshots or unfinished production sketches.
The final artwork should be complete, polished, and beautiful while retaining the aesthetic of traditional 2D illustration.
15. MOTION AND CHARACTER GESTURES
When the scene contains movement, represent it through natural poses, clothing motion, environmental interaction, and expressive composition.
Motion principles

* Believable body mechanics.
* Dynamic but readable silhouettes.
* Natural fabric movement.
* Appropriate hair motion.
* Coherent gesture direction.
* Expressive action poses.
* Strong compositional flow.

Avoid exaggerated action effects unless the scene requires them.
Do not automatically introduce speed lines, impact bursts, or comic-book motion graphics.
Anime illustrations should communicate movement primarily through character posing and composition.
16. EMOTIONAL AND NARRATIVE RANGE
This style must work across multiple literary genres.
Fantasy
Use expressive character designs, beautifully painted imaginary environments, and sophisticated atmospheric lighting.
Romance
Prioritize subtle facial expressions, meaningful gestures, emotional framing, and delicate lighting.
Science fiction
Maintain original anime character construction while introducing coherent futuristic environments and technology.
Historical fiction
Use accurate costumes, architecture, and cultural context while preserving the anime drawing technique.
Mystery
Create visual tension through controlled lighting, expressions, and composition.
Adventure
Use dynamic character staging, environmental scale, and expressive silhouettes.
Everyday life
Use natural gestures, believable environments, and quiet emotional storytelling.
Important rule
The anime style must not dictate the story's genre or emotional tone.
The source passage determines the atmosphere.
17. SURFACE TEXTURE AND ARTISTIC MATERIALITY
Preserve subtle handmade texture in the illustration.
Character surfaces
Use mostly clean matte colors, controlled cel shading, and delicate brush imperfections.
Environmental surfaces
Use more expressive painterly textures, including:

* Fine natural brushwork.
* Soft pigment variation.
* Subtle paper-like grain.
* Organic color transitions.
* Delicate environmental texture.
* Natural surface irregularities.

Texture philosophy
Characters should remain visually clear.
Environments should possess richer artistic depth.
Avoid excessive film grain, artificial paper aging, and noisy digital filters.
The final result must feel like premium 2D animation artwork.
18. LEVEL OF DETAIL
Use sophisticated control over detail distribution.
Primary characters
High-quality linework, refined facial features, beautiful cel shading, and clear silhouettes.
Secondary characters
Moderate detail, simplified shading, and coherent character construction.
Foreground environments
Refined painted details with strong environmental readability.
Background environments
Softer brushwork, atmospheric perspective, reduced contrast, and controlled detail.
Avoid making every surface equally detailed.
The viewer's attention should naturally focus on the most important narrative subjects.
19. CONSISTENCY ACROSS MULTIPLE ILLUSTRATIONS
When generating multiple illustrations from the same book, preserve strict visual continuity.
Character consistency

* Facial structure.
* Eye shape.
* Hairstyle.
* Hair color.
* Skin tone.
* Body proportions.
* Age.
* Clothing design.
* Distinctive accessories.
* Character silhouette.

World consistency

* Architecture.
* Historical setting.
* Environmental details.
* Recurring locations.
* Technological level.
* Cultural characteristics.
* Important objects.
* Fictional world rules.

Artistic consistency

* Linework thickness.
* Cel-shading technique.
* Character stylization.
* Background painting.
* Lighting philosophy.
* Color treatment.
* Texture density.
* Overall visual quality.

Recurring characters must remain recognizable from any camera angle.
Use previous character and environment references when available.
Do not invent visual changes that contradict the established story.
20. ORIGINALITY AND COPYRIGHT
Create original anime character designs, original environments, and original visual interpretations of the literary material.
Do not reproduce recognizable copyrighted anime characters, iconic costumes, signature hairstyles, franchise symbols, or famous visual compositions.
Do not imitate the distinctive style of a particular contemporary animation studio, director, or illustrator.
Use general visual principles of professional Japanese 2D animation.
For public-domain literary characters, develop original visual designs based on their written descriptions.
The resulting illustrations must be suitable for a commercial literary application.
21. STRICT NEGATIVE PROMPT
Avoid:

* Photorealism.
* Photography.
* CGI.
* 3D rendering.
* 3D anime models.
* Plastic-looking characters.
* Video-game screenshots.
* Unreal Engine aesthetics.
* Generic AI-generated anime faces.
* Excessive digital airbrushing.
* Glossy synthetic skin.
* Heavy realistic skin textures.
* Western superhero comic aesthetics.
* Traditional monochrome manga screentones.
* Excessively thick black outlines.
* Flat corporate vector illustration.
* Mechanically uniform linework.
* Overly saturated colors.
* Excessive bloom.
* Unnecessary lens flares.
* Random magical particles.
* Mandatory cherry blossoms.
* Unnecessary Japanese cultural symbols.
* Generic school uniforms.
* Exaggerated facial expressions.
* Unnaturally large eyes in every character.
* Identical character faces.
* Inconsistent character anatomy.
* Inconsistent character identities.
* Excessive perspective distortion.
* Photographic background textures.
* Unnecessary action poses.
* Existing copyrighted anime characters.
* Iconic licensed costumes.
* Recognizable franchise designs.
* Logos.
* Text.
* Typography.
* Captions.
* Dialogue.
* Speech bubbles.
* Watermarks.
* Decorative borders.

22. FINAL ART DIRECTION
Generate an extraordinary, original Japanese anime literary illustration combining premium hand-drawn 2D animation aesthetics, sophisticated cel shading, expressive original character design, beautifully painted environmental backgrounds, and refined cinematic storytelling.
The artwork must feel artistic, emotionally expressive, visually polished, and unmistakably two-dimensional.
Preserve elegant linework, matte painted colors, beautiful atmospheric lighting, rich environmental painting, and natural character expressions.
Avoid generic anime stereotypes.
Visual Priority Order

1. Premium original Japanese 2D anime illustration.
2. Refined expressive character linework.
3. Professional cel shading.
4. Distinctive character identities.
5. Beautiful hand-painted backgrounds.
6. Sophisticated cinematic composition.
7. Emotionally expressive facial features and gestures.
8. Harmonious color relationships.
9. Atmospheric environmental lighting.
10. Consistent world and character design.
11. Faithful representation of the literary passage.

The anime style determines the illustration technique. The literary narrative determines the characters, environment, historical context, and emotional atmosphere.
23. DYNAMIC SCENE INPUT — BOOKMOO
Illustrate the following literary scene using the premium Japanese anime artistic principles established above.
SCENE DESCRIPTION:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
HISTORICAL AND CULTURAL CONTEXT:
{{world_context}}
ENVIRONMENT:
{{environment_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
LIGHTING AND TIME OF DAY:
{{lighting_context}}
COMPOSITION AND CAMERA ANGLE:
{{composition}}
IMPORTANT NARRATIVE OBJECTS:
{{narrative_objects}}
PREVIOUS CHARACTER AND WORLD REFERENCES:
{{visual_references}}
ASPECT RATIO:
{{aspect_ratio}}
FINAL GENERATION INSTRUCTION
Create one complete, original, beautifully composed, premium Japanese 2D anime literary illustration.
Apply sophisticated hand-drawn character design, elegant anime contours, professional cel shading, expressive facial features, beautiful hand-painted backgrounds, cinematic lighting, and atmospheric visual storytelling.
Faithfully represent the supplied literary passage.
Maintain established character identities, consistent hairstyles, clothing, facial structures, environmental design, and narrative continuity across illustrations.
Do not introduce unrelated Japanese cultural elements, stereotypical anime accessories, exaggerated expressions, or decorative effects absent from the narrative.
Do not reproduce recognizable copyrighted anime characters, iconic franchise designs, or signature compositions.
Generate a single full-frame anime illustration, not a manga page or multi-panel comic layout, unless explicitly requested.
The final result must look like premium original 2D animation artwork rather than CGI or photorealistic rendering.
No text, no captions, no typography, no speech bubbles, no logos, no decorative borders, and no watermarks.$sty$ where id = 'anime-colorido';
update comic_styles set prompt = $sty$13. HQ AMERICANA — AMERICAN COMIC BOOK
Style ID: `american_comic_13`
Category: American Comic Book / Graphic Novel Illustration
Visual Identity: Bold, graphic, expressive, dynamic, hand-inked, colorful, cinematic, detailed, and professionally illustrated.
MASTER STYLE PROMPT
Create an extraordinary, original American comic book illustration combining professional traditional comic penciling, expressive hand-inked linework, sophisticated graphic shading, vibrant yet controlled color flats, refined comic-book rendering, and cinematic visual storytelling.
The artwork must resemble a premium professionally illustrated American graphic novel, with the craftsmanship of traditional penciling, inking, and coloring.
Prioritize powerful visual silhouettes, expressive character anatomy, bold ink contours, carefully constructed shadow masses, sophisticated color separation, dynamic but readable composition, and emotionally compelling visual storytelling.
The illustration must feel handcrafted, visually impactful, artistically sophisticated, and unmistakably two-dimensional.
The defining characteristic of this style is the combination of bold American comic-book inking, expressive anatomical drawing, graphic shadow construction, confident color blocking, and dramatic narrative composition.
The final artwork must remain an original hand-drawn comic illustration rather than a photograph, 3D render, animated-film screenshot, or generic digital painting.
1. ARTISTIC IDENTITY AND TRADITIONAL COMIC TECHNIQUE
Use professional American comic book illustration techniques combining detailed pencil construction, expressive ink finishing, and sophisticated digital coloring.
The image should possess the artistic quality of a premium contemporary graphic novel.
Primary artistic characteristics

* Professional American comic-book illustration.
* Expressive hand-drawn pencil foundations.
* Confident black ink contours.
* Dynamic variations in line thickness.
* Sophisticated anatomical construction.
* Strong character silhouettes.
* Carefully designed black shadow masses.
* Refined graphic color blocking.
* Selective crosshatching.
* Elegant material textures.
* Controlled halftone effects.
* Professional comic-book coloring.
* Cinematic visual composition.
* Expressive facial storytelling.
* Strong graphic readability.

Maintain a balance between traditional handmade artwork and modern professional comic-book finishing.
Avoid making the illustration excessively polished or mechanically perfect.
Preserve visible artistic decisions through linework, shadow construction, and color treatment.
2. LINEWORK — THE PRIMARY VISUAL SIGNATURE
Linework is one of the most important elements of American comic illustration.
Use expressive, confident black ink strokes with sophisticated variations in thickness, direction, and pressure.
Primary contours

* Bold black exterior outlines.
* Naturally tapered ink strokes.
* Organic line-weight variation.
* Strong silhouettes.
* Delicate internal details.
* Expressive angular accents.
* Carefully controlled contour intersections.
* Slightly imperfect hand-drawn edges.
* Confident anatomical construction.
* Elegant ink flow.

Line-weight hierarchy
Use thicker lines for:

* Primary character silhouettes.
* Foreground objects.
* Deep shadow boundaries.
* Dramatic clothing folds.
* Important environmental contours.
* Areas requiring strong visual emphasis.

Use thinner lines for:

* Facial details.
* Hair strands.
* Fabric textures.
* Background architecture.
* Environmental surfaces.
* Minor anatomical structures.
* Delicate material details.

Important linework principle
Line thickness should help communicate depth, lighting, material, and visual hierarchy.
Avoid uniform digital outlines.
The result should feel drawn by an accomplished traditional comic-book ink artist.
3. PROFESSIONAL COMIC BOOK INKING
Use sophisticated black ink techniques to create depth, form, dramatic contrast, and expressive visual structure.
Inking techniques
Bold black spotting
Use large, carefully designed solid-black areas to establish shadows and contrast.
Feathering
Use groups of tapered ink strokes to create controlled transitions between shadow and light.
Crosshatching
Apply intersecting ink lines selectively to establish material texture and tonal density.
Directional hatching
Use parallel lines following the surface structure of characters, fabric, architecture, and objects.
Brush inking
Use expressive variable-width strokes to create natural movement and strong silhouettes.
Fine pen detailing
Use thin, precise ink marks for facial features, material accents, and environmental detail.
Inking principles
Maintain a coherent balance between black ink masses, detailed lines, and open areas.
Do not fill every surface with excessive hatching.
Preserve clear silhouettes and visual readability.
Strong black ink construction should remain recognizable even when the illustration is viewed without color.
4. COLORING — PROFESSIONAL COMIC BOOK COLORS
Use sophisticated American comic-book coloring with clean color separation, carefully designed shadow shapes, and controlled digital painting accents.
Primary coloring techniques

* Professional color flats.
* Strong local color separation.
* Carefully selected shadow tones.
* Selective highlight colors.
* Graphic color blocking.
* Subtle tonal gradients where appropriate.
* Controlled ambient color variation.
* Sophisticated warm and cool relationships.
* Harmonious environmental color grading.

Color application
Each object should have clearly recognizable base colors.
Use graphic shadows to reinforce dimensional structure.
Highlights should enhance volume without producing glossy digital surfaces.
Preserve the visual relationship between black ink contours and colored areas.
Painting restrictions
Do not replace the traditional comic-book appearance with realistic digital painting.
Colors should support the artwork's ink structure rather than conceal it.
Avoid excessive airbrushing and photorealistic shading.
5. COLOR LANGUAGE
Use bold, sophisticated, visually compelling color palettes.
Primary color families
Strong graphic colors

* Deep crimson.
* Rich cobalt blue.
* Emerald green.
* Warm golden yellow.
* Burnt orange.
* Royal purple.

Cinematic darker tones

* Charcoal.
* Midnight blue.
* Dark burgundy.
* Forest green.
* Slate gray.
* Deep violet.

Neutral supporting colors

* Warm ivory.
* Stone gray.
* Natural beige.
* Earthy brown.
* Soft cream.
* Muted taupe.

Color principles
Use clear color separation and strong visual hierarchy.
Reserve saturated colors for important characters, objects, or narrative moments.
Create sophisticated contrast between characters and environments.
Avoid assigning strong primary colors to every element.
Critical rule
Do not automatically use red-and-blue superhero color palettes.
The visual language must support romantic stories, historical fiction, mysteries, ordinary human interactions, fantasy, and contemporary literary scenes.
A serious graphic novel may use subdued colors, while an adventurous story may benefit from richer saturation.
The narrative determines the palette.
6. CHARACTER DESIGN
Create original characters with expressive anatomy, distinctive personalities, strong silhouettes, and professional comic-book rendering.
Character characteristics

* Believable anatomical structure.
* Expressive body language.
* Distinctive facial proportions.
* Strong visual silhouettes.
* Natural character individuality.
* Carefully constructed gestures.
* Sophisticated ink shading.
* Refined costume details.
* Clear emotional expressions.
* Consistent physical characteristics.
* Professional comic-book character design.

Anatomical treatment
Use a balance of realistic anatomy and controlled artistic exaggeration.
Muscle groups, body proportions, joint structures, and natural movement should remain believable.
Stylization may emphasize gesture, action, or personality.
However, avoid automatically exaggerating muscularity, height, body shape, or physical proportions.
Character individuality
Every recurring character must retain a distinctive visual identity.
Avoid generic character faces.
Preserve the descriptions provided by the literary source.
The American comic style determines how a character is illustrated, not how their body, ethnicity, age, or identity must be changed.
7. FACIAL EXPRESSIONS
Facial expression is essential for compelling graphic novel storytelling.
Create emotionally expressive faces using sophisticated linework, anatomical structure, and selective shading.
Eyes

* Clear directional gaze.
* Character-specific eye shapes.
* Controlled eyelid details.
* Expressive eyebrow relationships.
* Natural iris positioning.
* Meaningful highlights.

Mouth and jaw
Use natural expression changes to communicate emotion.
Preserve believable facial anatomy.
Facial shading
Use selective black shapes, controlled hatching, and color shadows to define structure.
Emotional range
Support:

* Determination.
* Curiosity.
* Joy.
* Melancholy.
* Doubt.
* Surprise.
* Confidence.
* Vulnerability.
* Suspense.
* Reflection.
* Affection.
* Discovery.
* Quiet contemplation.

Avoid exaggerated expressions when the scene calls for subtlety.
Not every character needs to appear angry, intense, or heroic.
8. HAIR AND FACIAL DETAIL
Render hair with confident graphic shapes and elegant directional ink strokes.
Hair-rendering principles

* Strong primary hair masses.
* Expressive silhouette construction.
* Natural directional flow.
* Controlled internal strand details.
* Selective black ink shadows.
* Carefully positioned highlights.
* Believable volume.
* Consistent hairstyles.

Use ink shading to establish shape without drawing every individual strand.
Keep hairstyles appropriate to the character descriptions.
Avoid automatically introducing exaggerated superhero hairstyles.
9. CLOTHING AND COSTUME DESIGN
Create visually coherent clothing using professional comic-book illustration techniques.
Clothing rendering

* Strong ink contours.
* Expressive fabric folds.
* Believable material construction.
* Graphic shadow shapes.
* Selective texture lines.
* Natural fabric movement.
* Controlled highlights.
* Clear silhouette design.

Costume accuracy
Clothing must follow the narrative's historical period, cultural context, location, and character identity.
Possible clothing types include contemporary everyday fashion, historical garments, fantasy clothing, uniforms, or specialized equipment.
These are optional.
Do not automatically introduce superhero costumes, capes, masks, armor, or tactical equipment.
Characters must wear clothing consistent with the actual literary scene.
10. GRAPHIC SHADOW CONSTRUCTION
Use strong, carefully designed graphic shadows to establish volume, atmosphere, and dramatic visual hierarchy.
Shadow techniques

* Solid black ink masses.
* Directional shadow shapes.
* Simplified colored shadow regions.
* Selective ink feathering.
* Refined hatching.
* Controlled ambient shadows.
* Clear light and shadow separation.

Shadow principles
Shadows should reinforce the underlying anatomy and object structure.
Avoid random black patches unrelated to lighting.
Use large shadow shapes to strengthen compositions.
Maintain enough visibility for important characters and objects to remain readable.
The shadow treatment must feel intentionally illustrated.
11. HALFTONES AND PRINT TEXTURES
Introduce subtle traditional comic printing influences when appropriate.
Possible techniques

* Fine halftone dots.
* Restrained Ben-Day-inspired patterns.
* Subtle printed color texture.
* Light paper grain.
* Fine ink imperfections.
* Controlled tonal patterns.

Application rules
Use halftones selectively in shadows, backgrounds, and secondary surfaces.
Avoid applying heavy halftone patterns across the entire illustration.
Do not automatically create a retro pop-art appearance.
The default style should resemble a premium contemporary American comic book with selected traditional print influences.
Strong retro printing effects should be handled as a separate variation.
12. ENVIRONMENT AND ARCHITECTURE
Create detailed environments using professional comic-book perspective drawing and expressive ink finishing.
Environmental characteristics

* Believable architectural perspective.
* Confident structural outlines.
* Carefully controlled material detail.
* Strong environmental silhouettes.
* Expressive surface textures.
* Clear graphic shadow masses.
* Layered spatial depth.
* Sophisticated color separation.
* Selective atmospheric abstraction.

Possible environments

* Contemporary cities.
* Residential interiors.
* Historical towns.
* Fantasy environments.
* Futuristic cities.
* Natural landscapes.
* Rural communities.
* Industrial buildings.
* Public institutions.
* Fictional civilizations.

The setting must follow the source narrative.
Avoid automatically introducing skyscrapers, destroyed cities, or dramatic action environments.
Environmental consistency
Recurring locations must maintain their established architecture, spatial structure, and recognizable features.
13. CINEMATIC COMPOSITION
Create powerful, professional comic-book compositions that communicate narrative meaning.
Use:

* Strong visual hierarchy.
* Dynamic but believable perspective.
* Expressive character placement.
* Clear focal points.
* Dramatic silhouettes.
* Balanced negative space.
* Purposeful leading lines.
* Layered foreground and background.
* Meaningful environmental framing.
* Strong graphic readability.

Camera framing
Close-up
Use for meaningful facial expressions, important discoveries, or emotional reactions.
Medium shot
Use for conversations, character gestures, and interpersonal interactions.
Wide shot
Use to establish environments, groups, and spatial relationships.
Low-angle shot
Use when the scene requires a powerful sense of scale.
High-angle shot
Use for spatial storytelling or carefully selected narrative emphasis.
Dynamic perspective
Use when the passage involves motion, energy, or dramatic spatial relationships.
Important rule
Do not exaggerate camera angles unnecessarily.
A peaceful conversation should not automatically become a dramatic action pose.
Comic-book composition should support every kind of literary scene.
14. ACTION AND MOVEMENT
When movement is described in the source passage, represent it through expressive anatomy, strong silhouettes, gesture, and carefully designed composition.
Motion techniques

* Dynamic character poses.
* Natural body mechanics.
* Flowing fabric.
* Directional gesture lines.
* Carefully controlled speed lines.
* Expressive environmental movement.
* Strong visual rhythm.

Motion effects must remain appropriate to the scene.
Avoid unnecessary impact bursts, exaggerated speed lines, or dramatic effects in static scenes.
Action illustration
Prioritize readable movement and clear spatial relationships.
Avoid excessive visual clutter.
Do not introduce unrelated confrontations or action sequences merely to make the image visually exciting.
15. GRAPHIC NOVEL STORYTELLING
The American comic-book style must support both visually dynamic and emotionally subtle scenes.
Narrative principles

* Clear storytelling.
* Meaningful character interactions.
* Purposeful visual details.
* Controlled emotional emphasis.
* Strong narrative focal points.
* Expressive staging.
* Distinctive environmental design.
* Appropriate visual pacing.

Single illustration versus comic page
Default output: one complete full-frame illustration.
Do not automatically divide the image into multiple panels.
Do not automatically generate speech bubbles, captions, or dialogue.
The illustration should resemble a professionally drawn comic-book scene without requiring a traditional comic-page layout.
Optional sequential mode
When explicitly requested by the application, the style may be adapted to multi-panel comic pages.
In that mode, use intentional panel composition, coherent sequential storytelling, and established reading order.
Panel creation is a separate layout instruction and must not override the artistic style specification.
16. LIGHTING
Use sophisticated cinematic lighting interpreted through traditional comic-book shading.
Lighting characteristics

* Strong directional highlights.
* Graphic shadow separation.
* Controlled rim lighting.
* Clear illuminated silhouettes.
* Natural ambient light.
* Carefully designed colored shadows.
* Subtle atmospheric illumination.
* Strong visual contrast.

Lighting treatment
Represent light primarily through:

* Ink shadow construction.
* Colored shadow shapes.
* Selective highlights.
* Local color variation.
* Controlled value separation.

Avoid replacing comic shading with photorealistic lighting simulation.
Scene adaptation
Daylight scenes should remain bright when appropriate.
Nighttime scenes may use deeper shadows and stronger highlights.
Interior scenes should reflect their actual light sources.
The narrative determines lighting.
17. MATERIAL RENDERING
Render materials through linework, graphic shading, and controlled color.
Skin
Believable anatomy, sophisticated ink accents, simplified tonal shading, and expressive features.
Fabric
Directional folds, selective hatching, clear shadow masses, and natural movement.
Metal
Graphic highlights, controlled reflections, and sharp structural contours.
Glass
Selective reflections, simplified transparent forms, and carefully designed highlights.
Stone and concrete
Expressive surface marks, structural shading, and controlled environmental texture.
Wood
Natural grain accents, restrained ink texture, and believable color variation.
Vegetation
Organic silhouettes, expressive directional lines, simplified leaf masses, and natural color relationships.
Avoid photographic textures and excessive microdetail.
Every material must retain a traditional comic-book illustration appearance.
18. EMOTIONAL AND GENRE FLEXIBILITY
The American comic-book style must work across different literary genres.
Fantasy
Use expressive character designs, rich environmental artwork, and imaginative graphic compositions.
Romance
Prioritize nuanced facial expressions, natural gestures, and meaningful character interactions.
Science fiction
Use carefully designed technology, futuristic environments, and coherent visual world-building.
Mystery
Use shadow, framing, character expression, and meaningful objects to establish atmosphere.
Historical fiction
Preserve authentic period clothing, architecture, and cultural details while applying comic-book rendering.
Adventure
Use expressive perspective, strong silhouettes, and dynamic visual storytelling when appropriate.
Drama
Use restrained compositions and emotionally expressive faces.
Everyday life
Use believable characters, natural environments, and sophisticated editorial framing.
The style must not force every narrative into the superhero genre.
American comics encompass a broad range of stories and visual atmospheres.
19. VISUAL DETAIL DISTRIBUTION
Use deliberate detail hierarchy.
Primary characters
Refined anatomy, expressive faces, strong outlines, and sophisticated ink finishing.
Secondary characters
Moderate detail, simplified shading, and coherent color treatment.
Foreground objects
Strong graphic contrast and carefully designed textures.
Background
Reduced line density, controlled color contrast, simplified detail, and atmospheric depth.
Preserve clear visual separation between subjects.
Avoid covering the entire illustration with equally dense linework.
20. HANDCRAFTED ARTISTIC TEXTURE
Preserve the appearance of professionally drawn and inked artwork.
Texture characteristics

* Subtle ink irregularities.
* Fine paper grain.
* Natural brush-pressure variation.
* Delicate pencil construction influence.
* Slightly imperfect contour edges.
* Controlled halftone texture.
* Fine directional hatch marks.
* Organic print-like materiality.

The image should feel created through a professional penciling, inking, and coloring workflow.
Avoid artificial grunge overlays, heavy printing defects, excessive noise, or distressed-paper effects.
The default output should look like a beautifully preserved, premium contemporary comic illustration.
21. CHARACTER AND WORLD CONSISTENCY
When generating multiple illustrations from the same book, preserve strict consistency.
Character identity

* Facial structure.
* Hairstyle and hair color.
* Body proportions.
* Age.
* Skin tone.
* Distinctive physical features.
* Clothing design.
* Accessories.
* Character silhouette.

World identity

* Architectural language.
* Historical context.
* Environmental features.
* Recurring locations.
* Important objects.
* Technology level.
* Fictional world rules.

Artistic consistency

* Ink contour weight.
* Black shadow density.
* Hatching technique.
* Color-flat treatment.
* Shading philosophy.
* Halftone usage.
* Character stylization.
* Environmental detail.
* Overall visual quality.

A recurring character must remain recognizable across different scenes and camera angles.
Use previous visual references whenever available.
Do not arbitrarily change established designs.
22. ORIGINALITY AND COPYRIGHT
Every illustration must be an original artistic interpretation of the supplied literary narrative.
Do not reproduce recognizable copyrighted comic-book characters, superhero costumes, signature symbols, franchise locations, or iconic comic covers.
Do not imitate the distinctive artwork of a specific contemporary comic-book artist.
Use broad American comic-book production techniques rather than copying a particular comic series or publisher's recognizable characters.
For public-domain literary characters, create original comic-book interpretations based on their written descriptions.
All costumes, characters, environments, and compositions must be original and appropriate for commercial literary illustration.
23. STRICT NEGATIVE PROMPT
Avoid:

* Photography.
* Photorealism.
* Hyperrealism.
* CGI.
* 3D rendering.
* Video-game screenshots.
* Unreal Engine aesthetics.
* Glossy plastic materials.
* Excessive realistic digital painting.
* Airbrushed character rendering.
* Uniform vector contours.
* Flat corporate illustration.
* Japanese manga screentone-heavy rendering.
* Generic anime character designs.
* Traditional watercolor storybook aesthetics.
* Excessive crosshatching.
* Excessive halftone noise.
* Heavy distressed printing textures.
* Oversaturated colors.
* Artificial lens flares.
* Excessive digital bloom.
* Unrealistically exaggerated anatomy.
* Mandatory superhero physiques.
* Unnecessary superhero costumes.
* Generic masks and capes.
* Random action poses.
* Excessive perspective distortion.
* Unnecessary speed lines.
* Excessive environmental clutter.
* Inconsistent character identities.
* Arbitrary panel divisions.
* Recognizable copyrighted comic characters.
* Famous comic-book cover recreations.
* Existing franchise symbols.
* Logos.
* Text.
* Typography.
* Dialogue.
* Captions.
* Speech bubbles.
* Watermarks.
* Decorative page borders.

24. FINAL ART DIRECTION
Generate an extraordinary, original American comic-book literary illustration combining expressive professional penciling, confident hand-inked outlines, sophisticated graphic shadow construction, bold but controlled color flats, and cinematic visual storytelling.
The artwork must feel professionally drawn, beautifully inked, richly colored, artistically authentic, and visually compelling.
Prioritize the graphic strength of traditional comic-book illustration.
Avoid photorealistic rendering and generic superhero visual clichés.
Visual Priority Order

1. Professional American comic-book drawing.
2. Expressive organic black ink contours.
3. Sophisticated graphic shadow masses.
4. Strong original character design.
5. Professional comic-book color treatment.
6. Refined anatomy and facial expressions.
7. Dynamic but narrative-appropriate composition.
8. Detailed environmental illustration.
9. Controlled handcrafted textures.
10. Consistent character and world identities.
11. Faithful representation of the literary passage.

The American comic-book style determines the artistic execution. The literary narrative determines the characters, environments, events, and emotional atmosphere.
25. DYNAMIC SCENE INPUT — BOOKMOO
Illustrate the following literary scene using the American comic-book artistic principles established above.
SCENE DESCRIPTION:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
HISTORICAL AND CULTURAL CONTEXT:
{{world_context}}
ENVIRONMENT:
{{environment_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
LIGHTING AND TIME OF DAY:
{{lighting_context}}
COMPOSITION AND CAMERA ANGLE:
{{composition}}
IMPORTANT NARRATIVE OBJECTS:
{{narrative_objects}}
PREVIOUS CHARACTER AND WORLD REFERENCES:
{{visual_references}}
ASPECT RATIO:
{{aspect_ratio}}
FINAL GENERATION INSTRUCTION
Create one complete, original, beautifully composed professional American comic-book literary illustration.
Apply bold hand-inked contours, expressive anatomical drawing, sophisticated graphic shadows, clean color flats, selective traditional comic textures, and premium cinematic visual storytelling.
Faithfully represent the supplied literary passage.
Maintain consistent character identities, facial features, clothing, anatomy, environmental design, and narrative continuity across illustrations.
Do not automatically introduce superheroes, capes, masks, action scenes, dramatic poses, or comic-book panels unless supported by the narrative.
Do not reproduce copyrighted comic characters, recognizable franchise designs, or iconic existing compositions.
Generate a single full-frame illustration rather than a multi-panel comic page unless explicitly requested.
The final image must feel like an original premium American graphic novel illustration.
No text, no captions, no typography, no dialogue, no speech bubbles, no logos, no decorative borders, and no watermarks.$sty$ where id = 'hq-americana';
update comic_styles set prompt = $sty$14. HQ EUROPEIA — EUROPEAN LIGNE CLAIRE
Style ID: `european_comic_14`
Category: European Comic / Franco-Belgian Ligne Claire Illustration
Visual Identity: Clean, elegant, precise, colorful, handcrafted, architectural, expressive, timeless, and distinctly two-dimensional.
MASTER STYLE PROMPT
Create an extraordinary, original European comic-book literary illustration using the sophisticated artistic language of traditional Franco-Belgian bande dessinée and the classical European ligne claire (clear-line) illustration technique.
The artwork must resemble a beautifully crafted illustration from a premium European graphic novel, combining elegant hand-drawn outlines, refined flat coloring, precise architectural perspective, carefully designed characters, and sophisticated narrative composition.
Prioritize clean and confident ink contours, harmonious color blocking, beautifully structured environments, restrained shading, expressive silhouettes, and visually coherent storytelling.
The illustration should feel timeless, charming, intelligent, artistically handcrafted, and visually sophisticated.
The defining characteristic of this style is the combination of precise and consistent ink outlines, clean flat color areas, highly readable silhouettes, carefully constructed environments, and elegant visual simplicity.
The final image must remain an authentic two-dimensional comic illustration.
Avoid photorealistic rendering, digital airbrushing, exaggerated comic-book anatomy, and complex painterly shading.
1. ARTISTIC IDENTITY AND EUROPEAN COMIC TRADITION
Use sophisticated visual principles associated with classical European bande dessinée, particularly the clear-line approach to illustration.
The artwork should reflect the craftsmanship of traditional pen-and-ink drawing combined with professional flat-color application.
Primary artistic characteristics

* Elegant European comic illustration.
* Clean traditional ink contours.
* Consistent and controlled line weight.
* Beautifully simplified character construction.
* Detailed architectural backgrounds.
* Precise linear perspective.
* Sophisticated flat color blocking.
* Minimal tonal gradients.
* Strong visual readability.
* Balanced geometric composition.
* Refined environmental storytelling.
* Carefully controlled negative space.
* Delicate handmade imperfections.
* Professional printed-comic quality.

Maintain a harmonious relationship between characters, objects, and backgrounds.
The visual treatment must feel consistent across the entire illustration.
Unlike American superhero comics, avoid excessive anatomical exaggeration, dramatic inking, and heavy black shadow masses.
Unlike traditional manga, avoid extensive screentones, dense hatching, and highly stylized Japanese character conventions.
The artwork should possess its own recognizable European clear-line identity.
2. LINEWORK — THE MOST IMPORTANT CHARACTERISTIC
Linework is the fundamental visual signature of this style.
Use clean, confident, elegant ink outlines that maintain a relatively consistent thickness across the illustration.
Primary contour characteristics

* Fine-to-medium black ink lines.
* Smooth and deliberate curves.
* Controlled line thickness.
* Confident continuous contours.
* Clear separation between adjacent forms.
* Elegant geometric construction.
* Precise object silhouettes.
* Delicate hand-drawn irregularities.
* Consistent line treatment.
* Minimal unnecessary sketch lines.

Line consistency
Character outlines, architecture, clothing, furniture, and environmental elements should share a coherent visual language.
Allow subtle changes in thickness for spatial hierarchy, but avoid the highly dramatic variations associated with American comic-book inking.
Contour construction
Every major form should be clearly readable.
Use clean outlines to define:

* Character anatomy.
* Facial features.
* Clothing.
* Objects.
* Architecture.
* Furniture.
* Vehicles.
* Vegetation.
* Environmental structures.

Critical linework rule
The drawing should look carefully inked by hand, not mechanically traced by vector software.
Preserve extremely subtle human imperfections in curves and line intersections.
Avoid excessively rough strokes, overlapping exploratory sketch lines, and heavy expressive brush marks.
The visual identity must remain precise, clean, and elegant.
3. FLAT COLORING — PRIMARY COLOR TECHNIQUE
Use traditional European comic-book flat coloring.
Color should be applied as clearly defined, predominantly uniform areas enclosed by confident ink contours.
Coloring characteristics

* Clean flat-color fills.
* Precise color boundaries.
* Harmonious local colors.
* Minimal airbrushing.
* Restrained tonal variation.
* Sophisticated color separation.
* Carefully chosen shadow colors.
* Consistent color application.
* Clear visual readability.

Shadow treatment
When necessary, use one additional flat shadow color to define basic volume.
Avoid complex gradients and photorealistic shading.
Shadows should feel carefully designed rather than physically simulated.
Highlights
Use restrained flat highlight shapes.
Do not introduce excessive glossy reflections or complex digital illumination.
Color consistency
Recurring characters and objects must preserve their established local colors.
The same clothing, furniture, and architectural features should maintain consistent coloring across illustrations.
The coloring must reinforce the clarity of the ink drawing, never obscure it.
4. COLOR LANGUAGE
Use sophisticated, harmonious, slightly restrained colors inspired by traditional European illustrated publications.
Primary color families
Warm colors

* Muted terracotta.
* Burnt orange.
* Golden ochre.
* Warm mustard.
* Soft coral.
* Brick red.
* Antique cream.

Cool colors

* Dusty blue.
* Muted turquoise.
* Deep teal.
* Desaturated navy.
* Soft lavender.
* Slate blue.

Natural colors

* Olive green.
* Sage.
* Earthy brown.
* Moss green.
* Natural beige.
* Stone gray.

Strong graphic accents

* Cobalt blue.
* Crimson.
* Emerald green.
* Golden yellow.
* Deep violet.

Palette principles
Use colors that feel intentionally selected by a professional comic-book colorist.
Maintain balanced saturation.
Avoid making every element equally vibrant.
Reserve strong colors for important visual information.
Use distinct colors to differentiate characters, objects, and environmental planes.
Important rule
Do not force a retro yellow-and-red palette into every illustration.
European clear-line illustration can support contemporary, historical, futuristic, fantastical, or dramatic color environments.
The narrative determines the palette.
The artistic technique remains constant.
5. CHARACTER DESIGN
Create original characters with elegant, slightly stylized anatomy and clear graphic silhouettes.
Characters should feel expressive, distinctive, and naturally integrated into their illustrated environments.
Character characteristics

* Simplified but believable human anatomy.
* Clear body proportions.
* Elegant facial construction.
* Distinctive silhouettes.
* Natural gestures.
* Carefully designed hairstyles.
* Readable facial expressions.
* Consistent clothing.
* Confident ink outlines.
* Clean color separation.
* Strong character individuality.

Stylization
Use moderate artistic simplification.
Faces may feature simplified noses, mouths, eyes, and ears.
Preserve individual distinguishing features.
Avoid highly exaggerated cartoon anatomy.
Avoid oversized superhero bodies or excessively stylized anime faces.
Character identity
Preserve the appearance described by the book.
Do not automatically make characters resemble figures from existing European comic franchises.
Every character must have an original visual identity.
6. FACIAL EXPRESSIONS
Create expressive faces using clean, economical linework.
Facial characteristics

* Simplified but distinctive eyes.
* Elegant eyebrow construction.
* Clearly readable mouth shapes.
* Natural nose proportions.
* Consistent facial contours.
* Restrained expression lines.
* Subtle asymmetry.
* Minimal shading.

Emotional range
Support:

* Curiosity.
* Surprise.
* Happiness.
* Sadness.
* Reflection.
* Uncertainty.
* Determination.
* Suspense.
* Affection.
* Confusion.
* Wonder.
* Quiet contemplation.

Communicate emotion through small changes in facial features and body language.
Avoid exaggerated comedic expressions unless justified by the literary passage.
Expressive principle
A character should communicate emotion with relatively few carefully selected lines.
Preserve clarity over unnecessary facial detail.
7. CLOTHING AND FABRIC
Render garments through clean outlines, simplified folds, and carefully selected flat colors.
Fabric characteristics

* Precise garment silhouettes.
* Simple structural folds.
* Minimal internal linework.
* Clear fabric construction.
* Flat color areas.
* Restrained shadow shapes.
* Natural movement.
* Believable material thickness.

Clothing accuracy
Clothing must correspond to:

* Historical period.
* Geographical location.
* Cultural context.
* Character personality.
* Social circumstances.
* Occupation.
* Climate.
* Fictional setting.

Do not automatically introduce historical European costumes.
The style should work equally well for modern clothing, fantasy garments, historical outfits, and futuristic fashion.
8. ARCHITECTURE — A DEFINING CHARACTERISTIC
Architectural drawing is one of the most important visual elements of this style.
Create beautifully structured buildings and environments using accurate linear perspective and clean ink outlines.
Architectural principles

* Precise perspective.
* Believable structural proportions.
* Carefully constructed geometric forms.
* Clear architectural silhouettes.
* Elegant window and door details.
* Accurate spatial relationships.
* Coherent building materials.
* Controlled environmental complexity.
* Beautifully simplified textures.

Historical architecture
When the narrative includes historical environments, preserve the architectural characteristics of the relevant period and culture.
Contemporary architecture
Use clean structural details, believable urban infrastructure, and coherent environmental design.
Fantasy architecture
Create original fictional buildings with clear construction principles.
Science fiction architecture
Use carefully designed futuristic forms while preserving the clear-line illustration technique.
Critical rule
Do not automatically place every story in a European city.
The illustration style is European in its artistic language, not necessarily in its geographical or cultural setting.
9. ENVIRONMENTAL ILLUSTRATION
Create detailed but visually balanced environments.
Unlike the characters, backgrounds may contain many fine structural details.
Environmental characteristics

* Clean architectural linework.
* Beautifully organized spatial depth.
* Precise object silhouettes.
* Restrained environmental texture.
* Harmonious flat colors.
* Delicate vegetation.
* Carefully constructed furniture.
* Consistent physical scale.
* Clear foreground and background separation.

Natural environments
Render landscapes through:

* Organic clean-line contours.
* Simplified tree shapes.
* Controlled vegetation detail.
* Flat-color terrain.
* Carefully designed cloud silhouettes.
* Elegant water shapes.
* Simplified mountain forms.
* Natural environmental perspective.

Urban environments
Use:

* Detailed buildings.
* Precise street perspective.
* Coherent transportation infrastructure.
* Carefully designed public spaces.
* Recognizable architectural features.
* Balanced environmental detail.

All objects must follow the same illustration language.
Do not combine clear-line characters with photographic backgrounds.
10. PERSPECTIVE AND SPATIAL DESIGN
Use strong professional drawing fundamentals.
Perspective characteristics

* Accurate one-point perspective.
* Accurate two-point perspective.
* Controlled three-point perspective when necessary.
* Believable object proportions.
* Coherent architectural geometry.
* Consistent horizon placement.
* Strong spatial readability.
* Carefully organized depth.

Depth construction
Use linework, scale, overlap, and color separation to create depth.
Avoid relying on photographic depth of field.
Distant objects may use slightly lighter colors or reduced detail.
Maintain readable environmental structure throughout the composition.
11. LIGHTING AND SHADOW
Use simplified, elegant lighting appropriate to traditional clear-line illustration.
Lighting characteristics

* Clear directional light.
* Simplified shadow areas.
* Restrained color variation.
* Minimal gradients.
* Delicate atmospheric interpretation.
* Flat-color shadow shapes.
* Controlled highlights.
* Strong readability.

Natural light
Represent sunlight through carefully designed shadow shapes and harmonious color relationships.
Interior lighting
Use subtle changes in local colors and restrained shadows.
Nighttime lighting
Create darkness through deeper flat colors and controlled contrast rather than complex digital rendering.
Critical rule
Do not allow cinematic lighting effects to overpower the clean-line drawing.
Avoid excessive glow, bloom, lens flares, and photorealistic reflections.
12. COMPOSITION AND VISUAL STORYTELLING
Create elegant and highly readable compositions inspired by professional European graphic novels.
Composition principles

* Clear narrative focal points.
* Balanced character placement.
* Sophisticated negative space.
* Natural leading lines.
* Accurate spatial relationships.
* Carefully controlled perspective.
* Elegant asymmetry.
* Consistent visual rhythm.
* Strong environmental readability.
* Meaningful foreground and background elements.

Default composition
Generate one complete illustration representing a specific literary moment.
Do not automatically divide the artwork into comic panels.
Character-focused scenes
Use medium shots or close-ups that preserve facial expressiveness and natural gestures.
Environmental scenes
Use wider framing to communicate geography, architecture, and narrative context.
Action scenes
Use dynamic but readable compositions.
Maintain clean anatomical silhouettes and clear spatial relationships.
Quiet scenes
Favor visual simplicity, elegant character placement, and thoughtful environmental detail.
The composition must follow the narrative rather than forcing every scene into an adventure-comic cliché.
13. GRAPHIC NOVEL AND EDITORIAL INFLUENCE
Preserve the visual sophistication of traditional European graphic storytelling.
Editorial characteristics

* Elegant line economy.
* Clear storytelling.
* Strong illustrative consistency.
* Carefully structured compositions.
* Clean graphic organization.
* Balanced detail density.
* Timeless visual design.
* Restrained decoration.
* Harmonious color relationships.

The image should look suitable for a premium illustrated literary edition.
Avoid modern advertising aesthetics and excessive graphic effects.
The illustration must feel like a narrative artwork, not a promotional poster.
14. ACTION AND MOVEMENT
When movement is present in the source material, depict it through expressive poses and controlled visual rhythm.
Movement techniques

* Natural body mechanics.
* Clear gesture direction.
* Expressive silhouettes.
* Carefully designed clothing movement.
* Clean directional lines.
* Controlled environmental interaction.
* Readable spatial relationships.

Avoid excessive action effects.
Speed lines should be used sparingly, if at all.
Do not automatically add explosions, impact graphics, or dramatic superhero poses.
The European clear-line style should remain elegant and readable even during dynamic scenes.
15. TEXTURE AND HANDCRAFTED MATERIALITY
Preserve subtle evidence of traditional ink-and-color illustration.
Material characteristics

* Fine paper texture.
* Natural ink absorption.
* Subtle contour irregularities.
* Slight printing imperfections.
* Delicate pigment variation.
* Organic but clean edges.
* Matte color surfaces.
* Restrained handmade texture.

Texture philosophy
Texture should remain subtle.
The image must not look heavily distressed or artificially aged.
Avoid large paper stains, scratches, heavy noise, and exaggerated printing misregistration.
The default output should resemble a beautifully printed contemporary edition of a traditional European comic illustration.
16. DETAIL DISTRIBUTION
Use carefully controlled visual hierarchy.
Primary characters
Clean contours, expressive faces, recognizable silhouettes, and simplified internal details.
Secondary characters
Moderate detail, consistent linework, and clear color separation.
Foreground environments
Precise object construction and carefully selected detail.
Background environments
Fine architectural lines, simplified textures, and controlled color contrast.
Important principle
European clear-line illustration can feature detailed environments without becoming visually chaotic.
The drawing must remain readable at both small and large display sizes.
17. EMOTIONAL AND GENRE FLEXIBILITY
This style must work across many literary genres.
Adventure
Use strong environmental storytelling, clear character silhouettes, and detailed geographical settings.
Mystery
Use meaningful object placement, thoughtful framing, and restrained atmospheric color.
Historical fiction
Preserve historically appropriate architecture, clothing, and cultural details.
Romance
Emphasize subtle expressions, natural gestures, and elegant interpersonal composition.
Fantasy
Create original imaginary environments with precise structural drawing and harmonious flat colors.
Science fiction
Use coherent futuristic architecture and technology without changing the artistic technique.
Children's literature
Use approachable character expressions, clear forms, and gentle compositions.
Drama
Use restrained gestures, sophisticated framing, and expressive visual economy.
The style must support every emotional atmosphere without automatically making the scene humorous or adventurous.
18. COMIC PANEL RULES
By default, generate a single complete full-frame illustration.
Do not automatically create:

* Multiple comic panels.
* Speech bubbles.
* Captions.
* Dialogue boxes.
* Page numbers.
* Decorative frames.
* Narrative text.

Optional sequential mode
When the Bookmoo explicitly requests a comic-page layout, adapt the same artistic style to multiple panels.
Maintain coherent perspective, character continuity, clear panel separation, and consistent reading order.
The comic-page structure must be controlled by a separate layout instruction.
Do not let panel layout modify the underlying clear-line illustration technique.
19. CHARACTER AND WORLD CONSISTENCY
When generating multiple illustrations from the same book, preserve strict visual consistency.
Character consistency

* Facial structure.
* Eye shapes.
* Hairstyles.
* Hair colors.
* Body proportions.
* Age.
* Clothing.
* Accessories.
* Distinctive features.
* Silhouette design.

Environment consistency

* Architecture.
* Historical period.
* Recurring locations.
* Important objects.
* Furniture.
* Vehicles.
* Geographical characteristics.
* Cultural details.

Artistic consistency

* Ink line thickness.
* Contour smoothness.
* Flat-color application.
* Shadow construction.
* Color saturation.
* Character stylization.
* Architectural detail.
* Material treatment.
* Overall illustration quality.

Recurring characters must remain recognizable across all scenes.
Recurring locations must preserve their established structural appearance.
Use previous character and environment illustrations as visual references whenever available.
20. ORIGINALITY AND COPYRIGHT
Create entirely original character designs, environments, costumes, vehicles, and visual compositions.
Do not reproduce recognizable characters from existing Franco-Belgian comics.
Do not imitate iconic hairstyles, costumes, recurring companions, signature vehicles, distinctive fictional locations, or recognizable compositions from published comic series.
Do not copy the distinctive artistic identity of a particular contemporary illustrator.
Use broad European clear-line illustration principles and traditional drawing techniques.
For public-domain literary works, create original character interpretations based on the source text rather than reproducing modern adaptations.
All artwork must be suitable for a commercial literary illustration application.
21. STRICT NEGATIVE PROMPT
Avoid:

* Photography.
* Photorealism.
* Hyperrealism.
* CGI.
* 3D rendering.
* Unreal Engine aesthetics.
* Video-game screenshots.
* Glossy digital painting.
* Heavy airbrushing.
* Painterly oil textures.
* Watercolor bleeding.
* Excessively rough sketch lines.
* Heavy expressive brush inking.
* Thick American superhero comic outlines.
* Excessive anatomical exaggeration.
* Japanese manga screentones.
* Generic anime character design.
* Excessive crosshatching.
* Heavy black shadow masses.
* Photorealistic shading.
* Complex digital gradients.
* Excessive cinematic bloom.
* Lens flares.
* Oversaturated colors.
* Artificial 3D depth.
* Plastic-looking characters.
* Heavy paper distress.
* Inconsistent line thickness.
* Generic vector clip art.
* Excessive environmental clutter.
* Unnecessary action scenes.
* Mandatory European architecture.
* Generic cartoon faces.
* Copyrighted comic characters.
* Recognizable franchise designs.
* Iconic existing comic compositions.
* Logos.
* Text.
* Typography.
* Captions.
* Dialogue.
* Speech bubbles.
* Watermarks.
* Decorative page borders.

22. FINAL ART DIRECTION
Create an extraordinary, original European clear-line comic illustration combining elegant traditional ink contours, precise architectural drawing, sophisticated flat coloring, expressive character design, and refined literary storytelling.
The artwork must feel handcrafted, clean, timeless, colorful, intelligent, and beautifully structured.
Preserve the clarity of every major form.
Use controlled line weights, careful perspective, harmonious colors, restrained shading, and elegant environmental detail.
Visual Priority Order

1. Authentic European ligne claire illustration.
2. Clean and consistent hand-inked contours.
3. Sophisticated flat-color rendering.
4. Precise architecture and perspective.
5. Original expressive character design.
6. Clear visual storytelling.
7. Elegant compositional balance.
8. Restrained graphic shading.
9. Subtle handcrafted texture.
10. Consistent character and environment design.
11. Faithful representation of the literary passage.

The European clear-line style defines how the image is illustrated. The literary narrative determines the characters, environments, historical context, events, and emotions.
23. DYNAMIC SCENE INPUT — BOOKMOO
Illustrate the following literary scene using the European clear-line artistic principles established above.
SCENE DESCRIPTION:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
HISTORICAL AND CULTURAL CONTEXT:
{{world_context}}
ENVIRONMENT:
{{environment_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
LIGHTING AND TIME OF DAY:
{{lighting_context}}
COMPOSITION AND CAMERA ANGLE:
{{composition}}
IMPORTANT NARRATIVE OBJECTS:
{{narrative_objects}}
PREVIOUS CHARACTER AND WORLD REFERENCES:
{{visual_references}}
ASPECT RATIO:
{{aspect_ratio}}
FINAL GENERATION INSTRUCTION
Create one complete, original, beautifully composed European ligne claire literary illustration.
Apply elegant clean ink contours, consistent line weights, sophisticated flat colors, precise architectural perspective, original expressive character designs, and refined European graphic storytelling.
Faithfully represent the supplied literary passage.
Maintain consistent character identities, facial features, clothing, architectural details, and environmental continuity across illustrations.
Do not automatically introduce European cities, detectives, adventure tropes, historical costumes, or unrelated narrative elements.
Do not reproduce recognizable copyrighted comic characters, franchise designs, or famous visual compositions.
Generate a single full-frame illustration rather than a multi-panel comic page unless explicitly requested.
The final result must resemble a premium handcrafted Franco-Belgian clear-line graphic novel illustration.
No text, no captions, no typography, no dialogue, no speech bubbles, no logos, no decorative borders, and no watermarks.$sty$ where id = 'hq-europeia';
update comic_styles set prompt = $sty$15. INFANTIL EM GUACHE — CHILDREN'S GOUACHE
Style ID: `childrens_gouache_15`
Category: Children's Gouache / Hand-Painted Storybook Illustration
Visual Identity: Playful, handcrafted, textured, colorful, charming, expressive, organic, painterly, imaginative, and timeless.
MASTER STYLE PROMPT
Create an extraordinary, original children's storybook illustration combining traditional opaque gouache painting, expressive hand-drawn shapes, organic brush textures, sophisticated color harmony, and beautifully crafted literary visual storytelling.
The artwork must resemble a premium hand-painted illustration from a beautifully produced children's picture book, created by an accomplished traditional illustrator using physical gouache pigments, natural brushes, colored pencils, and textured watercolor paper.
Prioritize charming original character designs, expressive silhouettes, visible handmade brushwork, layered matte pigments, organic imperfections, thoughtful composition, and emotionally engaging visual storytelling.
The illustration should feel warm, imaginative, artistic, inviting, visually delightful, and unmistakably handcrafted.
The defining characteristic of this style is the combination of rich matte gouache painting, visible organic brushstrokes, playful simplified shapes, expressive character design, and sophisticated traditional-paper textures.
The final result must retain the tactile imperfections of traditional illustration rather than appearing as a smooth digital painting, vector artwork, or 3D animated image.
1. ARTISTIC IDENTITY AND TRADITIONAL GOUACHE TECHNIQUE
Use professional traditional gouache painting principles combined with sophisticated picture-book illustration, expressive shape design, and delicate hand-drawn details.
The image should look as though an experienced illustrator personally painted each element on textured paper.
Primary artistic characteristics

* Authentic traditional gouache painting.
* Rich opaque matte pigments.
* Visible handcrafted brush strokes.
* Organic color variation.
* Beautifully simplified character shapes.
* Expressive original silhouettes.
* Delicate pencil and ink accents.
* Subtle paper texture.
* Carefully controlled color relationships.
* Slightly imperfect painted boundaries.
* Warm artistic personality.
* Elegant picture-book composition.
* Layered painted surfaces.
* Gentle atmospheric depth.
* Sophisticated visual storytelling.

The artwork must feel genuinely handmade.
Avoid excessive digital precision.
Preserve natural brush variations, imperfect edges, and visible pigment layering.
2. GOUACHE PAINTING — PRIMARY VISUAL SIGNATURE
Gouache painting is the most important artistic component.
Unlike watercolor, which relies primarily on transparent washes, this style must emphasize matte, opaque pigment application with visible brush texture and carefully layered painted shapes.
Gouache characteristics

* Rich matte color surfaces.
* Opaque paint application.
* Naturally imperfect brush edges.
* Subtle pigment accumulation.
* Delicate dry-brush textures.
* Layered color blocks.
* Organic paint coverage.
* Slight variations in opacity.
* Visible brush direction.
* Softly overlapping painted areas.
* Occasional paper visibility.
* Controlled color blending.

Layered pigment construction
Create the impression of multiple traditional painting layers.
Use broad painted shapes to establish primary forms.
Add smaller strokes to define details, texture, shadows, and highlights.
Allow subtle evidence of underlying paint layers to remain visible.
Handmade imperfection
Painted shapes must not appear mathematically precise.
Edges may contain gentle irregularities, slight pigment variation, or small uncovered paper areas.
These details should reinforce the appearance of physical painting.
Avoid perfectly smooth color fills, synthetic gradients, and sterile digital brushwork.
3. BRUSHWORK AND ARTISTIC TEXTURE
Brushwork should be visibly expressive and contribute directly to the illustration's visual personality.
Brush characteristics

* Broad organic brush strokes.
* Small rounded paint marks.
* Expressive directional strokes.
* Irregular painted edges.
* Gentle dry-brush effects.
* Soft textured shading.
* Subtle pigment streaks.
* Natural brush-pressure variation.
* Delicate handcrafted details.
* Intentional imperfections.

Brush direction
Use strokes that follow the natural shape and movement of illustrated objects.
Examples:

* Curved strokes following rounded forms.
* Directional strokes following fabric folds.
* Organic strokes representing leaves and vegetation.
* Soft broad strokes establishing skies and landscapes.
* Short expressive strokes defining fur or other textures.

The illustration must never look like it was assembled from perfect digital geometric shapes.
Texture philosophy
Every major painted surface should retain subtle evidence of handmade application.
Do not apply heavy artificial texture uniformly across the image.
Texture should emerge from the painting process.
4. LINEWORK AND HAND-DRAWN CONTOURS
Use subtle, expressive handmade linework to support the gouache painting.
Unlike traditional pen-and-ink illustration, this style should not depend on strong black outlines around every object.
Primary contour characteristics

* Soft pencil-like outlines.
* Delicate colored-pencil strokes.
* Occasional fine ink accents.
* Organic contour irregularities.
* Slightly imperfect curves.
* Expressive hand-drawn details.
* Selective broken lines.
* Natural variations in thickness.

Color-based contours
Prefer darker variations of the object's local color when defining edges.
For example, a warm brown object may use deep umber outlines rather than pure black.
Contour flexibility
Some shapes may be defined entirely through the contrast between adjacent painted colors.
Other elements may use delicate pencil or ink details.
Maintain a natural balance between painted forms and drawing.
Do not surround every character and object with thick black outlines.
Preserve the soft, handcrafted appearance of gouache illustration.
5. SHAPE LANGUAGE AND VISUAL SIMPLIFICATION
Use charming, expressive, organically simplified shapes.
Shape design is fundamental to the artistic identity.
Primary shape characteristics

* Soft rounded forms.
* Gentle asymmetry.
* Expressive silhouettes.
* Simplified anatomy.
* Organic irregularity.
* Clear visual hierarchy.
* Natural gesture.
* Distinctive proportions.
* Carefully designed negative space.

Shape construction
Avoid excessive geometric precision.
A hand-painted tree may have a slightly irregular canopy.
A building may feature small handmade variations in windows or roof contours.
A character's clothing may contain expressive shape exaggerations.
These choices should create artistic personality without compromising readability.
Important principle
Simplification does not mean every character must look like a baby, toy, or excessively cute cartoon.
The style must accommodate different ages, personalities, historical periods, and narrative genres.
Maintain character individuality.
6. COLOR LANGUAGE
Use rich, harmonious, beautifully selected colors with a sophisticated handmade painting quality.
Warm color families

* Golden ochre.
* Burnt orange.
* Warm terracotta.
* Muted coral.
* Soft peach.
* Mustard yellow.
* Warm cream.
* Earthy red.

Cool color families

* Dusty blue.
* Muted turquoise.
* Soft teal.
* Lavender.
* Slate blue.
* Pale mint.
* Desaturated indigo.

Natural colors

* Sage green.
* Olive.
* Moss green.
* Earthy brown.
* Warm beige.
* Soft gray.
* Natural ivory.

Expressive accent colors

* Warm crimson.
* Rich cobalt.
* Golden yellow.
* Deep turquoise.
* Muted violet.
* Soft emerald.

Color principles
Use carefully controlled saturation.
Create harmonious combinations of warm and cool colors.
Preserve color separation between important characters and environments.
Allow selected focal elements to use richer colors.
Avoid excessive saturation throughout the entire composition.
Critical rule
Do not automatically make every children's illustration pastel, rainbow-colored, or excessively cheerful.
The color palette must reflect the literary scene.
A mysterious forest may use deep greens and muted blues.
A peaceful afternoon may use warm earthy tones.
A winter scene may use delicate cool colors.
A dramatic moment may use restrained darker values.
Preserve the gouache technique while allowing the narrative to determine the palette.
7. CHARACTER DESIGN
Create original, expressive literary characters with simplified but believable anatomy, charming visual personalities, and distinctive silhouettes.
Characters must feel handcrafted rather than digitally manufactured.
Character characteristics

* Clear expressive silhouettes.
* Organic body proportions.
* Natural but simplified anatomy.
* Distinctive facial features.
* Delicate emotional expressions.
* Soft painted volume.
* Natural gestures.
* Carefully designed clothing.
* Character-specific hairstyles.
* Sophisticated color blocking.
* Gentle asymmetry.
* Consistent visual identities.

Proportion principles
Use moderate artistic stylization.
A character's head, hands, or body shapes may be simplified for visual clarity.
However, do not exaggerate anatomy unnecessarily.
Preserve the character's age and distinguishing features.
Character individuality
Different characters must have visually distinct:

* Faces.
* Hairstyles.
* Body proportions.
* Clothing.
* Silhouettes.
* Gestures.
* Expressions.

Avoid generic repeated character templates.
Critical rule
The illustration technique must not change the identity of the literary characters.
Preserve descriptions supplied by the book.
8. FACIAL EXPRESSIONS AND EMOTIONAL STORYTELLING
Facial expressions should be simple, readable, and emotionally meaningful.
Use subtle hand-painted details to communicate character emotions.
Eyes

* Clear expressive shapes.
* Natural gaze direction.
* Character-specific proportions.
* Delicate highlights.
* Minimal unnecessary detail.

Eyebrows
Use simple organic strokes to communicate emotional variation.
Mouth
Use expressive but restrained shapes.
Facial structure
Preserve consistent relationships between the eyes, nose, mouth, ears, and overall face silhouette.
Emotional range
Support:

* Curiosity.
* Wonder.
* Joy.
* Uncertainty.
* Sadness.
* Courage.
* Surprise.
* Reflection.
* Friendship.
* Discovery.
* Affection.
* Melancholy.
* Quiet contemplation.

Avoid exaggerated comedic expressions in serious scenes.
The emotional treatment must correspond to the literary passage.
9. ANIMAL AND CREATURE ILLUSTRATION
When the narrative contains animals or imaginary creatures, render them using original, expressive gouache character design.
Animal illustration characteristics

* Clearly recognizable anatomy.
* Organic simplified silhouettes.
* Expressive poses.
* Natural movement.
* Beautiful painterly fur or feather textures.
* Delicate facial features.
* Character-specific personality.
* Matte painted color masses.
* Subtle hand-drawn details.

Creature design
Fantasy creatures should follow the fictional world's established descriptions.
Create original silhouettes and distinctive visual identities.
Avoid generic mascot designs.
Important rule
Do not automatically add animals, magical creatures, birds, butterflies, or imaginary companions to scenes that do not contain them.
The illustration must remain faithful to the narrative.
10. CLOTHING AND FABRIC
Render clothing using simplified shapes, visible gouache brushwork, and restrained painted detail.
Fabric characteristics

* Organic painted folds.
* Soft matte pigment.
* Natural color variation.
* Carefully designed silhouettes.
* Delicate brush texture.
* Subtle shadow masses.
* Simple material details.
* Believable garment construction.

Clothing accuracy
Costumes must correspond to:

* Historical period.
* Geographical setting.
* Cultural context.
* Character personality.
* Climate.
* Social environment.
* Fictional world.

Do not automatically introduce colorful scarves, oversized sweaters, patterned dresses, or whimsical costumes.
Clothing must reflect the source material.
11. ENVIRONMENTAL ILLUSTRATION
Create beautifully painted environments with organic gouache textures and sophisticated picture-book composition.
Environment characteristics

* Hand-painted natural shapes.
* Expressive vegetation.
* Softly simplified architecture.
* Organic color variation.
* Matte pigment layers.
* Delicate surface details.
* Subtle atmospheric perspective.
* Carefully controlled environmental complexity.
* Warm artistic materiality.

Natural landscapes
Render trees, mountains, rivers, fields, beaches, and natural environments using expressive painted shapes.
Vegetation should contain subtle variations in form and color.
Avoid repeating identical trees, flowers, or decorative objects.
Architectural environments
Buildings should preserve believable perspective while allowing slight handmade irregularities.
Use simple architectural forms and carefully selected details.
Interior environments
Create cozy or atmospheric interiors when supported by the narrative.
Use painted furniture, subtle material textures, and soft lighting.
Critical rule
Do not automatically create cottages, forests, gardens, or idyllic countryside environments.
The style must work equally well with contemporary cities, historical interiors, fantasy worlds, and ordinary domestic scenes.
12. LIGHTING AND SHADOW
Use soft, simplified, painterly lighting appropriate to traditional gouache illustration.
Lighting characteristics

* Gentle natural illumination.
* Soft directional light.
* Simplified shadow masses.
* Warm and cool color relationships.
* Subtle painted highlights.
* Matte surface reflections.
* Restrained atmospheric effects.
* Elegant tonal variation.

Shadow construction
Use carefully selected darker painted shapes rather than complex realistic gradients.
Shadows should reinforce the structure of characters and objects.
Avoid harsh photorealistic shading.
Lighting adaptation
Daylight scenes may use bright, harmonious colors.
Nighttime scenes may use deeper painted values and controlled warm highlights.
Interior scenes should reflect the described light sources.
Do not automatically make every illustration sunny or golden.
13. COMPOSITION AND PICTURE-BOOK STORYTELLING
Create refined compositions inspired by professional illustrated literature.
Composition principles

* Clear narrative focal points.
* Strong character silhouettes.
* Harmonious negative space.
* Natural visual rhythm.
* Balanced asymmetry.
* Elegant subject placement.
* Carefully simplified environments.
* Controlled detail distribution.
* Meaningful character gestures.
* Beautiful color relationships.

Character-focused scenes
Emphasize personality, expressions, gestures, and emotional interactions.
Environmental scenes
Use thoughtful framing to establish setting and narrative atmosphere.
Quiet scenes
Preserve visual simplicity and negative space.
Dynamic scenes
Use expressive poses, natural movement, and clear visual storytelling.
Important rule
The image must resemble a complete illustration from a premium storybook, not a generic children's poster.
Avoid excessive decorative elements.
14. TRADITIONAL PAPER TEXTURE
Preserve the tactile qualities of gouache painted on natural paper.
Texture characteristics

* Fine watercolor-paper grain.
* Subtle pigment absorption.
* Natural brush marks.
* Slightly uneven painted surfaces.
* Organic paper interaction.
* Delicate dry-brush areas.
* Soft pigment layering.
* Occasional visible paper fibers.
* Restrained handmade imperfections.

Texture should remain naturally integrated into the illustration.
Avoid large artificial paper stains, heavy noise, scratched surfaces, and exaggerated aging.
The artwork should feel like a beautifully preserved original painting.
15. PAINTERLY DEPTH AND BACKGROUND TREATMENT
Create visual depth through color, overlap, scale, and painterly atmospheric variation.
Foreground
Use stronger shape definition, richer textures, and clear visual details.
Midground
Maintain balanced colors, simplified structural forms, and readable narrative subjects.
Background
Use softer painted shapes, reduced contrast, delicate color variations, and selective environmental detail.
Depth philosophy
Avoid photographic depth-of-field blur.
The image should remain consistently illustrated.
Use artistic simplification rather than simulated camera effects.
16. EXPRESSIVE IMPERFECTION
Preserve the visible personality of handmade illustration.
Intentional imperfections

* Slightly uneven painted shapes.
* Irregular brush boundaries.
* Subtle color misregistration.
* Gentle asymmetry.
* Visible paint layering.
* Small dry-brush details.
* Organic contour variations.
* Unfinished-looking minor marks.
* Natural differences in pigment coverage.

These imperfections should feel controlled and intentional.
Critical principle
Handmade imperfection must enhance artistic beauty rather than make the illustration appear unfinished or poorly executed.
Avoid random roughness or excessive texture.
The illustration should feel professionally crafted.
17. EMOTIONAL AND NARRATIVE FLEXIBILITY
The gouache storybook style must support a wide variety of literary genres.
Fables
Use expressive animal or human characters, meaningful gestures, and simplified storytelling.
Fairy tales
Create imaginative environments and original characters while preserving the handcrafted painting style.
Adventure
Use dynamic compositions, expressive gestures, and visually engaging environments.
Contemporary children's literature
Use believable everyday settings and approachable character designs.
Historical stories
Maintain appropriate clothing, architecture, and cultural context.
Fantasy
Use original fantastical objects and environments only when supported by the narrative.
Emotional stories
Prioritize subtle expressions, natural gestures, and delicate painterly atmosphere.
Mystery
Use controlled lighting, thoughtful framing, and restrained environmental detail.
Critical rule
The gouache illustration style must not force every literary scene to feel cheerful, magical, or excessively cute.
The narrative determines the emotional atmosphere.
18. VISUAL DETAIL DISTRIBUTION
Use carefully controlled detail hierarchy.
Primary characters
Refined expressions, clear silhouettes, visible brush texture, and carefully selected details.
Secondary characters
Moderate detail, simplified painted shapes, and harmonious color treatment.
Foreground elements
Richer pigment texture and stronger visual definition.
Background elements
Simplified shapes, softer transitions, and reduced detail.
Visual balance
Avoid filling every area with decoration.
Allow quiet painted surfaces and negative space to strengthen the composition.
19. CHARACTER AND WORLD CONSISTENCY
When generating multiple illustrations from the same book, maintain consistent:
Character identity

* Facial structure.
* Hairstyles.
* Hair colors.
* Body proportions.
* Age.
* Skin tones.
* Distinctive physical features.
* Clothing.
* Accessories.
* Silhouette design.

Environment identity

* Architecture.
* Recurring locations.
* Natural landscapes.
* Historical details.
* Furniture.
* Important objects.
* Cultural context.
* Fictional world rules.

Artistic identity

* Gouache brushwork.
* Matte pigment treatment.
* Character stylization.
* Color harmony.
* Paper texture.
* Shadow construction.
* Linework characteristics.
* Degree of visual simplification.
* Overall illustration quality.

Recurring characters must remain recognizable.
Use established character reference images when available.
Do not arbitrarily modify character appearances or environments.
20. ORIGINALITY AND COPYRIGHT
Create original characters, animals, environments, costumes, and visual compositions.
Do not reproduce recognizable copyrighted children's-book characters, modern illustrated mascots, distinctive franchise designs, or famous picture-book compositions.
Do not imitate the distinctive visual identity of a specific contemporary children's-book illustrator.
Use general traditional gouache techniques, professional picture-book illustration principles, and original artistic interpretation.
For public-domain literary characters, create new visual interpretations based on their written descriptions rather than reproducing the character designs of modern adaptations.
The resulting illustrations must be suitable for a commercial literary application.
21. STRICT NEGATIVE PROMPT
Avoid:

* Photorealism.
* Photography.
* CGI.
* 3D rendering.
* Plastic-looking characters.
* Glossy digital painting.
* Unreal Engine aesthetics.
* Video-game screenshots.
* Flat corporate vector illustrations.
* Perfect geometric shapes.
* Uniform digital contours.
* Excessive airbrushing.
* Synthetic gradients.
* Hyperrealistic material textures.
* Heavy black comic-book outlines.
* Traditional manga screentones.
* Anime cel shading.
* Excessively detailed oil painting.
* Transparent watercolor-only treatment.
* Artificial watercolor filters.
* Excessive pastel colors.
* Mandatory rainbow palettes.
* Generic cute mascots.
* Exaggerated baby-like proportions.
* Unnecessary animals.
* Random flowers and butterflies.
* Mandatory magical environments.
* Unrelated decorative elements.
* Generic countryside cottages.
* Excessive environmental detail.
* Artificial depth-of-field blur.
* Excessive film grain.
* Heavy paper stains.
* Repetitive character faces.
* Inconsistent character identities.
* Recognizable copyrighted characters.
* Famous children's-book compositions.
* Logos.
* Text.
* Typography.
* Captions.
* Dialogue.
* Speech bubbles.
* Watermarks.
* Decorative page borders.

22. FINAL ART DIRECTION
Generate an extraordinary, original children's gouache literary illustration combining traditional opaque painting, expressive organic shapes, beautifully simplified characters, visible handcrafted brushwork, sophisticated color harmony, and elegant storybook visual storytelling.
The illustration must feel playful when appropriate, artistically authentic, emotionally expressive, richly textured, and unmistakably handmade.
Preserve matte pigment surfaces, irregular brush boundaries, natural paper grain, organic color variation, and carefully designed visual simplicity.
Avoid generic cartoon styling.
Visual Priority Order

1. Authentic traditional opaque gouache painting.
2. Visible organic handcrafted brushwork.
3. Beautifully simplified original character design.
4. Sophisticated matte color treatment.
5. Expressive and emotionally readable characters.
6. Organic shapes and intentional imperfections.
7. Elegant picture-book composition.
8. Subtle traditional-paper texture.
9. Narrative-appropriate lighting and environments.
10. Consistent character and world identity.
11. Faithful representation of the literary passage.

The gouache style determines how the image is painted. The source narrative determines the characters, objects, locations, and emotional atmosphere.
23. DYNAMIC SCENE INPUT — BOOKMOO
Illustrate the following literary scene using the traditional children's gouache artistic principles established above.
SCENE DESCRIPTION:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
HISTORICAL AND CULTURAL CONTEXT:
{{world_context}}
ENVIRONMENT:
{{environment_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
LIGHTING AND TIME OF DAY:
{{lighting_context}}
COMPOSITION AND CAMERA ANGLE:
{{composition}}
IMPORTANT NARRATIVE OBJECTS:
{{narrative_objects}}
PREVIOUS CHARACTER AND WORLD REFERENCES:
{{visual_references}}
ASPECT RATIO:
{{aspect_ratio}}
FINAL GENERATION INSTRUCTION
Create one complete, original, beautifully composed traditional children's gouache literary illustration.
Apply rich opaque matte gouache pigments, expressive visible brushstrokes, organic simplified character shapes, sophisticated handcrafted textures, natural paper grain, elegant color harmony, and emotionally compelling picture-book storytelling.
Faithfully represent the supplied literary passage.
Preserve established character identities, facial features, clothing, historical context, environmental design, and narrative continuity across illustrations.
Do not automatically introduce animals, fantasy creatures, colorful flowers, magical environments, or unrelated decorative elements.
Do not reproduce copyrighted children's-book characters, recognizable franchise designs, or famous picture-book compositions.
Generate a single complete full-frame illustration, not a comic page or multi-panel layout.
The final result must resemble a premium original hand-painted picture-book illustration rather than digital vector art or CGI.
No text, no captions, no typography, no dialogue, no speech bubbles, no logos, no decorative borders, and no watermarks.$sty$ where id = 'infantil-guache';
update comic_styles set prompt = $sty$16. REALISMO MÁGICO — MAGICAL REALISM
Style ID: `magical_realism_16`
Category: Magical Realism / Poetic Surrealist Illustration
Visual Identity: Poetic, dreamlike, painterly, surreal, atmospheric, sophisticated, symbolic, handcrafted, emotionally evocative, and timeless.
MASTER STYLE PROMPT
Create an extraordinary, original magical realism literary illustration combining sophisticated traditional oil painting, poetic surrealist art, expressive painterly textures, atmospheric environmental illustration, and emotionally compelling visual storytelling.
The artwork must resemble a masterfully hand-painted illustration from a premium literary novel, where ordinary reality and extraordinary elements coexist naturally within a visually coherent world.
Prioritize beautiful painterly craftsmanship, subtle surrealist symbolism, original character design, poetic composition, sophisticated lighting, atmospheric depth, and a harmonious relationship between realistic environments and extraordinary visual phenomena.
The illustration should feel dreamlike yet believable, mysterious yet intimate, visually poetic, emotionally sophisticated, and unmistakably handcrafted.
The defining characteristic of this style is the seamless coexistence of recognizable everyday reality and extraordinary narrative elements, represented through sophisticated painterly illustration, subtle surrealist composition, and poetic atmospheric storytelling.
The image must remain an original artistic interpretation, never resembling a photograph, CGI render, or generic fantasy illustration.
1. ARTISTIC IDENTITY AND PAINTING TECHNIQUE
Use sophisticated traditional painting principles influenced by classical oil painting, poetic surrealist illustration, contemporary fine-art storytelling, and atmospheric literary painting.
The image should feel carefully created by an accomplished traditional artist.
Primary artistic characteristics

* Rich traditional oil-painting-inspired brushwork.
* Sophisticated painterly realism.
* Subtle surrealist visual construction.
* Poetic atmospheric composition.
* Organic handcrafted textures.
* Naturalistic human anatomy.
* Expressive character gestures.
* Elegant environmental painting.
* Harmonious color relationships.
* Sophisticated light and shadow.
* Carefully controlled visual symbolism.
* Painterly spatial depth.
* Delicate visual imperfections.
* Refined literary storytelling.

Maintain an elegant balance between recognizable reality and artistic abstraction.
Preserve visible painting techniques throughout the illustration.
Avoid excessive digital smoothness.
The artwork should feel imaginative without losing its emotional connection to ordinary human experience.
2. PAINTERLY BRUSHWORK AND MATERIALITY
Brushwork is fundamental to the artistic identity.
Use layered, expressive paint application with subtle variations in texture, color, and opacity.
Brush characteristics

* Broad painterly strokes for environmental masses.
* Refined strokes for faces and hands.
* Expressive directional brushwork.
* Subtle dry-brush textures.
* Natural paint layering.
* Organic contour variation.
* Carefully controlled edge softness.
* Delicate pigment transitions.
* Subtle impasto-inspired highlights.
* Visible handcrafted imperfections.

Painterly edge treatment
Allow selected contours to dissolve into atmospheric color.
Use sharper edges near important narrative subjects.
Let secondary elements remain loosely painted.
The distinction between reality and extraordinary phenomena may occasionally be expressed through changes in edge definition, color, or atmospheric treatment.
Important principle
Every surreal or magical element must appear painted using the same artistic language as the ordinary environment.
Do not create a realistic background with digitally inserted fantasy objects.
The entire image must feel like one cohesive handcrafted painting.
3. COLOR LANGUAGE
Use sophisticated, poetic, emotionally expressive color palettes.
Earth-inspired tones

* Warm ochre.
* Burnt sienna.
* Terracotta.
* Raw umber.
* Olive green.
* Natural beige.
* Soft ivory.
* Muted gold.

Atmospheric cool tones

* Dusty blue.
* Misty lavender.
* Desaturated indigo.
* Soft turquoise.
* Slate gray.
* Muted teal.
* Pale silver-blue.

Expressive accents

* Deep burgundy.
* Antique gold.
* Warm coral.
* Muted emerald.
* Soft crimson.
* Gentle amber.
* Atmospheric violet.

Color principles
Use harmonious warm and cool relationships.
Maintain subtle pigment variation.
Allow colors to express emotion, memory, atmosphere, and narrative meaning.
Reserve richer saturation for meaningful focal points.
Important rule
Do not automatically make every magical realism illustration pastel, golden, or dreamily colorful.
A melancholic passage may require muted colors.
A mysterious passage may use deep blues or restrained dark values.
A joyful scene may contain vibrant natural colors.
The literary narrative determines the palette.
4. THE RELATIONSHIP BETWEEN REALITY AND THE EXTRAORDINARY
This is the most important conceptual characteristic of magical realism.
Represent extraordinary events with the same visual seriousness and naturalness as ordinary events.
Core principles

* Ground the scene in recognizable reality.
* Preserve coherent physical environments.
* Maintain believable human behavior.
* Integrate extraordinary narrative elements naturally.
* Avoid exaggerated fantasy effects.
* Use subtle visual symbolism when appropriate.
* Preserve the emotional truth of the scene.
* Maintain spatial and compositional coherence.

Extraordinary elements
When explicitly supported by the narrative, extraordinary phenomena may appear within otherwise ordinary environments.
These elements should feel naturally integrated rather than artificially spectacular.
Visual treatment
The extraordinary should not necessarily glow, emit particles, or create dramatic visual effects.
A surreal occurrence may be depicted quietly, through an unusual spatial relationship, unexpected transformation, or narratively meaningful impossibility.
Treat the impossible as an ordinary part of the illustrated world's reality.
Critical restriction
Do not invent magical events, surreal transformations, floating objects, supernatural characters, or impossible environments that are absent from the literary source.
The style should remain visually poetic even when illustrating completely ordinary scenes.
5. SURREALIST COMPOSITION
Use sophisticated surrealist visual principles selectively.
Potential techniques

* Unexpected spatial relationships.
* Poetic scale contrasts.
* Subtle perspective ambiguity.
* Symbolically meaningful object placement.
* Dreamlike environmental transitions.
* Carefully controlled visual repetition.
* Unusual but coherent compositions.
* Elegant negative space.
* Atmospheric visual metaphors.

These techniques should be applied only when appropriate to the narrative.
Composition philosophy
Surrealism should emerge from the relationship between objects, characters, and environments.
Avoid filling the image with unrelated symbolic objects merely to make it feel artistic.
Every significant visual element must have narrative justification.
Important principle
Poetic composition does not require visual impossibility.
An ordinary conversation, landscape, or domestic moment may feel poetic through lighting, color, gestures, and visual balance.
6. CHARACTER DESIGN
Create original literary characters with believable anatomy, distinctive facial features, expressive gestures, and natural emotional presence.
Character characteristics

* Natural human anatomy.
* Believable proportions.
* Individual facial features.
* Expressive eyes.
* Subtle emotional expressions.
* Natural body language.
* Sophisticated painterly skin rendering.
* Carefully designed clothing.
* Strong silhouettes.
* Consistent physical identities.
* Delicate artistic simplification.

Character rendering
Use refined painterly techniques rather than photographic detail.
Faces should have natural asymmetry.
Preserve believable skin tones and individual characteristics.
Avoid generic idealized facial features.
Character identity
Characters must reflect the literary source.
Do not alter age, appearance, ethnicity, clothing, or distinguishing characteristics merely to create a surreal aesthetic.
The artistic treatment must preserve the character's identity.
7. FACIAL EXPRESSIONS AND HUMAN EMOTION
Use nuanced emotional expression as a primary storytelling tool.
Facial characteristics

* Natural eye direction.
* Subtle eyebrow movement.
* Carefully painted mouth expressions.
* Delicate facial tension.
* Believable skin volume.
* Expressive posture.
* Meaningful hand gestures.

Emotional range
Support:

* Wonder.
* Nostalgia.
* Melancholy.
* Curiosity.
* Love.
* Uncertainty.
* Hope.
* Solitude.
* Joy.
* Reflection.
* Discovery.
* Mystery.
* Emotional ambiguity.
* Quiet contemplation.

Avoid exaggerated theatrical expressions unless the passage explicitly requires them.
Emotional philosophy
Characters may respond calmly to extraordinary events if that is consistent with the narrative.
Do not automatically portray every magical occurrence as shocking or frightening.
Magical realism often allows extraordinary phenomena to coexist with ordinary human emotion.
8. CLOTHING AND FABRIC RENDERING
Render clothing with sophisticated painterly craftsmanship.
Fabric characteristics

* Natural folds.
* Expressive brushwork.
* Believable fabric thickness.
* Subtle pigment variation.
* Carefully controlled highlights.
* Elegant shadow transitions.
* Organic surface textures.

Costume accuracy
Clothing must reflect:

* Historical period.
* Cultural background.
* Geographical context.
* Climate.
* Character identity.
* Social environment.
* Narrative descriptions.

Do not automatically introduce fantasy costumes, flowing robes, elaborate gowns, or decorative garments.
Characters should wear clothing appropriate to the actual literary scene.
9. ENVIRONMENTAL PAINTING
Create immersive, beautifully painted environments grounded in the literary source.
Environmental characteristics

* Sophisticated atmospheric depth.
* Natural painterly textures.
* Elegant architecture.
* Organic vegetation.
* Believable spatial relationships.
* Carefully controlled lighting.
* Harmonious environmental colors.
* Selective visual detail.
* Subtle surrealist atmosphere.
* Rich traditional painting quality.

Possible environments

* Rural towns.
* Contemporary cities.
* Historical streets.
* Domestic interiors.
* Coastal landscapes.
* Natural forests.
* Agricultural environments.
* Architectural spaces.
* Fictional locations.
* Ordinary public spaces.

These are possibilities, not required elements.
Critical rule
Do not automatically place every scene in a mysterious village, tropical landscape, magical forest, or dreamlike garden.
The environment must follow the source narrative.
10. ARCHITECTURE AND SPATIAL DESIGN
Render architecture with believable structure and sophisticated painterly interpretation.
Architectural characteristics

* Accurate spatial relationships.
* Believable building proportions.
* Culturally appropriate design.
* Natural material textures.
* Sophisticated perspective.
* Organic painterly imperfections.
* Carefully selected architectural details.
* Atmospheric integration.

Surreal architectural elements
When explicitly supported by the narrative, architecture may contain unusual spatial characteristics.
Examples of visual techniques include altered scale, unexpected connections between spaces, or impossible architectural relationships.
These should feel visually integrated with the rest of the painting.
Do not introduce architectural impossibilities into ordinary scenes without narrative justification.
11. LIGHTING — POETIC AND ATMOSPHERIC
Use sophisticated painterly lighting to create emotional and atmospheric depth.
Lighting characteristics

* Soft natural daylight.
* Gentle environmental illumination.
* Warm interior lighting.
* Subtle moonlight.
* Refined atmospheric shadows.
* Carefully controlled highlights.
* Natural reflected light.
* Elegant color-temperature relationships.
* Delicate volumetric atmosphere.
* Painterly light diffusion.

Poetic lighting
Light may contribute to the emotional symbolism of the scene.
However, lighting must remain coherent with the illustrated environment.
Avoid random supernatural illumination.
Do not automatically add glowing particles, magical beams, or fantasy effects.
Critical principle
Atmospheric lighting should make the scene feel poetic, not artificially magical.
12. DREAMLIKE ATMOSPHERE
Introduce a subtle oneiric quality through artistic choices rather than mandatory fantasy effects.
Atmospheric techniques

* Gentle environmental haze.
* Soft transitions between spatial planes.
* Delicate painterly abstraction.
* Subtle color shifts.
* Restrained atmospheric perspective.
* Carefully controlled negative space.
* Poetic visual rhythm.
* Emotionally expressive lighting.

Dreamlike visual language
The scene may feel slightly suspended in time.
Environmental relationships may appear unusually quiet or contemplative.
Color and composition may suggest memory, reflection, or subjective experience.
Do not automatically distort reality.
The dreamlike atmosphere must remain consistent with the literary passage.
13. SYMBOLISM AND VISUAL METAPHOR
Use visual symbolism only when it reinforces the source material.
Symbolic principles

* Narrative relevance.
* Emotional coherence.
* Cultural sensitivity.
* Visual restraint.
* Meaningful object placement.
* Clear thematic relationships.
* Sophisticated artistic integration.

Symbolic objects
Objects may carry emotional or thematic meaning through their placement, scale, lighting, or visual relationship with characters.
However, do not introduce random clocks, birds, floating books, mirrors, keys, flowers, or other symbolic motifs.
Critical rule
Symbolism must be derived from the story, not invented as decoration.
When the passage contains no explicit symbolic or magical content, use poetic composition and painterly atmosphere without introducing unsupported objects.
14. CINEMATIC AND FINE-ART COMPOSITION
Create sophisticated compositions combining traditional fine-art principles with refined literary visual storytelling.
Composition characteristics

* Strong focal hierarchy.
* Elegant asymmetry.
* Balanced negative space.
* Meaningful subject placement.
* Sophisticated perspective.
* Natural leading lines.
* Expressive silhouettes.
* Atmospheric depth.
* Carefully controlled visual complexity.
* Poetic spatial relationships.

Character-focused scenes
Emphasize expressions, gestures, and emotional relationships.
Environmental scenes
Use spatial composition, atmosphere, and light to establish narrative context.
Surreal scenes
Preserve visual coherence while allowing narratively supported extraordinary relationships.
Quiet scenes
Use restraint, negative space, and nuanced painterly textures.
Critical rule
Do not automatically create elaborate surreal compositions.
The narrative determines the degree of visual complexity.
15. MATERIALS AND SURFACE RENDERING
Render physical materials using traditional painterly techniques.
Skin
Natural color variation, believable anatomy, soft painterly transitions, and refined emotional expression.
Fabric
Expressive folds, subtle texture, natural movement, and sophisticated highlights.
Stone
Organic mineral variation, weathered textures, and painterly structural detail.
Wood
Natural grain, warm tonal variation, and subtle surface imperfections.
Glass
Controlled transparency, soft reflections, and painterly light interaction.
Water
Expressive reflections, natural movement, and atmospheric color.
Vegetation
Organic silhouettes, painterly leaf masses, natural color variation, and selective detail.
Avoid photorealistic microtextures.
The materials must retain the handcrafted character of fine-art painting.
16. TEXTURE AND TRADITIONAL PAINTING QUALITY
Preserve subtle evidence of physical artistic materials.
Texture characteristics

* Fine canvas grain.
* Organic brush marks.
* Layered pigment.
* Delicate impasto highlights.
* Natural paint absorption.
* Subtle surface irregularities.
* Gentle dry-brush effects.
* Painterly color transitions.
* Slightly imperfect contours.

The texture must remain integrated into the artwork.
Avoid artificial paper-aging overlays, heavy scratches, digital noise, or excessive grunge.
The image should resemble a beautifully preserved original painting.
17. EMOTIONAL AND LITERARY FLEXIBILITY
The magical realism style must support a broad range of literary narratives.
Realismo mágico
Integrate extraordinary phenomena naturally into ordinary environments.
Literary fiction
Use sophisticated painterly composition and emotional atmosphere.
Romance
Prioritize subtle human gestures, intimate lighting, and poetic relationships.
Historical fiction
Preserve cultural and historical accuracy while using expressive artistic composition.
Fantasy
Represent extraordinary elements through sophisticated painterly realism rather than generic fantasy spectacle.
Philosophical literature
Use restrained visual symbolism and contemplative composition when justified.
Drama
Emphasize emotional authenticity and meaningful character interactions.
Mystery
Use atmospheric lighting, controlled visibility, and poetic visual tension.
Critical rule
The artistic style must never override the narrative's actual events.
A realistic passage should remain realistic.
An extraordinary passage may introduce surreal elements only when supported by the book.
18. DETAIL DISTRIBUTION
Use carefully controlled visual hierarchy.
Primary focal points
Refined character rendering, expressive details, sophisticated brushwork, and strong visual emphasis.
Secondary subjects
Moderate detail, harmonious color treatment, and softened edges.
Background
Atmospheric abstraction, reduced contrast, organic painterly textures, and selective detail.
Visual philosophy
Avoid rendering every area with equal sharpness.
Preserve deliberate painterly simplification.
The final image should feel rich, elegant, and visually balanced.
19. VISUAL CONSISTENCY ACROSS MULTIPLE ILLUSTRATIONS
When generating multiple illustrations from the same book, maintain consistency in:
Character identity

* Facial structure.
* Age.
* Hairstyles.
* Body proportions.
* Skin tones.
* Clothing.
* Accessories.
* Distinctive features.

World identity

* Architecture.
* Cultural context.
* Historical period.
* Recurring locations.
* Important objects.
* Environmental details.
* Established extraordinary phenomena.
* Fictional world rules.

Artistic identity

* Painterly brushwork.
* Color harmony.
* Lighting philosophy.
* Material rendering.
* Degree of surreal abstraction.
* Atmospheric treatment.
* Composition.
* Texture density.
* Overall visual quality.

Recurring characters must remain visually recognizable.
Recurring locations must preserve their established identities.
Extraordinary phenomena must remain visually coherent with the book's fictional rules.
Do not invent new magical properties or visual characteristics that contradict previous illustrations.
20. ORIGINALITY AND COPYRIGHT
Create entirely original illustrations, characters, environments, symbolic compositions, and extraordinary visual phenomena.
Do not reproduce recognizable copyrighted characters, famous surrealist painting compositions, iconic fictional locations, or distinctive visual designs from existing movies, games, or comics.
Do not imitate the exact recognizable style of a specific contemporary artist.
Use broad traditional painting principles, general surrealist composition techniques, and original literary interpretation.
For public-domain literary works, create original character and environment designs based on the written descriptions rather than copying modern visual adaptations.
The resulting artwork must be suitable for a commercial literary illustration application.
21. STRICT NEGATIVE PROMPT
Avoid:

* Photography.
* Photorealism.
* Hyperrealism.
* CGI.
* 3D rendering.
* Unreal Engine aesthetics.
* Video-game screenshots.
* Glossy digital painting.
* Plastic-looking materials.
* Excessive airbrushing.
* Generic AI-generated fantasy aesthetics.
* Flat vector illustration.
* Corporate illustration.
* Cartoon exaggeration.
* Anime character proportions.
* Thick comic-book outlines.
* Excessive digital sharpness.
* Overly smooth gradients.
* Artificial cinematic bloom.
* Unnecessary lens flares.
* Excessive saturation.
* Mandatory pastel palettes.
* Excessive magical particles.
* Random glowing objects.
* Unnecessary floating elements.
* Unrelated surreal transformations.
* Generic mystical symbols.
* Random clocks and mirrors.
* Arbitrary giant objects.
* Unnecessary fantasy creatures.
* Dreamlike distortion without narrative justification.
* Incoherent perspective.
* Excessive environmental clutter.
* Inconsistent character identities.
* Famous surrealist painting recreations.
* Recognizable copyrighted characters.
* Iconic fictional designs.
* Logos.
* Text.
* Typography.
* Captions.
* Dialogue.
* Speech bubbles.
* Watermarks.
* Decorative borders.

22. FINAL ART DIRECTION
Generate an extraordinary, original magical realism literary illustration combining sophisticated traditional oil-painting craftsmanship, poetic surrealist composition, expressive character painting, atmospheric environmental depth, and emotionally compelling visual storytelling.
The image must feel timeless, sophisticated, mysterious, intimate, visually poetic, and unmistakably handcrafted.
Prioritize the seamless integration of ordinary reality and narratively justified extraordinary phenomena.
Preserve painterly textures, believable human anatomy, elegant lighting, sophisticated color harmony, and meaningful visual composition.
Avoid generic fantasy effects and arbitrary surreal imagery.
Visual Priority Order

1. Premium poetic painterly illustration.
2. Seamless integration of reality and extraordinary narrative elements.
3. Sophisticated traditional brushwork.
4. Elegant surrealist composition when appropriate.
5. Expressive and believable characters.
6. Atmospheric environmental depth.
7. Harmonious emotionally meaningful colors.
8. Subtle symbolism derived from the source.
9. Original character and world design.
10. Consistent visual identity across illustrations.
11. Faithful representation of the literary passage.

The magical realism style determines the artistic execution and visual atmosphere. The literary narrative determines which extraordinary events, characters, objects, and environments actually appear.
23. DYNAMIC SCENE INPUT — BOOKMOO
Illustrate the following literary scene using the magical realism artistic principles established above.
SCENE DESCRIPTION:
{{scene_description}}
CHARACTER DESCRIPTIONS:
{{character_descriptions}}
HISTORICAL AND CULTURAL CONTEXT:
{{world_context}}
ENVIRONMENT:
{{environment_context}}
EMOTIONAL ATMOSPHERE:
{{mood}}
LIGHTING AND TIME OF DAY:
{{lighting_context}}
COMPOSITION AND CAMERA ANGLE:
{{composition}}
NARRATIVELY JUSTIFIED EXTRAORDINARY ELEMENTS:
{{magical_elements}}
SYMBOLIC OBJECTS AND VISUAL MOTIFS:
{{symbolic_context}}
IMPORTANT NARRATIVE OBJECTS:
{{narrative_objects}}
PREVIOUS CHARACTER AND WORLD REFERENCES:
{{visual_references}}
ASPECT RATIO:
{{aspect_ratio}}
FINAL GENERATION INSTRUCTION
Create one complete, original, beautifully composed magical realism literary illustration.
Apply sophisticated traditional painterly techniques, expressive character illustration, poetic composition, atmospheric lighting, rich handcrafted textures, and subtle surrealist visual storytelling.
Faithfully represent the supplied literary passage.
Preserve established character identities, historical context, environmental details, and narrative continuity.
Integrate extraordinary phenomena only when explicitly supported by the narrative.
When extraordinary phenomena are present, depict them naturally within the physical world rather than relying on excessive fantasy effects.
When the scene contains no magical or surreal events, create a sophisticated painterly literary illustration using poetic composition and atmosphere without inventing supernatural elements.
Do not reproduce famous surrealist paintings, recognizable copyrighted characters, or existing fictional compositions.
Generate a single complete full-frame illustration rather than a multi-panel page.
The final image must resemble an original premium handcrafted painting rather than photography or CGI.
No text, no captions, no typography, no dialogue, no speech bubbles, no logos, no decorative borders, and no watermarks.$sty$ where id = 'realismo-magico';
do $$ begin
  if (select count(*) from comic_styles where ready and not hidden) <> 16 then raise exception 'esperava 16 estilos prontos'; end if;
end $$;
commit;
