# Plano: Galeria, Comunidade e Perfis do Bookmoo

> Plano de produto + técnico. Nada aqui foi implementado ainda.
> Base: leitura do código em 2026-11-10 (commit `8330e96` + alterações não commitadas em Gallery, Community, catalog, Admin).

---

## 1. Design system (como o app é hoje)

**Identidade:** "Hi — Language Learning". Editorial, calma, papel quente. Nada de gradientes ou neon; cor vem das capas dos livros e de pastéis suaves.

| Camada | O que existe | Onde |
|---|---|---|
| Tipografia | `font-display` Newsreader (títulos 32–40px, `leading-[1.05]`), `font-serif` Literata (leitura), `font-sans` Inter (UI 12.5–14.5px) | `src/index.css` |
| Cor por tema | Variáveis `--theme-*` em 3 temas: `light` (creme `#F6F3EE`), `sepia`, `dark`. Superfícies: `--theme-bg`, `--theme-bg-secondary`, `--theme-card-bg`, `--theme-border` | `src/index.css` |
| Pastéis | `--theme-pastel-1..4` (lilás, verde, amarelo, azul) e `--pastel-*-{bg,fg,bd}` (green, amber, lavender, rose, blue, sand) | `src/index.css` |
| Semântica vocab | `learned` verde, `review` âmbar, `important` lilás (`btn-3d--*`) | `src/index.css` |
| Raios/sombras | `--hi-radius-sm/md/lg/xl` (8/12/16/24), `--hi-shadow-*`, `.book-cover` com sombra que cresce no hover | `src/index.css` |
| Ilustrações | SVG em `public/illustrations` (reading, chatting, high-five, teamworks…), classe `.illo` já inverte no dark e multiplica no sepia | `public/illustrations` |
| Componentes | `ui/` (button, card, dialog, input, label, popover, textarea, toolbar), `btn-3d` | `src/components/ui` |
| Padrões de página | Container `max-w-5xl/6xl mx-auto`, header com h1 display + subtítulo + ilustração, filtros em "segmented control" (`bg-secondary` + aba ativa `card-bg`), grid de capas `aspect-[2/3]` | `Gallery.tsx` |
| Estilo | **Inline `style={{ var(--theme-*) }}`** misturado com Tailwind. Funciona nos 3 temas; manter. |
| i18n | Padrão `const pt = locale === 'pt-BR'` com strings inline (não há dicionário para essas telas) |
| Animação | `motion` já instalado |

**Regras que o plano segue:** só tokens `--theme-*`/`--pastel-*` (nunca hex solto); toda tela testada em light/sepia/dark; mobile-first (BottomNav já existe); reutilizar `book-cover`, segmented control e `.illo`; sem lib nova de UI.

---

## 2. O que já existe (e o que está fraco)

**Existe**
- `profiles` (username, bio, english_level, is_public, socials jsonb, reading jsonb, stats jsonb) + RLS "público ou o próprio".
- `/community` (lista de perfis públicos + carrossel de livros) e `/profile/:userId` — **telas mínimas**, estilo placeholder.
- `ProfileSection` em Configurações (foto com recorte, bio, nível, redes, toggle público).
- Galeria `/gallery` e `/gallery/:id`: filtro por nível CEFR, categoria, autor, busca; versões da comunidade com estrelas, feedback, `book_links`.
- `catalog_books` com `level` (migração nova ainda não commitada) e `BOOK_CATEGORIES` (10 categorias).
- Gamificação: `useXpStore` (pontos, sequência), `study_days`, `practice_sessions`, `CEFR` por palavras+pontos (`studyLevel`).

