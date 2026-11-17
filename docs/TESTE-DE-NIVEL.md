# Nível de inglês: onboarding, teste por nível e promoção

Documento de produto e técnico, de 17/11/2026. Ele descreve como a pessoa informa o nível no primeiro acesso, como confirma
esse nível num teste feito para o nível dela e como sobe de patamar. Antes da proposta, um retrato do que existe hoje.

---

## 1. Como está hoje (levantamento no código)

**Primeiro acesso (`ProtectedRoute` → `onboarding_step` em `user_accounts`):**

1. `/completar-cadastro`: data de nascimento e aceite dos termos (`complete_profile`). Menores de 12 anos registram o
   consentimento do responsável.
2. `/conhecendo-voce` (`SurveyPage` + `src/lib/survey.ts`): 7 perguntas, uma por tela, que podem ser puladas. As respostas
   vão para `user_surveys.answers` (função `save_survey`):
   - `reason`: por que aprender (trabalho, viagem, estudos, cultura, morar fora, prazer);
   - `self_level`: "como está seu inglês" (do zero, básico, me viro, converso com dificuldade, confortável);
   - `difficulty`: onde sente mais dificuldade (falar, ouvir, escrever, ler, vocabulário, gramática);
   - `tried_books`: já tentou ler em inglês;
   - `topics`: que tipo de história gosta (fantasia, aventura, romance, mistério, ficção científica, clássicos,
     infantis, história e biografias, desenvolvimento pessoal);
   - `daily_minutes`: quanto tempo por dia;
   - `how_found`: como conheceu.
3. `/planos?welcome=1`: escolha do plano.

**O que falta ou não está ligado:**

- **As respostas não são usadas no app.** `user_surveys` só é lido pelo admin (filtros e segmentação). Os gostos de leitura
  (`topics`) não geram recomendação, a meta diária não vira a meta do app, e a dificuldade não muda as atividades.
- **O nível do questionário não é CEFR e não é explicado.** "Me viro em situações simples" não diz se é A2 ou B1, e a
  resposta não grava nenhum nível.
- **Os gostos e as categorias da galeria não usam os mesmos nomes.** O questionário tem `scifi`, `kids`, `classics`,
  `history` e `selfhelp`; a galeria tem `children`, `classic`, `short`, `poetry`, `nonfiction` e `biography`. É preciso
  mapear (seção 3).
- **Três "níveis" convivem sem regra entre eles:**
  - `profiles.placement_level`: "o nível do teste", que só o servidor grava (trigger `profiles_guard`). Hoje fica sempre
    nulo, e a comunidade mostra A1 com `leveled = false`.
  - `profiles.english_level`: campo antigo.
  - `useStudyLevel()` no app: nível calculado por palavras salvas e pontos. É o que aparece na barra lateral e o que vai
    para a IA nas conversas.
- **Não existe tela de teste.** O texto do perfil diz "seu nível aparece como A1 até você fazer o teste de nivelamento,
  que vem em breve".
- **Não dá para esconder o nível na comunidade.** Existem as opções de mostrar estante, resultados, estudando e redes, mas
  não uma para o nível.

---

## 2. Princípios

1. **Quem diz o nível é a pessoa; quem confirma é o teste.** No onboarding ela escolhe um nível com a explicação de cada
   um. Esse nível vale na hora (IA, livros, atividades), com o selo "Pendente" até fazer o teste.
2. **Cada nível tem o seu teste.** Quem escolheu A1 faz o teste de A1, nunca um de C2. O teste confirma o nível,
   recomenda subir ou recomenda descer, sempre um degrau por vez.
3. **Subir é uma conquista.** Promoção tem animação e emblema no ID da pessoa. Descer é tratado com cuidado: é um ajuste
   para o aprendizado ficar confortável, e a palavra "rebaixar" nunca aparece.
4. **Quem começa do zero é bem-vindo.** O teste de A1 é curto, acolhedor e não reprova ninguém. Termina com um plano:
   tutores, leitura diária, palavras.
