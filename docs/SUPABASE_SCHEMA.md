# ReadLingo – Arquitetura do banco Supabase

**Projeto:** substitua pelo ref do seu projeto no Dashboard (ex.: `SEU-PROJETO`)
**URL:** `https://SEU-PROJETO.supabase.co`

## Visão geral

O banco está alinhado ao modelo de dados do app (Zustand). Todas as tabelas usam **RLS** com políticas por `user_id = auth.uid()`.

---

## Tabelas

### 1. `public.books`

| Coluna           | Tipo      | Descrição |
|------------------|-----------|-----------|
| id               | uuid (PK) | Identificador do livro |
| user_id          | uuid (FK → auth.users) | Dono do livro |
| title            | text      | Título |
| content          | text      | Texto completo (compatibilidade) |
| pages            | jsonb     | Array de strings (conteúdo por página). Default `[]` |
| current_page     | integer   | Índice da página atual. Default 0 |
| progress         | numeric   | Progresso 0–1 (no app: 0–100; converter ao sincronizar) |
| last_read        | timestamptz | Última leitura |
| word_count       | integer   | Total de palavras. Default 0 |
| comic_pages      | jsonb     | Opcional. Objeto `{ "0": "url ou base64", "1": "..." }`. Preferir URLs do Storage (bucket `comic-pages`) para evitar limite de tamanho. |
| comic_style_doc  | jsonb     | Opcional. Estilo da primeira página (cores, traços, estética, fontes) para consistência. |
| comic_characters | jsonb     | Opcional. Array de `{ name, visualDescription, firstPage? }` para personagens documentados. |
| pinned_vocab_ids | jsonb     | IDs de vocabulário fixados na barra lateral. Default `[]` |
| created_at       | timestamptz | |
| updated_at       | timestamptz | |

**Constraint:** `progress >= 0 AND progress <= 1`.

---

### 2. `public.vocabulary`

| Coluna     | Tipo      | Descrição |
|------------|-----------|-----------|
| id         | uuid (PK) | |
| user_id    | uuid (FK → auth.users) | |
| book_id    | uuid (FK → public.books.id) | Livro de origem |
| text       | text      | Palavra ou frase |
| type       | text      | `'word'` \| `'phrase'` \| `'sentence'` |
| status     | text      | `'learned'` \| `'review'` \| `'important'`. Default `'review'` |
| explanation| text      | Definição/explicação |
| examples   | jsonb     | Array de strings. Default `[]` |
| grammar_examples | jsonb | Exemplos estruturados nas formas afirmativa, negativa e interrogativa |
| usage_note | text | Nota curta de uso gramatical |
| variant_story | text | História paralela gerada para fixação do termo |
| audio_data | text      | Opcional. Áudio em base64 |
| created_at | timestamptz | |

---

### 3. `public.study_days`

Tempo de estudo por dia (em segundos).

| Coluna  | Tipo      | Descrição |
|---------|-----------|-----------|
| user_id | uuid (PK, FK → auth.users) | |
| date    | date (PK) | Dia (YYYY-MM-DD) |
| seconds | integer   | Segundos estudados nesse dia. Default 0 |

**Tempo total:** `SUM(seconds)` sobre `study_days` para o usuário.

---

### 4. `public.reader_settings`

Uma linha por usuário (PK = `user_id`).

| Coluna          | Tipo      | Descrição |
|-----------------|-----------|-----------|
| user_id         | uuid (PK, FK → auth.users) | |
| theme           | text      | `'light'` \| `'sepia'` \| `'dark'`. Default `'light'` |
| font_size       | integer   | 10–48. Default 18 |
| line_height     | numeric   | 1–3. Default 1.8 |
| show_highlights | boolean   | Default true |
| playback_rate   | numeric   | Velocidade TTS 0.5–2. Default 1 |
| voice_gender    | text      | `'female'` \| `'male'`. Default `'female'` |
| updated_at      | timestamptz | |

---

## Mapeamento App ↔ Supabase

| App (Zustand) | Supabase |
|---------------|----------|
| **useBookStore** | |
| Book.id | books.id |
| Book.title | books.title |
| Book.content | books.content |
| Book.pages | books.pages (jsonb) |
| Book.currentPage | books.current_page |
| Book.progress (0–100) | books.progress (0–1): `progress_db = progress_app / 100` |
| Book.lastRead (ms) | books.last_read (timestamptz) |
| Book.wordCount | books.word_count |
| Book.comicPages | books.comic_pages (jsonb; chaves numéricas como string) |
| Book.comicStyleDoc | books.comic_style_doc (jsonb) |
| Book.comicCharacters | books.comic_characters (jsonb array) |
| Book.pinnedVocabIds | books.pinned_vocab_ids (jsonb array) |
| **useVocabularyStore** | |
| Vocabulary.* | vocabulary.* (bookId → book_id, createdAt → created_at) |
| **useStudyStore** | |
| totalStudyTime | Soma de study_days.seconds |
| dailyStudyTime[date] | study_days.seconds por (user_id, date) |
| **useReaderSettings** | |
| theme, fontSize, lineHeight, showHighlights | reader_settings.* |
| playbackRate, voiceGender | reader_settings.playback_rate, reader_settings.voice_gender |

---

## Migrações aplicadas

1. `lexis_tables` – Criação das tabelas iniciais  
2. `lexis_functions_and_triggers` – Funções e triggers  
3. `lexis_rls` – Políticas RLS (select/insert/update/delete por user_id)  
4. `add_books_pinned_vocab_ids` – Coluna books.pinned_vocab_ids  
5. `add_reader_settings_playback_and_voice` – Colunas reader_settings.playback_rate e voice_gender  
6. `add-comic-docs` (scripts/add-comic-docs.sql) – Colunas books.comic_style_doc e books.comic_characters  
7. `ensure-books-schema` (scripts/ensure-books-schema.sql) – Garante todas as colunas de books (pages, comic_*, author, context, description, total_pages, language_code, cover_data, etc.). Execute uma vez no SQL Editor.

---

## Storage (quadrinhos)

- **Bucket:** `comic-pages` (público, para leitura das imagens).
- **Caminho:** `{user_id}/{book_id}/{page_index}.jpg`
- **Criação:** `node scripts/create-comic-bucket.mjs` (usa SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local). Assim as imagens são persistidas no Storage e no `books.comic_pages` ficam apenas as URLs, evitando falha de sync por tamanho do JSONB.

---

## Próximos passos (integração no app)

1. **Auth:** Usar Supabase Auth (email/senha ou OAuth); `auth.uid()` será o `user_id` em todas as tabelas.  
2. **Client:** Inicializar `@supabase/supabase-js` com a URL do projeto e a chave anon (ou service role conforme necessidade).  
3. **Sincronização:** Ao logar, carregar books, vocabulary, study_days e reader_settings para o usuário e preencher as stores (ou usar Supabase como fonte de verdade e substituir persist do Zustand por leitura/escrita na API).  
4. **Conversões:**  
   - `books.progress`: app usa 0–100, DB usa 0–1.  
   - `books.pinned_vocab_ids`: array de UUIDs em jsonb.  
   - `books.comic_pages`: objeto com chaves string (índice) e valor URL (Storage) ou base64 (fallback).

Com isso, o banco fica 100% alinhado ao ReadLingo e pronto para uso com Supabase Auth e cliente JS.
