# English Proficiency Test (prova de proficiência)

Documento de produto e técnico, de 17/11/2026. A prova avalia as 4 habilidades de forma completa e é exclusiva do plano
premium (Pro, configurável). Ela é **inspirada no formato público do TOEFL iBT 2026**, mas não é oficial, não é afiliada nem
certificada pela ETS e não tem equivalência oficial com nenhuma prova. Todas as questões são originais.

Ela convive com o **Teste de nível** (`docs/TESTE-DE-NIVEL.md`), que é outra coisa: curto, um por nível CEFR, serve para
confirmar ou promover o nível do app. A prova de proficiência não altera `placement_level`.

---

## 1. Visão geral

| | |
|---|---|
| Rotas | `/prova` (apresentação e histórico), `/prova/sessao` (tela cheia, fora do layout), `/prova/resultado/:id` (relatório), `/admin/prova` (admin) |
| Função | `supabase/functions/proficiency` (`index.ts` aluno, `admin.ts` admin) |
| Lógica pura | `supabase/functions/_shared/proficiency/` (`blueprint.ts`, `engine.ts`, `generate.ts`, `evaluate.ts`) |
| Testes | `deno test supabase/functions/_shared/proficiency/engine.test.ts` |
| Migração | `supabase/migrations/20261124000000_proficiency_test.sql` |
| Cliente | `src/lib/proficiencyApi.ts`, `src/lib/proficiencyAudio.ts` |
| Telas | `src/pages/proficiency/*`, `src/pages/AdminProficiency.tsx` |

Princípios:
1. **O servidor é a autoridade.** Monta a sessão, controla cronômetros e reproduções, corrige e decide o caminho
   adaptativo. Gabarito (`prof_items.answer`), roteiros de áudio (`script`) e notas nunca vão para o aparelho.
2. **Nada é gerado enquanto o aluno espera.** Questões e áudios são produzidos e aprovados antes de a versão ser publicada.
3. **Sem ajuda durante a prova:** sem dicas, feedback, tradução, dicionário ou IA; nenhuma nota antes do fim.
4. **Nota justa ou nenhuma:** quando falta evidência, a habilidade fica "inconclusiva" (seção 7).

---

## 2. Estrutura (blueprint `bp-2026.1`)

Fonte única: `_shared/proficiency/blueprint.ts`. Seções nesta ordem, sem escolha de nível nem de seção.

| Seção | Itens | Tempo | Tarefas |
|---|---|---|---|
| Reading | 50 | 30 min | Complete the Words (3 textos × 10 lacunas), Read in Daily Life (5 textos × 2 perguntas), Academic Passage (2 textos × 5 perguntas) |
| Listening | 47 | 29 min | Listen and Choose a Response (15), Conversation (6 × 2), Announcement (4 × 2), Academic Talk (3 × 4) |
| Writing | 12 | 23 min | Build a Sentence (10, 6 min no total), Write an Email (7 min), Academic Discussion (10 min) |
| Speaking | 11 | 8 min | Listen and Repeat (7 frases, gravação de 8 a 12 s, sem texto), Interview (4 perguntas, 45 s cada) |

São 12 tipos de tarefa. Uma "questão" no banco é uma unidade (um texto com 10 lacunas, uma conversa com 2 perguntas) e
`points` diz quantos itens pontuados ela vale.

**Módulos adaptativos (Reading e Listening):**

| Seção | Router (parte 1) | Segundo módulo (fácil ou difícil) |
|---|---|---|
| Reading | 1 CtW + 3 Daily Life + 1 Academic = 21 itens | 2 CtW + 2 Daily Life + 1 Academic = 29 itens |
| Listening | 8 Choose + 3 Conversas + 2 Anúncios + 1 Aula = 22 itens | 7 Choose + 3 Conversas + 2 Anúncios + 2 Aulas = 25 itens |

### 2.1 Regras de tempo

- Cronômetro **rígido e no servidor** (`prof_sessions.section_deadline`). O app só mostra o relógio, corrigido pela
  diferença de horário com o servidor.
- Router de Reading: 42% do tempo da seção; de Listening: 47%. O segundo módulo vai até o fim da seção.
- Writing e Speaking têm cronômetro por tarefa (`prof_session_items.deadline_at`), que começa quando a tarefa aparece
  (ação `open`). As 10 frases do Build a Sentence dividem um relógio só.
