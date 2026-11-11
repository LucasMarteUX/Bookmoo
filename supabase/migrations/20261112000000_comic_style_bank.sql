-- Banco de estilos das ilustrações.
-- * comic_styles: os 16 estilos (nome, linguagem, aplicações) e o super prompt de cada um.
--   O prompt só o admin lê e edita; o app vê se o estilo está pronto (ready).
-- * Galeria: a imagem oficial de cada página passa a ser por livro E por estilo. A primeira pessoa
--   que gera num estilo define as páginas desse estilo para todo mundo. Quem troca de estilo
--   recomeça do zero, e o livro passa a oferecer os dois estilos para quem puxar.
-- * 'legacy' guarda as páginas geradas antes do banco existir. Não aparece para escolha.
-- O Supabase dá execute ao anon em funções novas: toda função aqui revoga anon explicitamente.

create table if not exists public.comic_styles (
  id text primary key,
  position int not null,
  name_pt text not null,
  name_en text not null,
  look_pt text not null,
  look_en text not null,
  use_pt text not null,
  use_en text not null,
  categories text[] not null default '{}',
  prompt text,
  ready boolean generated always as (prompt is not null and char_length(prompt) >= 400) stored,
  hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint comic_styles_id check (id ~ '^[a-z0-9-]{2,40}$'),
  constraint comic_styles_prompt_len check (prompt is null or char_length(prompt) <= 20000)
);
alter table public.comic_styles enable row level security;

-- Todo mundo logado lista os estilos; o prompt fica de fora (coluna sem permissão).
drop policy if exists comic_styles_read on public.comic_styles;
create policy comic_styles_read on public.comic_styles for select to authenticated using (true);
revoke all on public.comic_styles from anon, authenticated;
grant select (id, position, name_pt, name_en, look_pt, look_en, use_pt, use_en, categories, ready, hidden, updated_at)
  on public.comic_styles to authenticated;

insert into public.comic_styles (id, position, name_pt, name_en, look_pt, look_en, use_pt, use_en, categories, hidden) values
  ('legacy', 0, 'Estilo original', 'Original style', 'Páginas geradas antes do banco de estilos', 'Pages generated before the style bank', '', '', '{}', true),
  ('aquarela-nanquim', 1, 'Aquarela & Nanquim', 'Watercolor & Ink', 'Traços artesanais e pintura suave', 'Handmade lines and soft painting', 'Contos, literatura infantil e clássicos', 'Short stories, children''s books and classics', '{children,short,classic}', false),
  ('fantasia-epica', 2, 'Fantasia Épica', 'Epic Fantasy', 'Pintura fantástica detalhada', 'Detailed fantasy painting', 'Fantasia, aventuras e mitologia', 'Fantasy, adventure and mythology', '{fantasy,adventure}', false),
  ('fantasia-sombria', 3, 'Fantasia Sombria', 'Dark Fantasy', 'Pintura dramática e tons profundos', 'Dramatic painting and deep tones', 'Dark fantasy e fantasia gótica', 'Dark and gothic fantasy', '{fantasy}', false),
  ('terror-gotico', 4, 'Terror Gótico', 'Gothic Horror', 'Gravura e sombras expressivas', 'Engraving and expressive shadows', 'Terror, suspense sobrenatural', 'Horror and supernatural suspense', '{mystery}', false),
  ('ficcao-cientifica', 5, 'Ficção Científica', 'Science Fiction', 'Concept art e cenários tecnológicos', 'Concept art and technological settings', 'Sci-fi e exploração espacial', 'Sci-fi and space exploration', '{}', false),
  ('cyberpunk', 6, 'Cyberpunk', 'Cyberpunk', 'Neon, arquitetura futurista e alto contraste', 'Neon, futuristic architecture, high contrast', 'Futurismo, distopias tecnológicas', 'Futurism and tech dystopias', '{}', false),
  ('romance-aquarela', 7, 'Romance em Aquarela', 'Watercolor Romance', 'Ilustração editorial delicada', 'Delicate editorial illustration', 'Romance e drama', 'Romance and drama', '{romance}', false),
  ('pintura-historica', 8, 'Pintura Histórica', 'Historical Painting', 'Ilustração clássica de época', 'Classic period illustration', 'Ficção histórica e romances de época', 'Historical fiction and period romance', '{classic,biography,romance}', false),
  ('noir-misterio', 9, 'Noir & Mistério', 'Noir & Mystery', 'Preto e branco cinematográfico', 'Cinematic black and white', 'Mistério, investigação e crime', 'Mystery, investigation and crime', '{mystery}', false),
  ('thriller-cinematografico', 10, 'Thriller Cinematográfico', 'Cinematic Thriller', 'Realismo ilustrado, luz dramática', 'Illustrated realism, dramatic light', 'Suspense, espionagem', 'Suspense and espionage', '{mystery}', false),
  ('manga-tradicional', 11, 'Mangá Tradicional', 'Traditional Manga', 'Nanquim, retículas e expressividade', 'Ink, screentones and expressiveness', 'Mangá e narrativas japonesas', 'Manga and Japanese stories', '{}', false),
  ('anime-colorido', 12, 'Anime Colorido', 'Colorful Anime', 'Cel shading e cores expressivas', 'Cel shading and expressive colors', 'Fantasia, aventura, cotidiano', 'Fantasy, adventure, slice of life', '{adventure,fantasy}', false),
  ('hq-americana', 13, 'HQ Americana', 'American Comics', 'Arte-final em tinta e cores chapadas', 'Inked art and flat colors', 'Super-heróis, aventura e ação', 'Superheroes, adventure and action', '{adventure}', false),
  ('hq-europeia', 14, 'HQ Europeia', 'European Comics', 'Linha clara e cores controladas', 'Clear line and controlled colors', 'Aventura, história e humor', 'Adventure, history and humor', '{adventure,nonfiction,biography}', false),
  ('infantil-guache', 15, 'Infantil em Guache', 'Children''s Gouache', 'Formas lúdicas e pintura opaca', 'Playful shapes and opaque paint', 'Literatura infantil e fábulas', 'Children''s books and fables', '{children}', false),
  ('realismo-magico', 16, 'Realismo Mágico', 'Magical Realism', 'Pintura surreal e atmosfera poética', 'Surreal painting and poetic mood', 'Fantasia literária e clássicos', 'Literary fantasy and classics', '{poetry,classic,fantasy}', false)