5. **A pessoa escolhe se mostra o nível na comunidade.** Por padrão mostra. Dá para desligar em Ajustes > Perfil.

---

## 3. Onboarding novo

### 3.1 Pergunta de nível (troca `self_level`)

Uma tela com os 6 níveis em cartões. Cada cartão tem o nome, uma frase do que a pessoa já consegue fazer e um exemplo. O
cartão tocado abre um "saiba mais" com 3 exemplos curtos. Há também a opção "Não sei, me ajude a escolher", que faz 3
perguntas rápidas e sugere um nível.

| Nível | Nome no app | Já consigo… | Exemplo |
|---|---|---|---|
| **A1** | Iniciante | Entender e usar palavras e frases muito simples: me apresentar, dizer de onde sou, números, cores. | "Hi, my name is Ana. I am from Brazil." |
| **A2** | Básico | Falar de rotina, família, compras e trabalho em frases curtas; entender frases do dia a dia ditas devagar. | "I usually wake up at seven and take the bus to work." |
| **B1** | Intermediário | Me virar numa viagem, contar uma experiência, dar uma opinião simples e entender o principal de conversas claras. | "Last year I went to Chile and the food was amazing because…" |
| **B2** | Intermediário superior | Conversar com fluidez com nativos, defender um ponto de vista, entender séries e textos com algum esforço. | "I see your point, but I'd argue that remote work actually…" |
| **C1** | Avançado | Usar o inglês no trabalho e nos estudos com flexibilidade, entender textos longos e sentidos implícitos. | "It's not so much the cost as the hidden trade-offs that worry me." |
| **C2** | Proficiente | Entender praticamente tudo e me expressar com precisão e nuance, como um nativo instruído. | "Her remark was tongue-in-cheek, yet it struck a nerve." |

"Não sei, me ajude a escolher" faz 3 perguntas com áudio curto e sugere um nível:
1. Ouvir uma frase e escolher o que ela quer dizer.
2. Ler uma frase e escolher a continuação.
3. "Quanto você entende de uma série em inglês sem legenda?"

**O que acontece ao salvar:**
- O nível vai para um campo novo, `profiles.declared_level`.
- A pessoa passa a ter nível `A1…C2` com o estado `pending`, e o selo "Pendente" aparece no perfil e na aba "Teste seu
  inglês".

### 3.2 Gostos de leitura → estante "De acordo com seu gosto"

**Mapeamento do questionário para as categorias da galeria:**

| Questionário (`topics`) | Galeria (`category`) |
|---|---|
| fantasy | fantasy |
| adventure | adventure |
| romance | romance |
| mystery | mystery |
| classics | classic |
| kids | children |
| history | biography, nonfiction |
| selfhelp | nonfiction |
| scifi | adventure, fantasy (até existir a categoria `scifi`) |

**Na Galeria e na Home:** uma fileira "De acordo com seu gosto". A ordem dos livros:
1. Livros das categorias escolhidas, no nível da pessoa ou um abaixo.
2. Dentro disso, primeiro os indicados para a idade dela (`age_min`), depois os mais recentes.

A fileira some se a pessoa não respondeu (ou pulou) a pergunta.

**Os gostos também aprendem com o uso.** As categorias dos livros que a pessoa abre e termina somam peso às escolhidas.
Esse mesmo sinal alimenta as frases de espera dos tutores ("vi que você gosta de aventura").

**Onde editar:** Ajustes > Perfil > "Meus gostos de leitura". São as mesmas opções, e a fileira se refaz.

### 3.3 Outras respostas que passam a ser usadas

- **`daily_minutes`**: vira a meta de hoje da Home (5, 10, 20 ou 30 min).
- **`difficulty`**: ordena as atividades sugeridas. Quem marca "falar" vê Conversar e Falar primeiro; quem marca "ouvir"
  vê o Ditado primeiro.