- Tolerância de rede de 8 s (`GRACE_MS`). Depois disso, `save` responde `time_up`.
- Tempo esgotado (mesmo com o app fechado): a função avança sozinha (`catchUp`) com o que estiver salvo.
- **Intervalo de instruções:** ao terminar uma seção, a próxima fica "pendente" por até 5 minutos para a pessoa ler a
  introdução. O cronômetro começa quando ela toca em "Começar" (ação `begin`) ou, no máximo, no fim desse intervalo.

### 2.2 Áudio

- Cada áudio toca **uma única vez**, sem controles e sem transcrição (formato oficial). A ação `audio` devolve uma URL
  assinada de 3 minutos e registra a reprodução em `plays`. Se o carregamento falhar, dá para pedir de novo em até 20 s;
  depois disso, `no_replays`.
- Em Listening, as perguntas aparecem depois do áudio. Em Speaking, a gravação começa sozinha depois de um sinal sonoro.

---

## 3. Fluxo do aluno

1. `/prova`: apresentação, estrutura, dinâmica, regras, escala, histórico. Quem não é premium vê "Disponível no plano Pro"
   e o convite de assinatura (`openPaywall('proficiency')`).
2. `/prova/sessao` → **Checagem:** consentimento de gravação (LGPD), som de teste (três notas) e microfone (grava 3 s e
   toca de volta). Sem os três, o botão não libera e o servidor recusa (`consent_required`, `checks_required`).
3. A prova abre em tela cheia. Barra fixa com seção, parte (1 de 2 / 2 de 2), progresso, "Salvo" e cronômetro (âmbar no
   último minuto). Só para frente: depois de avançar, não dá para voltar.
4. Entre seções: tela de transição com "Reading concluída", a próxima seção, itens, tempo e instruções. **Nenhuma nota.**
5. Fim do Speaking → "Avaliação em andamento" (consulta o resultado a cada 5 s) → relatório.
6. **Retomada:** se a conexão cair ou a pessoa sair, `/prova` mostra "Retomar a prova"; a checagem é refeita e a sessão
   continua da mesma posição (a posição dentro do módulo fica no `sessionStorage`). O relógio não para.

Salvamento automático: escolhas e lacunas salvam na hora; textos, 900 ms depois da última tecla; tudo é descarregado antes
de avançar. Colar e o corretor automático ficam desativados nos textos.

---

## 4. Motor adaptativo (modelo de dificuldade `pdm-1`)

Regras determinísticas (`engine.ts`):
- Itens têm `stage` (`router`, `easy`, `hard`, `any`) e `difficulty` (1 a 6). Faixas-alvo: router 2,5–4,5; fácil 1–3,5;
  difícil 3,5–6.
- Ao fechar o router, a função soma os acertos (`auto_score`) e aplica: **acertou ≥ 60% → módulo difícil; senão, fácil**.
- O caminho fica registrado em `prof_sessions.path[section].router` (`correct`, `total`, `pct`, `threshold`, `module`,
  `model`, `at`), junto com as versões de blueprint, dificuldade, rubrica e nota usadas.
- Sorteio: questões aprovadas da versão publicada, do estágio do módulo (cai para `any` se faltar), preferindo as que a
  pessoa nunca viu e nunca repetindo dentro da sessão.

---

## 5. Nota (versão `sc-1`)

Tudo no servidor (`scoreSession`, em segundo plano com `EdgeRuntime.waitUntil`; se travar, a próxima consulta reinicia;
depois de 4 tentativas a sessão fica `failed` e o admin pode recalcular).

| Habilidade | Cálculo da faixa (1–6, meios pontos) |
|---|---|
| Reading / Listening | `p = 0,4 × acerto no router + 0,6 × acerto no 2º módulo`. Fácil: `1 + 3p` (teto 4). Difícil: `2,5 + 3,5p`. |
| Writing | `1 + (0,3 × fração do Build a Sentence × 5 + 0,3 × e-mail + 0,4 × discussão)` (rubricas 0–5) |
| Speaking | `1 + (0,4 × precisão média do Listen and Repeat × 5 + 0,6 × entrevista)` |
| Geral | Média das quatro, arredondada a meio ponto. Só existe se nenhuma habilidade for inconclusiva. |

