-- Reforço de paleta nos estilos que mais escorregavam para bege e marrom em cenas internas (teste real de 25/11:
-- o Guache saiu limpo e fofo, mas a cozinha ficou bege e marrom).
update public.comic_styles set render_prompt = render_prompt || $p$

COLOR DOMINANCE (ALSO INDOORS AND AT NIGHT)
- Interiors are bright and cheerful: walls in light butter yellow, mint, sky blue, soft pink or white; furniture painted in clear colors (teal cupboards, red chairs, yellow table, blue shelves); colorful dishes, curtains and rugs.
- Wood appears as light honey or painted color, never large areas of brown. Stone and brick are light and cheerful (cream, pale gray, coral-orange).
- Clothing uses clear saturated colors (grass green, sunny yellow, sky blue, cherry red, pink, lilac); an older or poorer character still wears clean, bright, simple colors, never drab browns.
- At night the palette becomes clear blues and violets with warm yellow window light, still bright and readable.
- In every panel at least two thirds of the image is clean saturated color or light tints. Beige, tan and brown together must stay under one tenth of the image.$p$ where id = 'infantil-guache';

update public.comic_styles set render_prompt = render_prompt || $p$

COLOR DOMINANCE (ALSO INDOORS AND AT NIGHT)
- Interiors stay light and colorful: pale walls washed in cream, butter yellow or soft blue; colorful textiles, dishes and flowers; window light flooding in.
- Wood is light honey with transparent wash, not dark brown; ink lines carry the darks.
- At night use clear transparent blues and violets with warm yellow lamp glow; keep paper white in the highlights.
- Brown and beige together must stay a small accent; the image must read bright and colorful.$p$ where id = 'aquarela-nanquim';

update public.comic_styles set render_prompt = render_prompt || $p$

COLOR DOMINANCE (ALSO INDOORS)
- Interiors are filled with daylight from tall windows: pale walls in cream, sage, powder blue or soft rose; gilded details glowing; colorful upholstery, flowers and porcelain.
- Dark wood furniture appears as polished, clearly lit shapes, never as large murky brown areas.
- The overall image must read luminous and fresh, like a cleaned and restored painting.$p$ where id = 'pintura-historica';