**Problemas que o plano resolve**
1. **Perfil é um "snapshot" manual** — `reading` e `stats` só atualizam quando a pessoa clica Salvar. Fica velho.
2. **Privacidade tudo-ou-nada** — `profiles_read` expõe a linha inteira se `is_public`. Não dá para esconder estante mas mostrar bio.
3. **Sem avatar na comunidade** — a foto vive em `auth.user_metadata`, que outros usuários não leem; cards mostram só inicial.
4. **Sem conexão entre pessoas** — não há seguir, amizade, feed nem busca de pessoas.
5. **Username sem unicidade/validação**, sem URL amigável (`/profile/<uuid>`).
6. **Nível de inglês é digitado à mão** em vez de usar o `studyLevel` calculado (o app já sabe o nível real).
7. **Galeria pesada** — `listCatalog` já não traz `pages`, mas traz `cover_data` em base64 de todos os livros, sem limite; filtros 100% client-side.
8. **Card de livro sem sinais sociais** — sem nº de leitores, nota, "quem está lendo".
9. **Sem página de livro "de perfil"** — `/gallery/:id` mistura leitura/importação/versões/feedback sem hierarquia.

---

## 3. Visão do produto

> Um "Goodreads + Duolingo friends" calmo: **estante pública bonita, progresso real de inglês e pessoas lendo as mesmas histórias.**

Princípios: privacidade primeiro (começa tudo privado), prova social sem competição tóxica, tudo derivado de dados reais (nada digitado que o app já sabe).

---

## 4. Modelo de dados (Supabase)

Migração nova: `supabase/migrations/2026111x_community_v2.sql`. **Deploy do Supabase precisa de OK explícito seu a cada vez.**

### 4.1 Perfis (evoluir `profiles`)
```
profiles
  user_id, username (unique, citext, 3–20, [a-z0-9_.]), display_name, bio (≤200),
  avatar_url, cover_color (token pastel), country, native_language,
  english_level (override manual opcional), goal text,
  visibility text check in ('private','members','public')   -- substitui is_public
  show_shelf bool, show_stats bool, show_activity bool, show_socials bool,
  socials jsonb, updated_at
```
- **Aberto vs fechado:** `private` (só eu), `members` (só logados), `public` (vitrine). Toggles granulares por bloco.
- **Perfil fechado + conexões:** `visibility='private'` mostra só avatar+nome+nível; quem eu aprovei (seguidor aceito) vê tudo.
- **Backfill:** `is_public=true` → `public`; resto → `private`.

### 4.2 Dados do perfil sem snapshot
- **View/RPC `public_profile(username)`** (security definer) que monta o payload respeitando os toggles e a relação do visitante. Evita expor `reading/stats` crus.
- **`profile_stats`** (tabela atualizada por trigger/RPC a partir de `xp_events`, `vocabulary`, `study_days`): pontos, sequência, palavras, livros lidos, minutos, nível CEFR calculado. Some o campo `stats jsonb`.
- **Estante:** nova `shelf_items (user_id, catalog_id|null, title, cover_url, status 'reading'|'finished'|'want'|'studying', progress, started_at, finished_at, rating, visible)`. Sincronizada a partir de `books` + `book_links` (livros enviados pelo usuário entram só com título se ele permitir).

### 4.3 Conexões
```
follows (follower_id, followee_id, status 'accepted'|'pending', created_at)  PK(follower,followee)
```
- Perfil público: seguir = aceito na hora. Perfil fechado: vira `pending` até aprovar.
- RPC `follow(target)`, `unfollow`, `respond_follow`, `block(target)` + tabela `blocks`.
- Contadores (seguidores/seguindo) via view.

### 4.4 Atividade (feed)
```
activity (id, user_id, kind 'finished_book'|'level_up'|'streak'|'started_book'|'shared_version'|'review',
          ref_id, payload jsonb, visibility, created_at)
```
Gerada por RPCs/triggers quando eventos já existentes acontecem (ex.: `xp_events` de leitura, mudança de nível). Feed = atividade de quem eu sigo + destaques da comunidade.

### 4.5 Livros: sinais sociais
- `catalog_books`: já tem `level`, `category`. Adicionar `tags text[]`, `pages_count`, `reading_minutes`, `words_count`, `cover_url` (Storage em vez de base64), `featured bool`.
- `book_reviews (catalog_id, user_id, rating 1–5, body, spoiler bool)` — hoje há `book_feedback` e estrelas só para *versões*; unificar o conceito (manter `book_feedback` como comentários, adicionar nota do livro).
- View `catalog_stats (catalog_id, readers, finishing_rate, avg_rating, reviews)`.
- **Listagem leve:** RPC `list_catalog(filters, sort, cursor)` que NÃO retorna `pages`.