Correção objetiva:
- Lacunas: letras iguais, sem diferenciar maiúsculas e espaços.
- Múltipla escolha: índice igual ao gabarito. As opções são embaralhadas na criação para o gabarito não cair sempre na
  mesma letra.
- Build a Sentence: a ordem montada, normalizada, igual à resposta (ou a uma alternativa aceita).
- Listen and Repeat: `1 − WER` entre a frase e a transcrição do servidor (mesma função do ditado do teste de nível).

**Escala → CEFR (aproximação interna, sem equivalência oficial):** 6 = C2; 5–5,5 = C1; 4–4,5 = B2; 3–3,5 = B1; 2–2,5 = A2;
1–1,5 = A1.

---

## 6. Avaliação por IA (rubricas `rub-1`)

`_shared/proficiency/evaluate.ts`. Chave só da plataforma (`pickProvider`), 3 tentativas, respostas do aluno entre
marcadores e instrução para ignorar comandos escritos nelas.

- **Write an Email (0–5):** cumpre os 3 pontos pedidos, organização, tom e registro adequados ao destinatário, variedade e
  precisão. 0 = em branco, fora do tema, cópia do enunciado ou não está em inglês.
- **Academic Discussion (0–5):** contribuição relevante com ideia própria (não repetir os colegas), desenvolvimento com
  explicações ou exemplos, variedade e precisão.
- **Interview (0–5 por resposta):** cumpre a pergunta, desenvolvimento e coerência, variedade e precisão, fala sustentada
  (palavras por minuto e uso dos 45 s, a partir da transcrição). Pequenos erros do reconhecimento de fala não contam.

Cada avaliação grava em `prof_evaluations`: nota, critérios, justificativa em português citando as palavras do aluno,
trechos de evidência e status (`ok`, `insufficient`).

**Transcrição:** as gravações (`MediaRecorder`, webm/opus ou mp4 no Safari) vão para o bucket privado e são transcritas no
servidor (`gpt-4o-mini-transcribe`; reserva: Gemini). Assim a fala não pode ser digitada nem depende do reconhecimento do
navegador.

**Relatório:** um último prompt escreve, em português, um resumo geral e, por habilidade, resumo, pontos fortes, o que
melhorar e próximos passos, usando só os números por tipo de tarefa e as avaliações. Sem IA, entra um relatório de reserva
com os números. Toda página leva o aviso de não equivalência oficial.

**Memória do tutor:** o app envia o tutor escolhido (`useAvatarSettings.characterId`) ao iniciar; ele fica em
`prof_sessions.client.tutor`. Ao terminar a nota, `rememberProficiency` junta à `tutor_memory` desse tutor um resumo com
data, nota geral e por habilidade, um ponto a melhorar e um acerto por habilidade (`weaknesses`, `strengths`) e o tópico
"proficiency test", sem apagar o que ele já sabia. Assim a pessoa conversa depois sobre as dificuldades com contexto (a função
`conversation` lê essa tabela em `memoryBlock`). Uma falha aqui só vai para o log; a prova segue.

---

## 7. Avaliação inconclusiva

| Habilidade | Evidência mínima |
|---|---|
| Reading / Listening | Pelo menos 50% dos itens do caminho respondidos |
| Writing | Pelo menos 30 palavras nas tarefas abertas ou metade de tudo respondida |
| Speaking | Fala reconhecível em pelo menos 5 das 11 gravações |

Sem a evidência, a habilidade aparece como "Inconclusiva" (com o motivo) e a nota geral não é calculada.

---

## 8. Banco de questões

Fluxo: **geração → validação → revisão → aprovação → armazenamento** (`admin_generate`).

1. **Geração:** prompt por tipo de tarefa e estágio (`generationPrompt`), com nível-alvo, tamanho, tipos de pergunta e
   regras de originalidade e conteúdo sensível. Evita repetir os temas que já existem no banco.
2. **Validação estrutural** (`normalizeItem`): contagem de palavras, 4 opções distintas, gabarito válido, fragmentos que
   remontam a frase, 3 pontos no e-mail etc. As lacunas do Complete the Words são feitas pelo código (segunda metade de
   cada segunda palavra a partir da segunda frase), não pela IA.
