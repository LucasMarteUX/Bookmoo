# ReadLingo – Arquitetura do banco Supabase

**Projeto:** `ywnmeacpvmcuhzhshpwz`  
**URL:** https://ywnmeacpvmcuhzhshpwz.supabase.co  
**Organização (MCP):** Redora

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
| comic_pages      | jsonb     | Opcional. Objeto `{ "0": "base64...", "1": "base64..." }` (índice → imagem base64) |
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

---

## Próximos passos (integração no app)

1. **Auth:** Usar Supabase Auth (email/senha ou OAuth); `auth.uid()` será o `user_id` em todas as tabelas.  
2. **Client:** Inicializar `@supabase/supabase-js` com a URL do projeto e a chave anon (ou service role conforme necessidade).  
3. **Sincronização:** Ao logar, carregar books, vocabulary, study_days e reader_settings para o usuário e preencher as stores (ou usar Supabase como fonte de verdade e substituir persist do Zustand por leitura/escrita na API).  
4. **Conversões:**  
   - `books.progress`: app usa 0–100, DB usa 0–1.  
   - `books.pinned_vocab_ids`: array de UUIDs em jsonb.  
   - `books.comic_pages`: objeto com chaves string (índice da página) e valor base64.

Com isso, o banco fica 100% alinhado ao ReadLingo e pronto para uso com Supabase Auth e cliente JS.
