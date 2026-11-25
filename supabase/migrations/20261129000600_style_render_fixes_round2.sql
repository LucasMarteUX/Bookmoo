-- Ajustes depois do teste real dos 16 estilos (25/11), página de abertura de um livro por estilo:
-- Aquarela e Pintura Histórica escorregaram para tons apagados e terrosos em cenas sombrias de época; a Pintura Histórica
-- desenhou nuvens de pensamento; o Mangá saiu como gravura (sem retícula, sem rosto de mangá); o Thriller saiu fotográfico;
-- o Cyberpunk virou steampunk num livro vitoriano; o Noir saiu com cara de gravura fina.
update public.comic_styles set render_prompt = render_prompt || $p$

MOOD WITHOUT MUD
- Gloomy, rainy, sad or old-fashioned scenes are still painted bright and clean: an overcast sky is a light blue-gray wash with plenty of white paper; old stone houses are cream, pale gray and soft lilac; gardens keep fresh greens and colored flowers.
- Sadness and mystery come from composition, posture and cooler clear blues and violets, never from brown, beige, olive or gray desaturation.
- Every panel keeps at least two clearly saturated color accents (flowers, ribbons, foliage, clothing details).$p$ where id = 'aquarela-nanquim';

update public.comic_styles set render_prompt = render_prompt || $p$

MOOD WITHOUT MUD
- Somber subjects (churchyards, poverty, winter, old age) are still rendered luminous and clean: silver daylight, clear blue-gray skies, fresh greens, crisp light on faces; stones are pale gray and cream, not mossy brown.
- Clothing of poor or rural characters uses clean, clear colors (slate blue, sage, rust red, cream) rather than dull brown.
- Never paint memories, thoughts or dreams as cloud-shaped bubbles or vignettes inside a panel; show them as part of the scene or leave them out.$p$ where id = 'pintura-historica';

update public.comic_styles set render_prompt = render_prompt || $p$

INTERIORS AND PERIOD SCENES
- Drawing rooms, studies and period interiors stay luminous and colorful: daylight through tall windows, rich jewel-toned fabrics (emerald, sapphire, crimson), polished gold accents, clear cool shadows.
- Tweed and wool clothing is rendered with clear readable color (heather gray, slate blue, forest green), never as a brown mass.$p$ where id = 'fantasia-epica';

update public.comic_styles set render_prompt = render_prompt || $p$

MANGA IDENTITY (NON-NEGOTIABLE)
- This must be unmistakably a Japanese manga page, not an engraving, etching or pen-and-ink book illustration.
- Characters are drawn with manga character design: large expressive eyes with highlights, simplified noses, clean jawlines, spiky or flowing hair locks with white shine streaks. Show the characters in most panels.
- Mid-tones come ONLY from visible mechanical screentone dot patterns (gradated dots on skies, shadows, clothing). Do NOT use cross-hatching, engraving lines or etched texture for shading.
- Backgrounds are clean ruler-drawn line art with large white areas; use speed lines and focus lines for drama.
- The page has the requested number of panels with typical manga paneling, never a single framed illustration unless the plan asks for one panel.$p$ where id = 'manga-tradicional';

update public.comic_styles set render_prompt = render_prompt || $p$

ILLUSTRATED, NOT PHOTOGRAPHIC
- The image must read as a hand-drawn graphic-novel illustration: visible contour lines around faces, hands and clothing, drawn hair strands, illustrated shading with graphic shadow shapes.
- Never a photograph, film still or photorealistic render: no lens bokeh, no skin pores, no photographic noise, no realistic depth-of-field blur on faces.
- Close-ups show the whole face and expression, never an extreme crop of a single eye or nose.$p$ where id = 'thriller-cinematografico';

update public.comic_styles set render_prompt = render_prompt || $p$

ANY ERA, CYBERPUNK LOOK
- Whatever the story's period or place, render it with cyberpunk light and palette: night, rain, magenta and cyan neon glow, glowing signs and screens, wet reflective surfaces. Keep the story's own objects, clothing and architecture, but light and color them as a neon night city.
- Not steampunk: no sepia, brass-and-brown dominance or candlelit warmth as the main light; brass and wood only as small accents reflecting neon.$p$ where id = 'cyberpunk';

update public.comic_styles set render_prompt = render_prompt || $p$

BOLD BRUSH, NOT ENGRAVING
- Shadows are large solid black shapes laid with a brush, with only light hatching in transitions; never fine engraving or etching lines over the whole image.
- Use night, rain or deep interior shadow whenever the scene allows; daylight scenes still have strong black shadows and high contrast.$p$ where id = 'noir-misterio';