- **`reason`**: escolhe os temas das primeiras cenas. Trabalho leva a reunião e entrevista; viagem leva a aeroporto e
  hotel.

---

## 4. Modelo de nível

### 4.1 Estados

| Estado | Quando | Selo no perfil |
|---|---|---|
| `pending` | Escolheu o nível no onboarding e ainda não fez o teste | Nível + "Pendente" (contorno tracejado, cinza) |
| `verified` | Passou no teste do nível (ou foi promovida pelo teste) | Nível + marca de verificado (preenchido) |
| `review` | Ficou abaixo do esperado e aceitou ou recusou o ajuste; pode refazer | Nível + "Em revisão" |

**O nível que vale no app inteiro:** `placement_level` quando existe, senão `declared_level`. É ele que vai para a IA,
recomenda livros e escolhe as cenas.

**Pontos e palavras deixam de definir o nível.** Hoje `useStudyLevel()` faz isso; passa a ser o **progresso dentro do
nível**, uma barra "até o teste do próximo nível". Quando a barra enche, o app convida para o teste de promoção.

### 4.2 Dados (migração nova)

```sql
-- profiles
declared_level text check (declared_level in ('A1','A2','B1','B2','C1','C2')),
level_state text not null default 'pending' check (level_state in ('pending','verified','review')),
level_verified_at timestamptz,
show_level boolean not null default true,          -- privacidade: mostrar nível na comunidade
level_emblems text[] not null default '{}',        -- emblemas conquistados ('A1','A2',...)
-- placement_level continua só gravável pelo servidor (profiles_guard)

-- tentativas de teste
create table public.placement_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null,                    -- nível do teste aplicado
  kind text not null check (kind in ('confirm','promotion','review')),
  status text not null default 'active' check (status in ('active','scored','abandoned')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  items jsonb not null,                   -- itens sorteados (ids do banco), sem as respostas esperadas no cliente
  answers jsonb not null default '{}',    -- transcrições, tempos, confiança do STT
  scores jsonb,                           -- por habilidade: speaking, listening, interaction
  total numeric,                          -- 0..100
  outcome text check (outcome in ('confirmed','promote','step_down','retry'))
);
-- RLS: a pessoa lê as próprias tentativas; só a função do servidor grava.

-- histórico de nível (linha do tempo do perfil)
create table public.level_history (
  user_id uuid references auth.users(id) on delete cascade,
  at timestamptz default now(),
  from_level text, to_level text,
  reason text check (reason in ('declared','test_confirmed','test_promoted','step_down','manual_admin'))
);
```

- **Comunidade:** `profile_view` passa a respeitar `show_level`. Com ele desligado, o nível não aparece para os outros, mas
  a pessoa continua vendo o próprio.
- **Admin:** pode corrigir o nível (`manual_admin`) e ver as tentativas.

---

## 5. O teste

### 5.1 Formato (igual em todos os níveis, conteúdo diferente)

Leva de 8 a 12 minutos, em três partes, com os tutores do app conduzindo:

| Parte | O que a pessoa faz | Mede | Como pontua |
|---|---|---|---|
| **1. Fala** (3 itens) | (a) Lê em voz alta 2 frases do nível. (b) Responde por voz uma pergunta do nível ("Tell me about your morning"). | Pronúncia, fluência, vocabulário | STT: palavras corretas em relação ao texto (a), confiança e ritmo (palavras por minuto, pausas). Para (b), o LLM avalia com a rubrica do nível. |
| **2. Ditado** (4 a 6 itens) | Ouve frases (voz do tutor, 2 vezes, pode pedir mais devagar) e escreve. | Compreensão auditiva, ortografia | Taxa de erro por palavra (WER) com tolerância a pontuação, maiúsculas e erros de digitação leves. |
| **3. Conversa** (3 a 4 min) | Conversa por voz com um tutor sobre um tema do nível, como numa cena curta. | Interação, gramática, compreensão | Rubrica do nível aplicada pelo LLM à transcrição: cumpriu as tarefas? Entendeu? Precisão e alcance. |