### 4.6 RLS / segurança (obrigatório)
- Toda leitura de perfil/estante/atividade passa pela função que checa `visibility` + `follows` + `blocks`.
- `username` e `bio` passam por limite de tamanho e filtro de URLs/linkify seguro (sem HTML).
- Redes sociais: validar handle/URL (https only, domínios conhecidos para ícone).
- Rate limit em `follow` e `reviews` (RPC com limite por hora).
- Admin: poder de ocultar perfil/review (`is_global_admin()` já existe) + tabela `reports`.

---

## 5. Telas e experiência

### 5.1 Galeria `/gallery` — "galeria linda"
- **Hero editorial** (h1 display + ilustração) com **faixas curadas**: *Continue lendo*, *Para o seu nível (B1)*, *Em alta na comunidade*, *Novos*, *Curtos (<30 min)*.
- **Card do livro** (novo componente `BookCard`, variantes `grid` / `row` / `compact`):
  - capa `aspect-[2/3]` com `book-cover` (sem o blur-xl pesado no grid: usar cor dominante da capa como fundo),
  - selo de nível CEFR (já existe) + categoria,
  - nota ★ média, nº de leitores, avatares empilhados de quem está lendo (máx. 3),
  - estado: `Na minha estante` / `Lendo 42%` / `Concluído`,
  - botão rápido "Adicionar à estante" (hover desktop, sempre visível no mobile).
- **Filtros:** nível (segmented, já existe), **categoria como chips roláveis**, autor, **duração**, **tipo (texto / HQ)**, **ordenar** (relevância, recentes, mais lidos, melhor nota), busca. **Estado na URL** (`?level=B1&cat=fantasy&sort=top`) para compartilhar/voltar.
- **Recomendação de nível:** destacar livros ±1 nível do `studyLevel` do usuário; aviso suave quando o livro é difícil demais.
- Skeletons (`BookCardSkeleton` já existe), paginação por cursor, empty states com `.illo`.

### 5.2 Perfil do livro `/gallery/:id` (reestruturar)
Cabeçalho: capa grande, título, autor, nível, categoria, nota, leitores, **CTA principal** (Ler / Adicionar / Continuar) → abas:
1. **Sobre** — descrição, tags, tempo estimado, palavras difíceis previstas.
2. **Leitores** — quem está lendo/leu (respeita privacidade), progresso.
3. **Versões** (HQ da comunidade, estrelas — já existe).
4. **Avaliações** — nota + resenha com spoiler oculto.
5. **Discussão** (fase 3) — comentários por capítulo.
Rodapé: "Quem leu também leu".

### 5.3 Comunidade `/community`
- Abas: **Descobrir** (pessoas + destaques) · **Seguindo** (feed) · **Meus contatos**.
- **Descobrir:** busca por nome/@username, filtros por nível CEFR, objetivo, "lendo o mesmo livro que eu", "mesma sequência". Cards de pessoa: avatar, @user, nível, bio curta, livro atual, botão Seguir.
- **Feed:** cartões de atividade (terminou livro X, subiu para B2, 30 dias de sequência) com reações simples (👏 ❤️ 📚) — sem comentários livres na v1.
- **Ranking leve** (opcional, opt-in): semanal por pontos entre quem eu sigo (não global, evita competição tóxica).

### 5.4 Perfil do usuário `/u/:username`
- **Topo:** avatar, nome, @user, bio, país, **selo de nível** (calculado), botões Seguir/Editar/Mensagem(futuro), redes sociais com ícones.
- **Aberto vs fechado:** banner "Perfil privado — peça para seguir" com o que ainda é visível.
- **Blocos (cada um com toggle):**
  - **Estante** — abas Lendo · Estudando · Concluídos · Quero ler, grade de capas.
  - **Resultados** — pontos, sequência, palavras aprendidas, mapa de atividade (reaproveitar `ActivityPanel`), evolução CEFR.
  - **Conquistas** (selos) · **Atividade recente**.
  - **Estudando agora** — palavras/expressões recentes (opt-in).