3. **Revisão por IA** (`reviewPrompt`): outro prompt resolve as questões **sem o gabarito** e aponta ambiguidade, nível e
   viés. Se ele responder diferente do gabarito, a questão é rejeitada com o motivo.
4. **Aprovação humana** no admin (`review` → `approved` ou `rejected`). Só questões aprovadas entram na prova.
5. **Áudio:** no admin, aba Áudios, o navegador gera os áudios com as vozes do leitor (Kokoro), fala por fala, junta num WAV
   com pausas e envia ao bucket privado `proficiency-audio` por URL assinada (`admin_audio_upload` + `admin_audio_register`).
   As vozes são escolhidas pelo código (conversa: uma voz feminina e uma masculina). O hash do roteiro detecta áudio
   desatualizado depois de uma edição.
6. **Versões:** o banco pertence a uma versão. Publicar exige que o banco monte todos os caminhos (router + fácil e
   router + difícil, com áudio). A versão publicada fica congelada: lá só dá para aposentar uma questão. Para mudar, crie
   uma versão nova a partir da atual.

"Gerar banco inicial" gera o dobro do necessário em cada tipo e estágio que ainda falta.

---

## 9. Dados e segurança

Tabelas (todas com RLS, sem escrita pelo cliente):

| Tabela | Conteúdo | Leitura pelo aluno |
|---|---|---|
| `prof_versions` | versões do banco | não |
| `prof_items` | questões, gabarito, roteiro, validação, revisão | não |
| `prof_assets` | áudios pré-gerados | não |
| `prof_generations` | lotes de geração e custo | não |
| `prof_sessions` | sessões, caminho, prazos | só as próprias e colunas sem dados sensíveis |
| `prof_session_items` | questões servidas, prazos por tarefa, reproduções | não |
| `prof_responses` | respostas, caminho da gravação, transcrição | não (o estado volta pela função) |
| `prof_evaluations` | avaliações por IA | não |
| `prof_results` | resultado e relatório | só os próprios |

- Admin opera pela função (service role) depois de `is_admin`.
- Buckets privados `proficiency-audio` e `proficiency-recordings`, sem políticas para o cliente: só URLs assinadas e curtas.
- O caminho de cada gravação é conferido (`{user}/{sessão}/{item}-{parte}.ext`).
- Limite: 240 chamadas por minuto por pessoa (`rateLimit`), uma sessão ativa por pessoa (índice único), duas tentativas por mês do calendário no horário de Brasília (toda prova iniciada conta, inclusive abandonada; o selo fica com
  a maior nota do mês)
  (admin sem limite).
- Acesso: `app_settings.proficiency_min_plan_rank` (padrão 3 = Pro), editável no admin.

**LGPD:** consentimento explícito antes de começar (data em `consent_at`); gravações apagadas após 30 dias pelo admin
("Apagar gravações antigas") mantendo transcrição e nota; tudo é apagado em cascata com a conta.

**Custos:** toda chamada de IA passa por `measured` e vai para `ai_usage` com as operações `proficiency-generate` e
`proficiency-score` (transcrição incluída a US$ 0,003/min). O admin mostra os custos dos últimos 30 dias. O teto diário
global (`ai_daily_budget_usd`) também vale aqui.

---

## 10. Admin (`/admin/prova`)

- **Visão geral:** sessões, custo, versões (criar, criar a partir de outra, publicar, arquivar), cobertura do banco por tipo
  e estágio (necessário × aprovadas × em revisão × rejeitadas) e o que falta para publicar, plano mínimo e limpeza de
  gravações.
- **Questões:** filtros, conteúdo, gabarito, roteiro, problemas apontados pela revisão, ouvir o áudio, aprovar ou rejeitar
  (em lote).
- **Gerar:** por tipo, estágio e quantidade, ou o banco inicial completo.
- **Áudios:** lista do que falta e geração em lote no navegador.
- **Sessões:** pessoa, status, caminho adaptativo (módulo e % no router), nota, detalhes (respostas, transcrições,
  avaliações) e "Recalcular".

---

## 11. Ações da função `proficiency`

Aluno: `overview`, `start` (consentimento + checagens), `state`, `open`, `begin`, `save`, `audio`, `upload`, `advance`
(com a seção e o módulo esperados, para não pular duas partes num clique duplo), `result`, `abandon`.