**Pontuação:**
- Cada parte vale de 0 a 100 e o total é a média ponderada: Fala 35%, Ditado 25%, Conversa 40%.
- Uma parte abaixo de 40 limita o resultado a "confirmado". Ninguém é promovido sendo muito fraco numa habilidade.

### 5.2 Cada nível tem o seu teste (exemplos de conteúdo)

| Nível | Fala (leitura / pergunta) | Ditado | Conversa (tarefa) | Promoção se… |
|---|---|---|---|---|
| **A1** | "My name is Leo. I like cats." / "What is your name? Where are you from?" | 3 a 6 palavras: "I have two brothers." | Se apresentar, dizer idade, cidade, o que gosta. | Total ≥ 85 e Conversa ≥ 80 |
| **A2** | "Yesterday I went to the market with my mother." / "What do you do on weekends?" | 6 a 10 palavras, passado simples | Pedir comida, falar da rotina, contar o que fez ontem. | Total ≥ 85 e Conversa ≥ 80 |
| **B1** | Parágrafo curto narrativo / "Tell me about a trip you enjoyed." | 10 a 14 palavras, conectores | Contar uma experiência, dar opinião e justificar, resolver um problema simples (hotel). | Total ≥ 85 e Conversa ≥ 82 |
| **B2** | Texto opinativo / "Should cities ban cars downtown? Why?" | 12 a 18 palavras, phrasal verbs, ritmo natural | Debater, concordar ou discordar com nuance, hipóteses ("if I had…"). | Total ≥ 87 e Conversa ≥ 85 |
| **C1** | Texto abstrato / "What makes a good leader?" | Velocidade natural, expressões idiomáticas | Argumentar, reformular, lidar com interrupções e ironia leve. | Total ≥ 90 e Conversa ≥ 88 |
| **C2** | Texto literário ou técnico / pergunta aberta complexa | Fala rápida, sotaques variados | Nuance, registro (formal e informal), humor, precisão. | Não há promoção: o teste confirma C2 ou sugere C1 |

**Banco de itens:**
- Cerca de 30 itens por parte e por nível, com sorteio por tentativa (não repete itens da tentativa anterior).
- As frases do ditado e da leitura seguem a lista de vocabulário e gramática de cada nível (CEFR / English Vocabulary
  Profile).
- Os temas da conversa podem usar os gostos da pessoa (seção 3.2) para soar natural.

### 5.3 Resultado

| Resultado | Regra | O que a pessoa vê |
|---|---|---|
| **Confirmado** | 55 ≤ total < limite de promoção | "Seu nível A2 está confirmado!" + selo verificado + plano de estudo + barra até o próximo nível |
| **Promoção sugerida** | Atingiu o limite de promoção | "Você foi muito bem. Parece que seu nível é maior: quer fazer o teste de B1 agora?" Faz o teste do nível de cima na sequência (ou depois); passando nele, sobe com animação. |
| **Ajuste sugerido** | total < 55 (com Conversa < 50) | "Vamos ajustar para A1 para você aprender com mais conforto?" [Ajustar] [Manter e treinar]. Se manter, fica em `review` e pode refazer em 3 dias. |
| **Incompleto** | Saiu antes de terminar | Nada muda. Pode retomar em até 24 h, ou recomeçar com outros itens. |

**Quem chega no A1 e diz "não sei nada":**
- O teste de A1 nunca dá "ajuste" (não há nível abaixo). Mesmo com total baixo, o resultado é "Confirmado A1: vamos
  começar!".
- Em seguida vem um plano acolhedor:
  - conversa curta com a Yuno ou o Yuri no esforço "Super iniciante";
  - um livro infantil da galeria;
  - 5 palavras por dia.

### 5.4 Promoção, animação e emblema