on conflict (id) do update set position = excluded.position, name_pt = excluded.name_pt, name_en = excluded.name_en,
  look_pt = excluded.look_pt, look_en = excluded.look_en, use_pt = excluded.use_pt, use_en = excluded.use_en,
  categories = excluded.categories, hidden = excluded.hidden;

-- Super prompt do estilo 01, como foi enviado.
update public.comic_styles set updated_at = now(), prompt = $prompt$01. Aquarela & Nanquim
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
Output a single complete illustration without any text.$prompt$
where id = 'aquarela-nanquim';

-- Estilo do livro na galeria (definido pela primeira pessoa que gera) e de cada cópia puxada.
alter table public.catalog_books add column if not exists style_id text references public.comic_styles(id);
alter table public.book_links add column if not exists style_id text references public.comic_styles(id);

-- Imagens oficiais por estilo. As que já existem viram 'legacy'.
alter table public.catalog_comic_pages add column if not exists style_id text not null default 'legacy' references public.comic_styles(id);
alter table public.catalog_comic_pages alter column style_id drop default;
alter table public.catalog_comic_pages drop constraint if exists catalog_comic_pages_pkey;
alter table public.catalog_comic_pages add constraint catalog_comic_pages_pkey primary key (catalog_id, style_id, page);
update public.catalog_books c set style_id = 'legacy'
  where style_id is null and exists (select 1 from public.catalog_comic_pages p where p.catalog_id = c.id);

-- Publicar imagem oficial: só num estilo pronto (ou no legado), e a primeira pessoa ganha.
drop policy if exists catalog_pages_insert on public.catalog_comic_pages;
create policy catalog_pages_insert on public.catalog_comic_pages
  for insert to authenticated
  with check (
    auth.uid() is not null and created_by = auth.uid()
    and exists (select 1 from public.comic_styles s where s.id = style_id and (s.ready or s.id = 'legacy'))
  );

-- Estilos disponíveis de um livro da galeria: o padrão (primeira pessoa) e os que já têm páginas.
create or replace function public.catalog_style_options(p_catalog uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'style_id', s.id, 'pages', coalesce(p.pages, 0), 'is_default', s.id = c.style_id
  ) order by (s.id = c.style_id) desc, coalesce(p.pages, 0) desc, s.position), '[]'::jsonb)
  from public.catalog_books c
  join public.comic_styles s on s.id = c.style_id or s.id in (select style_id from public.catalog_comic_pages where catalog_id = p_catalog)
  left join (select style_id, count(*) as pages from public.catalog_comic_pages where catalog_id = p_catalog group by style_id) p on p.style_id = s.id
  where c.id = p_catalog and auth.uid() is not null;
$$;
revoke all on function public.catalog_style_options(uuid) from public, anon;
grant execute on function public.catalog_style_options(uuid) to authenticated;

-- Admin: ver e salvar o super prompt de cada estilo.
create or replace function public.admin_comic_styles()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_global_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'prompt', prompt, 'ready', ready, 'updated_at', updated_at) order by position)
    from public.comic_styles where not hidden), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_comic_styles() from public, anon;
grant execute on function public.admin_comic_styles() to authenticated;

create or replace function public.admin_save_style_prompt(p_style text, p_prompt text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_global_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.comic_styles set prompt = nullif(btrim(p_prompt), ''), updated_at = now() where id = p_style and not hidden;
end;
$$;
revoke all on function public.admin_save_style_prompt(text, text) from public, anon;
grant execute on function public.admin_save_style_prompt(text, text) to authenticated;
