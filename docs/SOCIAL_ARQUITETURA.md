# Bookmoo Social — diagnóstico e plano técnico

> 2026-11-11. Base: código em `main` (3bcab17) + camada social já aplicada no Supabase
> (`20261111000100`, `20261111120000`, `20261111190000`).

## 1. Diagnóstico da arquitetura existente

| Área | O que existe | Onde |
|---|---|---|
| Identidade | Supabase Auth. **`auth.users.id` (uuid) é o ID canônico**; toda tabela usa `user_id uuid references auth.users`. Não há outro ID. | `AuthContext.tsx`, migrações |
| Perfil | `profiles` (PK `user_id`): `handle` único, nome, bio, objetivo, banner, avatar_url, `is_public`, chaves `show_*`, `placement_level` protegido por trigger. Linha crua só da dona; outros leem por RPC `security definer`. | `20261111000100` |
| Biblioteca | `books` por usuária (texto, páginas, `progress` 0–1, `last_read`, capa base64). Sincronizada pelo Zustand (`upsertBook`). Livro da galeria liga por `book_links(book_id → catalog_id)`. | `supabaseSync.ts`, `useBookStore.ts` |
| Catálogo | `catalog_books` (galeria compartilhada, nível CEFR, categoria). | `catalog.ts` |
| Progresso | `readingProgress()` no cliente → `books.progress`. Não há data de conclusão. | `utils.ts` |
| Social já no ar | `follows` (sem aprovação), `community_posts` (texto + foto + livro da galeria), `post_likes`, `post_comments`, limite por hora, feed RPC (posts + "começou/terminou" calculados na leitura), `catalog_social`. | `20261111120000`, `20261111190000` |
| Storage | Buckets `avatars` (público, pasta própria), `post-media` (público, 5 MB, imagens). | migrações |
| Admin | `is_global_admin()` (e-mail fixo), página `/admin`. | `Admin.tsx` |
| Design system | Tokens `--theme-*` e `--pastel-*` em 3 temas, Newsreader/Literata/Inter, cards `rounded-3xl`, abas em pílula, `.illo`, `book-cover`. Componentes: `Avatar`, `LevelBadge`, `EmptyState`, `BookCard`, `ProfileBanner`, `FollowButton`, `toast`. | `index.css`, `components/ui`, `components/community` |
| Navegação | Desktop: `Sidebar`. Celular (outra sessão, já commitada): `NavBar` + `TabBar` + `routes.ts` (títulos e "voltar"). | `components/layout`, `components/mobile` |

## 2. O que é reaproveitado

ID do Auth, `profiles`, `books`/`book_links`/`catalog_books`, `follows`, `community_posts`, curtidas, comentários, limite por hora, buckets, `Avatar`, `ProfileBanner`, `FollowButton`, `Feed`, `ProfileView`, `toast`, `is_global_admin`, página admin.

## 3. Modelo novo (migração `20261111220000_social_layer.sql`)

| Entidade | Decisão |
|---|---|
| **Seguir** | `follows.status` `accepted`/`pending`. Perfil fechado → pedido; a dona aprova. |
| **Amizade** | `friend_requests` (um registro por par, índice único `least/greatest`). `pending` → `accepted`. Pedido cruzado aceita sozinho. Recusar/desfazer = apagar. |
| **Bloqueio** | `blocks`. Ao bloquear, some seguir e amizade nos dois sentidos. Todas as políticas e RPCs checam bloqueio. |
| **Publicação** | `community_posts` ganha `kind` (`post`, `started`, `progress`, `finished`, `review`, `goal`), `audience` (`public`/`followers`/`friends`), `book_id` + título/autor (livro da estante), `milestone`, `review_id`, `edited_at`, `hidden_at`. **Uma tabela só** para o feed, então curtidas e comentários servem a tudo. |
| **Eventos de leitura** | Trigger em `books` (servidor, não no React): começou (0 → >0), progresso 25/50/75 % (opcional), terminou (→ 100 %), meta atingida. Só gera com consentimento (`share_reading`, `share_progress`, `share_goals`, padrão **desligado**). Índice único evita duplicar. |
| **Conclusão** | `books.finished_at` (trigger, nunca volta atrás). A meta conta por ano em `finished_at`. |
| **Estante** | Reaproveita `books`; `shelf_status` (`abandoned`) e `favorite`. Lendo/Lidos/Quero ler vêm do progresso. |
| **Avaliação + resenha** | `book_reviews` (1 por pessoa por livro da galeria, nota 0,5–5 em passos de 0,5, título, texto, spoiler, visibilidade). Ao salvar vira um post `review` (curtir/comentar reaproveitados). |
| **Metas** | `reading_goals (user_id, year, target)`. |
| **Respostas** | `post_comments.parent_id` (1 nível). |
| **Notificações** | `notifications` geradas por triggers (seguir, pedido, aceite, curtida, comentário, resposta, curtida em resenha). Sem auto-notificação, sem duplicar (índice único). |
| **Denúncia** | `reports` (post, comentário, perfil). Quem denuncia deixa de ver o post. Admin oculta (`hidden_at`), apaga ou arquiva. |
| **Capa** | `profiles.cover_url` (bucket `avatars`, pasta própria). Sem capa, usa o banner. |

Visibilidade num lugar só: `can_view_profile(viewer, owner)` e `can_view_post(viewer, post)`.

## 4. Componentes novos

`UserListItem`, `FriendButton`, `RelationMenu` (bloquear/denunciar), `PostMenu`, `ReportDialog`, `RatingStars`, `ReviewCard`, `ReviewEditor`, `BookReviews`, `ReadingGoalCard`, `SocialBookshelf`, `ProfileTabs`, `NotificationBell`, `NotificationsPage`, `ConnectionsPage`, `RequestsPanel`, `DiscoverPeople`, `AdminReports`.

## 5. Componentes adaptados

`Feed` (amigos, tipos de atividade, editar, audiência, denunciar, respostas), `Composer` (audiência, livro da estante), `ProfileView` (capa, estatísticas, relação), `Community` (abas Geral/Seguindo/Amigos/Pessoas), `ProfileSection` (capa, compartilhamento, bloqueados), `GalleryBook` (avaliações), `Sidebar`/`NavBar` (sino), `Admin` (denúncias).

## 6. Fora do escopo (proibido pelo pedido)

Stories, vídeos, comunidades/grupos, fóruns, clubes, chat, lives, outro login.

## 7. Limitações conhecidas

- Resenha só para livro da galeria (EPUB enviado é cópia pessoal, sem página pública).
- Compartilhar trecho a partir do leitor ficou para depois, para não mexer no leitor (TTS, dicionário, seleção).
- Feed cronológico; visibilidade calculada por linha (bom para a escala atual, revisar com milhares de posts).
- Sem push nem e-mail (não há infraestrutura).
- Sem campo de idade: padrão conservador para todos (perfil fechado, compartilhamento desligado).