- **Promoção** só acontece passando no teste do nível de cima. Pontos e palavras apenas liberam o convite.
- **Animação** (curta, sem gradiente, respeitando o tema claro e escuro e "reduzir movimento"):
  1. O selo antigo encolhe.
  2. O novo nível entra com um brilho rápido em anel.
  3. Aparece "Você agora é B1 · Intermediário".
  4. O tutor da última conversa aparece com o gesto de abertura e diz uma frase de parabéns.
- **Emblema simples** no ID da pessoa: um círculo com o código do nível (A2, B1…), uma cor discreta por patamar e a marca
  de verificado. Fica no avatar do perfil, na comunidade (se `show_level` estiver ligado) e no cartão de perfil. Os
  emblemas conquistados ficam numa linha do tempo no perfil (`level_emblems` + `level_history`).

### 5.5 Regras de repetição e antifraude

- **Intervalos:**
  - teste de confirmação: no máximo 1 a cada 3 dias;
  - teste de promoção: liberado na hora após uma confirmação acima do limite, ou quando a barra de progresso enche;
  - depois de reprovar na promoção, 7 dias.
- **Itens:** sorteados no servidor, e as respostas esperadas nunca vão para o cliente. Áudio do ditado gerado no servidor
  ou com texto oculto até a resposta.
- **Fala:** a conversa usa o mesmo STT do app. Respostas coladas ou instantâneas demais (texto sem áudio, tempo
  impossível) invalidam o item.
- **Créditos:** o teste de confirmação é gratuito, uma vez por nível. Testes extras de promoção podem consumir créditos
  como uma conversa.

---

## 6. Telas

1. **Onboarding › "Qual é o seu nível?"**: cartões A1 a C2 com explicação e "Não sei, me ajude".
2. **Onboarding › "Que histórias você gosta?"**: já existe; passa a alimentar a fileira "De acordo com seu gosto".
3. **Aba "Teste seu inglês"** (Praticar e perfil):
   - estado atual (selo Pendente, Verificado ou Em revisão);
   - botão "Fazer o teste de A2" e o que esperar ("10 minutos, fala, ditado e conversa");
   - histórico de tentativas.
4. **Teste**: barra de progresso com 3 etapas, tutor no palco, áudio com repetir e "mais devagar". O microfone fica
   fechado enquanto o tutor fala (como já é no celular).
5. **Resultado**: nota por habilidade (barras simples), frase do tutor, ação principal conforme o resultado (seção 5.3) e
   o plano de estudo.
6. **Promoção**: animação (seção 5.4) e o emblema novo.
7. **Ajustes › Perfil**:
   - "Mostrar meu nível na comunidade" (ligado por padrão);
   - "Meus gostos de leitura";
   - nível atual, com link para o teste.

---

## 7. Integração com o que já existe

- **IA (função `conversation`):** recebe o nível vigente (`placement_level` ou `declared_level`) e o esforço dentro dele
  (já implementado). `learnerProfile` passa a ler esses dois campos; o app para de mandar o nível calculado por pontos.