Admin: `admin_overview`, `admin_version_create`, `admin_version_publish`, `admin_version_archive`, `admin_items`,
`admin_item_review`, `admin_item_update`, `admin_generate`, `admin_generations`, `admin_audio_todo`, `admin_audio_upload`,
`admin_audio_register`, `admin_audio_url`, `admin_sessions`, `admin_session`, `admin_rescore`, `admin_purge_recordings`,
`admin_settings`.

---

## 12. Como colocar no ar

1. Aplicar a migração `20261124000000_proficiency_test.sql` (com OK).
2. Publicar a função: `npx supabase functions deploy proficiency` (com OK).
3. No admin: criar a versão, "Gerar banco inicial", revisar e aprovar, gerar os áudios e publicar.
4. Publicar o app (push na `main`, com OK).

## 13. Limitações e decisões em aberto

- A entrevista funciona sem avatar (entrevistador neutro com áudio). O LivLiv pode entrar depois como camada visual.
- A fala é avaliada pela transcrição e pelo ritmo; pronúncia fina não é medida (o reconhecimento puxa sons ambíguos para a
  palavra provável).
- A limpeza de gravações é manual no admin; pode virar uma rotina agendada.
- A calibração (limiar de 60% e fórmulas das faixas) deve ser revista com dados reais; por isso cada sessão guarda as
  versões do modelo.

---

## 14. Nomes de nível, selo CEFR e telas premium (17/11/2026)

**Dois sistemas que não se confundem:**
- **Nível do aluno no Upoonly** (teste de nível, perfil, IA): Iniciante, Aprendiz, Praticante, Experiente, Expert, Lenda
  (em inglês Beginner, Apprentice, Practitioner, Seasoned, Expert, Legend). O código interno continua A1…C2
  (`src/lib/cefr.ts`: `levelName`, `levelTone`, `levelRank`). Cada nível tem uma cor pastel do tema.
- **Livros** continuam indicados por CEFR (A1…C2), com a descrição da faixa (Iniciante…Proficiente).
- **Selo CEFR da prova:** ao concluir uma prova com nota final, a função grava `profiles.proficiency_cefr`,
  `proficiency_band` e `proficiency_at` (migração `20261124000100_proficiency_seal.sql`, só o servidor grava). O selo
  (`CefrSeal`) aparece ao lado do nível na barra lateral, em Você e no perfil público (respeita `show_level`).

**Telas:**
- `/prova`: abertura com prévia do relatório (dados de exemplo rotulados), linha do tempo das seções proporcional ao
  tempo, dinâmica, entrevista com a Bia, regras, escala com CEFR e histórico com as quatro faixas. No celular, o botão
  principal fica fixo acima da barra de abas.
- Checagem com a Bia dando as boas-vindas; introdução de cada seção com a trilha das quatro seções, tempo, itens e as
  tarefas em cartões.
- Entrevista: a Bia (personagem 2.5D) faz as perguntas com a boca sincronizada ao áudio pré-gerado (`playClip` em
  `src/lib/tts.ts`), legenda de estado e progresso das quatro perguntas. Funciona com o avatar vetorial se o 2.5D falhar.
- Listening: se o navegador bloquear o áudio, a reprodução não é gasta e aparece "Tocar de novo".
- "Avaliação em andamento" (`ScoringWait`): tutor escolhido em estado "pensando", progresso estimado com tempo restante,
  as quatro etapas da correção, estado "na fila" quando a IA está sem cota (`result.queued`), "Continuar estudando" e
  "Treinar um ditado". O app avisa com um toast quando o relatório fica pronto (`ProficiencyReadyWatcher`, em qualquer tela).
- Relatório: capa com nome, foto, data, código `EPT-XXXXXXXX`, mostrador da faixa geral, selo CEFR e descrição do nível;
  cartões das habilidades; desempenho por tarefa; rubricas com as palavras da pessoa; escala; aviso de não equivalência.
  "Imprimir ou salvar PDF" usa `@media print` (A4, tema claro, sem menus, uma habilidade por página). Em desenvolvimento,
  `/prova/resultado/x?demo=1` mostra um relatório de exemplo para revisar o visual.