- **Editar perfil:** mover `ProfileSection` para `/settings/profile` com **preview ao vivo** "como os outros me veem" nos 3 modos.
- Onboarding: após o primeiro livro, card "Crie seu perfil" (username, foto, objetivo, visibilidade).

---

## 6. Componentes novos (`src/components/community/` e `src/components/book/`)

`BookCard` · `BookShelfGrid` · `BookFilters` (chips + selects + URL state) · `BookHero` · `RatingStars` · `LevelBadge` · `Avatar` (com fallback de inicial e anel de nível) · `AvatarStack` · `PersonCard` · `FollowButton` · `ProfileHeader` · `ProfileBlock` (wrapper com cadeado de privacidade) · `VisibilityPicker` · `ActivityCard` · `ReactionBar` · `ShelfTabs` · `ReviewList`/`ReviewForm` · `EmptyState` (com `.illo`).

Camada de dados: `src/lib/community.ts` (substitui `communityProfile.ts`), `src/lib/shelf.ts`, `src/lib/follows.ts`, `src/lib/activity.ts`; stores zustand só para cache (`useCommunityStore`).

---

## 7. Fases de entrega

| Fase | Entrega | Valor | Esforço |
|---|---|---|---|
| **0 — Fundação** (1–2 dias) | Extrair `BookCard`, `LevelBadge`, `Avatar`, `EmptyState`; filtros com estado na URL; capas em Storage (exige migração no Supabase) | Galeria rápida e coerente | P |
| **1 — Galeria linda** (3–4 dias) | Hero + faixas curadas, card novo com nota/leitores/estado, ordenar, filtro de duração, skeletons, recomendação por nível | Descoberta de livros | M |
| **2 — Perfil de verdade** (4–5 dias) | Migração `profiles` v2 (visibility, toggles, username único, avatar_url), `profile_stats`, `shelf_items`, rota `/u/:username`, editor com preview, estante pública | Perfil aberto/fechado, estante, resultados | G |
| **3 — Conexões** (3–4 dias) | `follows` + pendentes + bloqueio, busca de pessoas, `FollowButton`, contadores | "Me conectar com outras pessoas" | M |
| **4 — Perfil do livro social** (3 dias) | Abas, `book_reviews`, `catalog_stats`, leitores do livro, "quem leu também leu" | Prova social | M |
| **5 — Feed e atividade** (3–4 dias) | `activity` + triggers, aba Seguindo, reações, selos/conquistas | Retenção | M |
| **6 — Extras** | Ranking opt-in entre amigos, discussão por capítulo, clubes de leitura, denúncias/moderação no Admin, mensagens | Comunidade viva | G |

Ordem recomendada: **0 → 2 → 1 → 3 → 4 → 5** (perfil antes da galeria bonita, porque a galeria depende dos dados sociais; fase 1 pode rodar em paralelo à 2 se houver duas frentes).

---

## 8. Riscos e decisões em aberto

1. **Privacidade/LGPD:** público por padrão está **fora**; consentimento explícito para cada bloco; botão "excluir meus dados sociais".
2. **Moderação:** username/bio/resenha ofensivos → `reports` + ação admin desde a fase 3, antes de abrir feed.
3. **Custo de leitura:** feed e `catalog_stats` devem ser views materializadas/cache, não `count(*)` por card.
4. **Conflito com trabalho em andamento:** há mudanças não commitadas em `Gallery.tsx`, `Community.tsx`, `catalog.ts` e a migração `catalog_cefr_level.sql`. **Commitar ou fechar isso antes da fase 0.**
5. **Migração de `is_public`:** manter coluna por um release para não quebrar clientes em cache.
6. **Livros enviados pelo usuário (EPUB):** direitos autorais → só título (sem capa/texto) na estante pública, e só se o usuário permitir.

### Decisões que preciso de você
- Seguir é **assimétrico** (estilo Instagram) ou **amizade mútua**? (plano assume assimétrico + aprovação em perfil fechado)
- URL do perfil: `@username` obrigatório no cadastro ou opcional?
- Feed já na v1 ou deixar para depois da fase 4?
- Nível de inglês exibido: **só calculado** (recomendado) ou permitir o usuário declarar?
- Mensagens diretas entram no escopo?