- **Tutores:** as frases de espera mencionam o teste quando o selo está "Pendente" ("Bora descobrir seu nível
  verdadeiro?"). Depois de uma promoção, parabenizam com a personalidade de cada um.
- **Livros:** galeria e "De acordo com seu gosto" filtram pelo nível vigente (e um abaixo). A tradução pronta (`showsGloss`)
  continua só no A1.
- **Barra lateral:** mostra o nível vigente, o selo e a barra "até o próximo teste" (antes: nível por palavras e pontos).
- **Comunidade:** `profile_view` e as listas de pessoas respeitam `show_level`.

---

## 8. Função do servidor (`placement`)

Uma Edge Function nova, para não inchar `conversation`:

- `start { level, kind }`: valida os intervalos, sorteia os itens, cria `placement_attempts` e devolve os itens sem as
  respostas.
- `speak-item { attemptId, itemId, transcript, confidence, durationMs }`: guarda; a leitura em voz alta é pontuada na
  hora.
- `dictation-item { attemptId, itemId, text }`: compara com o gabarito (WER) e guarda.
- `conversation-turn { attemptId, text }`: reaproveita o motor da conversa com o prompt de examinador do nível
  (`placementPrompt(level, tasks)`), que conduz as tarefas e não corrige durante.
- `finish { attemptId }`: o LLM aplica a rubrica do nível à conversa e à resposta aberta. A função calcula o total e o
  resultado; se for promoção confirmada, grava `placement_level`, `level_state`, `level_history` e `level_emblems`.

**Segurança:** RLS em tudo, gabarito só no servidor, limite de tentativas por dia e entrada limpa (`clean`) como no
restante.

---

## 9. Ordem de entrega sugerida

> **Etapa 1 implementada (17/11/2026):** pergunta de nível A1–C2 com explicação e "Não sei, me ajude" (3 perguntas),
> `profiles.declared_level` e `level_state` (migração `20261122000000_declared_level.sql`, gravado por `save_survey`),
> nível declarado valendo no app inteiro (`useLevelStore` + `useStudyLevel`: barra lateral, Você, IA, livros), fileira
> "De acordo com seu gosto" na Galeria e na Home (`src/lib/tastes.ts`, aprende também com os livros da estante) e a meta
> diária vinda do questionário. A função `conversation` também lê `declared_level`.

1. **Onboarding:** tela de nível com explicação (`declared_level`, selo Pendente), mapeamento dos gostos, fileira "De
   acordo com seu gosto" e `daily_minutes` virando a meta.
2. **Privacidade e perfil:** `show_level`, selo no perfil e na comunidade, aba "Teste seu inglês" com o estado.
3. **Teste A1 e A2** completos (banco de itens, função `placement`, resultado, plano). Ver na prática como a pessoa usa.
4. **Promoção:** animação, emblema e linha do tempo; barra de progresso até o próximo teste.
5. **Testes B1 a C2** e o ajuste de nível.
6. **Métricas:** taxa de conclusão do teste, distribuição de níveis declarados × verificados, promoções por mês, retenção
   após o teste.

---

## 9.1 Estado da implementação (17/11/2026)

Implementado e publicado no Supabase (app ainda não publicado na Vercel; marcado "Em progresso" no menu):
- Migrações `20261123000000_placement_tests.sql` e `20261123000100_community_profile_level.sql`: `placement_attempts`
  (gabarito sem leitura pelo cliente), `level_history`, `level_emblems`, `level_verified_at`, `show_level` e o nível
  escondido na comunidade.
- Função `placement` (`start`, `read`, `open`, `dictation`, `turn`, `finish`, `status`, `step_down`), banco de itens
  `_shared/placementBank.ts` e nota `_shared/placementScore.ts` (testes: `deno test supabase/functions/_shared/placementScore.test.ts`).
  Se a IA de correção não responder (3 tentativas), o teste não recebe nota: a tentativa fica aberta e a tela oferece
  "Tentar calcular de novo".
- Tela `/teste-de-nivel` (`PlacementPage`), selo `LevelStatusBadge`, `Emblem`, animação de promoção, opção "Meu nível de
  inglês" em Ajustes › Perfil, entradas no menu (desktop e celular).
- Testado ponta a ponta: confirmação A1 (nota 77, selo verificado, emblema, histórico) e promoção A2 com animação.

Limitações conhecidas: o texto do ditado vai ao aparelho (a voz local precisa dele); respostas digitadas valem menos
(leitura no máximo 50, pergunta aberta × 0,8, conversa até −15%).

## 10. Decisões em aberto

- **Teste gratuito:** só a confirmação ou também a primeira promoção?
- **Nota por habilidade:** mostrar números ou só "forte / em desenvolvimento"?
- **Confirmação no A1:** quem se declarou A1 faz o teste no primeiro dia ou só depois de uma semana de uso (para não
  assustar)?
- **Admin:** poder liberar o teste antes do intervalo (suporte)?
