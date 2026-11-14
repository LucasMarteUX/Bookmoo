# Plano — Planos, créditos de IA, acesso e cobrança

> Data: 2026-11-14 · Status: proposta para aprovação · Nome do app/domínio: **a definir** (usado aqui como "Bookmoo")

Este documento fecha a lógica de monetização: planos, créditos de IA, travas de rotas e recursos, primeiro acesso, pagamento (Zouti), Resend, login com Google, painel financeiro e as correções pendentes. A regra de ouro de tudo abaixo: **o front só mostra; quem decide é o servidor** (edge functions + RLS). Nenhuma trava pode depender só da interface.

---

## 0. Resumo das decisões

| Tema | Decisão |
|---|---|
| Chave de IA | Acaba o "conecte sua chave". Todas as chamadas usam a chave da plataforma (secret `OPENAI_API_KEY` nas edge functions). |
| Moeda interna | **Créditos de IA**. Cada operação custa um número fixo de créditos. Pool mensal, reseta, **não acumula**. |
| Plataforma | **Só web por enquanto** (PWA, pensada mobile-first). Apps de loja (iOS/Android) depois, no **mesmo backend**, cobrando pela Apple/Google (seção 6.5). |
| Plano grátis | **Grátis**: 1 livro-presente da galeria (cartão-presente animado), 3 páginas ilustradas/mês, explicações mais liberadas, 1 conversa de 3 min/mês, sem importar EPUB/PDF. |
| Planos pagos | **Essencial · Plus · Pro**. A partir do Essencial, **biblioteca completa liberada** + importação EPUB/PDF. Plus e Pro somam Análise de perfil com IA, Histórias de reforço, Conversa por voz e Cenas. |
| Medidas de uso | **Créditos de IA** (imagens e textos) e **minutos de conversa** (voz), separados para o usuário entender o que tem. |
| Cache compartilhado | O que já foi gerado por alguém (explicação de palavra, página no estilo padrão da galeria) **não custa crédito**. Só gera custo e crédito o que é novo. |
| Gateway | Zouti, confirmação **só por webhook** (o retorno do checkout nunca libera nada sozinho). |
| Upgrade | Imediato, novo ciclo começa no dia do upgrade, desconto proporcional ao que sobrou do plano anterior. |
| Downgrade / cancelamento | Vale no fim do ciclo pago. Sem reembolso parcial (exceto direito de arrependimento de 7 dias). |
| Admin | Novo painel financeiro: receita, custo de API, margem, por plano/operação/usuário. |

---

## 1. Correções imediatas (Fase 0)

### 1.1 Botão "Voltar" de FAQ / Privacidade / Termos não funciona
**Causa** (`src/pages/legal/LegalPage.tsx:139`): o botão usa `navigate(-1)` quando `history.length > 1`. Isso falha em três casos reais:
- Os links do Login e da Home abrem em **nova aba** (`target="_blank"` em `Login.tsx:258-262` e `Dashboard.tsx:617`). A nova aba não tem para onde voltar.
- As abas internas Termos/Privacidade/FAQ empilham histórico, então "Voltar" fica alternando entre elas.
- Quem chega do site externo (landing) volta para o site, e não para o app — ou o contrário do esperado.

**Correção:**
1. Destino explícito em vez de histórico: logado → `/` (ou a rota de origem em `location.state.from`); deslogado → `/login`.
2. Links entre Termos/Privacidade/FAQ com `replace` para não empilhar histórico.
3. Tirar `target="_blank"` dos links internos (no app iOS isso abre o Safari). Se quiser manter nova aba no cadastro (para não perder o formulário), salvar o rascunho do formulário em `sessionStorage` e abrir na mesma aba.
4. Se a página foi aberta com `?from=site` (link da landing), o botão vira "Voltar ao site" e aponta para a URL da landing.

### 1.2 Foto de perfil não aparece no sidebar
**Causa:** o `Sidebar.tsx` (linhas 75, 88, 158, 253) **nunca lê a foto** — sempre desenha a inicial do e-mail. A foto é salva certinho em `user_metadata.avatar_url` e em `profiles.avatar_url` (`ProfileSection.tsx:93-94`).

**Correção:**
1. Trocar os três `<span>{initial}</span>` pelo componente `Avatar` já existente (`src/components/ui/avatar.tsx`) com `src={user.user_metadata.avatar_url}` e fallback na inicial.
2. Depois de salvar a foto, chamar `supabase.auth.refreshSession()` (ou expor `refreshUser()` no `AuthContext`) para o sidebar atualizar na hora, sem recarregar.
3. Mesmo ajuste na TabBar/NavBar mobile se houver avatar ali.
4. Usuários que vierem do Google: usar `user_metadata.picture` como fallback.

---

## 2. Planos

### 2.1 Nomes (tradicionais)

**Grátis · Essencial · Plus · Pro.** O selo **"Premium"** nos livros e recursos travados significa "disponível em qualquer plano pago" (não é nome de plano, para não confundir).

### 2.2 Preços, créditos e minutos (proposta)

| Plano | Preço/mês | Créditos de IA/mês | Minutos de conversa/mês | Na prática (aprox.) |
|---|---|---|---|---|
| Grátis | R$ 0 | 60 (com tetos, ver 3.2) | 3 min (1 conversa) | 3 páginas ilustradas + ~30 explicações |
| Essencial | **R$ 24,90** | 200 | 30 min | ~15 páginas + ~50 explicações · ~8 conversas de 3–5 min |
| Plus ⭐ | **R$ 44,90** | 450 | 120 min | ~35 páginas + ~100 explicações · ~30 conversas |
| Pro | **R$ 89,90** | 900 | 300 min | ~70 páginas + ~200 explicações · ~60 conversas |

A conversa usa **só a pilha que já existe** (seção 17): reconhecimento de fala no aparelho, IA de texto que já usamos e voz Kokoro/VoiceStudio. Sem API de voz em tempo real. Por isso o minuto custa pouco e dá para ser generoso.

Créditos e minutos seguem a mesma regra: **pool mensal, reseta, não acumula**. Plano anual (fase posterior): 2 meses grátis, créditos e minutos continuam mensais (concedidos todo mês na data de aniversário).

### 2.2.1 Benefícios de cada plano (texto da tela de planos)

**Grátis — R$ 0**
- Leitura com áudio, vocabulário, prática de fala e ditado, comunidade
- 🎁 1 livro da galeria de presente, seu para sempre
- 3 páginas ilustradas por IA por mês
- ~30 explicações de palavras por mês
- 1 conversa de 3 minutos por mês para experimentar as Cenas

**Essencial — R$ 24,90/mês**
- Tudo do Grátis
- 📚 **Biblioteca completa** da galeria liberada
- 📥 Importar EPUB e PDF (até 20 livros)
- ✨ 200 créditos de IA por mês (imagens, explicações, histórias, mosaico)
- 🎨 Estilo de ilustração próprio, editar e redesenhar páginas
- 🗣️ 30 minutos de Conversa e Cenas por mês (Cenas prontas da biblioteca)
- Feedback com nota ao final de cada conversa

**Plus — R$ 44,90/mês** ⭐ *Mais escolhido*
- Tudo do Essencial
- ✨ 450 créditos de IA por mês
- 📥 Importar até 100 livros
- 🧠 **Análise avançada do perfil com IA**: relatório das suas dificuldades, atualizado toda semana
- 📖 **Histórias de reforço**: até 12 histórias curtas por mês criadas só com o que você mais erra
- 🗣️ 120 minutos de Conversa e Cenas por mês
- 💬 **Conversa livre com um tutor de IA** que conhece seu perfil e puxa as suas dificuldades
- 📖🎙️ **Tutor de leitura**: enquanto lê, toque no botão flutuante e converse por voz sobre o livro, a história, os personagens e as palavras da página
- 🎭 **Crie suas próprias Cenas** (personagens e situações salvas, sem limite de cenas criadas)
- Feedback detalhado com correções frase a frase

**Pro — R$ 89,90/mês**
- Tudo do Plus
- ✨ 900 créditos de IA por mês
- 📥 Importação ilimitada (uso justo)
- 🗣️ 300 minutos de Conversa e Cenas por mês
- ⏱️ Cenas de até 10 minutos (nos outros planos: 3 ou 5)
- 📖 Histórias de reforço sem limite (uso justo) e análise de perfil sob demanda (1 por dia)
- 📊 Relatório mensal de evolução (comparativo mês a mês) e acesso antecipado a novidades

### 2.3 Tabela de custo de crédito por operação

Base de custo (preços OpenAI de mai/2026 para `gpt-image-2` em 1024×1536: low US$ 0,005 · medium US$ 0,041 · high US$ 0,165; `gpt-4.1-mini` para texto). Câmbio de trabalho: **R$ 6,00 por US$** (dólar + IOF de cartão internacional + folga). **Recalibrar com o custo real medido após 30 dias** (o sistema vai registrar o custo de cada chamada — seção 8).

| Operação (onde está no código) | Custo real estimado | Créditos | Observação |
|---|---|---|---|
| Página ilustrada nova (`comic-generate`) — storyboard + imagem medium + referências de continuidade | US$ 0,06–0,10 (R$ 0,36–0,60) | **10** | Grátis se a página já existe no estilo padrão da galeria |
| Redesenhar página (`replan`) | igual | **10** | |
| Editar painel com IA (máscara/inpaint) | ~US$ 0,05 | **5** | Só pagos |
| Detecção de balões (`comic-layout`) | centavos | 0 | Incluída na página |
| Estilo próprio: extrair estilo / detectar personagens | ~US$ 0,01 | **3** | Só pagos |
| Explicação de palavra (`vocab-explain`) | ~US$ 0,0015 | **1** | 0 se já existe no banco compartilhado |
| História da palavra / exemplos extras | ~US$ 0,002 | **1** | 0 se já existe |
| Imagem do mosaico (`vocab-images`, low quadrada) | ~US$ 0,007 | **1** | |
| Explicar trecho / pesquisa de contexto (`explain`, `search-context`) | ~US$ 0,002 | **1** | |
| Glosa rápida de palavra (`gloss`) | desprezível | 0 | Só limite de taxa |
| Transcrever página de PDF escaneado (`transcribe-page`) | ~US$ 0,005 | **1 por página** | Importação é só paga; PDF com texto não usa IA |
| História de reforço (texto + quiz) | ~US$ 0,003 | 0 (cota do plano) | Plus: 12/mês; Pro: uso justo. Áudio da história usa TTS local/VoiceStudio |
| Relatório de análise de perfil | ~US$ 0,01 | 0 (cota do plano) | Semanal automático no Plus; sob demanda no Pro (máx. 1/dia) |
| Conversa / Cena (fala no aparelho + IA de texto + voz Kokoro/VoiceStudio) | ~US$ 0,002/min | **minutos** | Ver seção 17 |
| Feedback e nota da conversa | ~US$ 0,005 | 0 | Incluído na conversa |
| Capa ilustrada da Cena (opcional) | igual mosaico | **2** | |

Valor de referência: **1 crédito ≈ R$ 0,06 de custo no pior caso** (página ilustrada). Texto custa bem menos que o crédito cobrado, o que dá folga de margem.

### 2.4 Simulação de margem (pior caso = usuário gasta 100% em páginas)

Receita líquida ≈ preço − ~5% gateway − ~6% imposto (confirmar regime tributário).

| Plano | Receita líquida | Custo IA pior caso (créditos + voz + análise) | Custo IA típico (40–50% de uso) | Margem pior caso |
|---|---|---|---|---|
| Grátis | R$ 0 | R$ 2,10 | ~R$ 0,50 | −R$ 2,10 (custo de aquisição) |
| Essencial | ~R$ 22,15 | R$ 12 + R$ 0,40 (voz) = R$ 12,40 | ~R$ 5,50 | +R$ 9,75 |
| Plus | ~R$ 39,95 | R$ 27 + R$ 1,50 (voz) + R$ 0,50 (análise/histórias) = R$ 29 | ~R$ 12,00 | +R$ 11 |
| Pro | ~R$ 80,00 | R$ 54 + R$ 3,60 (voz) + R$ 2 (análise/histórias) = R$ 59,60 | ~R$ 25,00 | +R$ 20 |

Como a voz roda com a pilha que já temos, o peso do custo continua nas **imagens**. O que segura a margem é o limite de créditos, não o de minutos.

Ainda faltam os custos fixos (Supabase, Vercel, armazenamento de imagens, Resend). O cache compartilhado da galeria derruba bastante o custo real: quanto mais gente lê o mesmo livro, menos páginas novas são geradas.

**Proteções de custo independentes de plano:**
- Teto global diário de gasto (`AI_DAILY_BUDGET_USD`): ao atingir, gerações novas pausam com mensagem amigável e o admin recebe e-mail.
- Limite de orçamento mensal configurado no próprio projeto da OpenAI.
- No máximo **1 geração de imagem simultânea por usuário** e limite por minuto (anti-script).

---

## 3. O que cada plano libera (matriz de recursos)

### 3.1 Matriz

| Recurso | Grátis | Essencial | Plus | Pro |
|---|---|---|---|---|
| Leitura, vozes (TTS local), vocabulário, prática de fala/ditado, comunidade | ✅ | ✅ | ✅ | ✅ |
| Ver a galeria inteira (capa, sinopse, avaliações, amostra) | ✅ | ✅ | ✅ | ✅ |
| Livros da galeria na estante | **1 (presente)** | Todos | Todos | Todos |
| Ver páginas ilustradas que a comunidade já gerou (livro que tem acesso) | ✅ grátis | ✅ | ✅ | ✅ |
| Gerar página nova (estilo padrão) | 3/mês | por crédito | por crédito | por crédito |
| Estilo próprio, editar painel com IA, redesenhar | ❌ | ✅ | ✅ | ✅ |
| Explicações / histórias / exemplos | por crédito (teto) | por crédito | por crédito | por crédito |
| Mosaico de vocabulário (gerar) | 5/mês | por crédito | por crédito | por crédito |
| Importar EPUB / PDF | ❌ | até 20 livros | até 100 | ilimitado (uso justo) |
| Texto colado manualmente (livro próprio) | 1 livro | ✅ | ✅ | ✅ |
| Créditos de IA/mês | 60 | 200 | 450 | 900 |
| Minutos de Conversa e Cenas/mês | 3 | 30 | 120 | 300 |
| Duração máxima de uma Cena | 3 min | 3 ou 5 min | 3 ou 5 min | 3, 5 ou 10 min |
| Cenas prontas (biblioteca de situações) | 1 de demonstração | ✅ todas | ✅ todas | ✅ todas |
| Criar Cenas próprias (personagem + situação) | ❌ | ❌ | ✅ | ✅ |
| Conversa livre com tutor que conhece seu perfil | ❌ | ❌ | ✅ | ✅ |
| **Tutor de leitura** (botão flutuante no leitor, conversa por voz sobre o livro) | 🔒 vê o botão | 🔒 vê o botão | ✅ | ✅ |
| Nota + feedback ao final da conversa | resumido | ✅ | ✅ detalhado frase a frase | ✅ detalhado |
| Análise avançada do perfil (relatório de dificuldades) | ❌ | ❌ | semanal | semanal + sob demanda |
| Histórias de reforço (foco nas suas dificuldades) | ❌ | ❌ | 12/mês | uso justo |
| Relatório mensal de evolução | ❌ | ❌ | ❌ | ✅ |

### 3.2 Tetos do Grátis (dentro dos 60 créditos)
- Páginas ilustradas novas: **máx. 3/mês** (30 créditos).
- Imagens de mosaico: **máx. 5/mês**.
- Resto do pool (texto): ~25–30 explicações/histórias.
- Créditos do grátis só são concedidos **depois do e-mail confirmado** (anti-abuso).

### 3.3 Cartão-presente (1 livro grátis)
- Ao entrar no Grátis pela primeira vez: animação de **envelope abrindo → cartão gira → confete**, texto "Você ganhou um livro de presente 🎁" e botão **"Escolher meu livro"**.
- A galeria abre em **modo presente**: faixa no topo "Escolha seu livro presente", cada card ganha o botão "Escolher este".
- Confirmação: "Esse livro será seu para sempre, mesmo no plano grátis. Confirmar?" → RPC `redeem_gift(catalog_id)`.
- Regras: **1 por conta**, único no banco (`gift_redemptions.user_id` é chave primária). Troca permitida **só antes de abrir o 1º capítulo**, uma única vez. Livro respeita a faixa etária.
- Se o usuário assinou direto sem escolher presente e depois cancelou, ele escolhe o presente no momento do downgrade.
- Livros adicionados durante a assinatura **ficam travados** ao voltar para o grátis (progresso, notas e vocabulário preservados; destrava ao assinar de novo). O presente nunca trava.
- Os demais livros aparecem com selo **Premium**: dá para clicar, ver a página do livro, avaliações e uma **amostra** (primeiras páginas do cap. 1). "Adicionar à estante"/"Ler" abre o modal de assinatura.

---

## 4. Créditos — regras e mecânica

### 4.1 Regras de negócio
1. **Pool mensal por período**, não por mês civil:
   - Pago mensal: período = ciclo de cobrança (concedido quando o webhook confirma o pagamento).
   - Anual: concedido todo mês na data de aniversário da assinatura.
   - Grátis: período móvel de 30 dias a partir da confirmação do e-mail.
2. **Reseta e não acumula**: no novo período o saldo vira o valor do plano; o que sobrou expira (registrado no extrato como "expirado").
3. **Só debita em sucesso**. Falhou, deu timeout ou a OpenAI recusou → crédito volta automaticamente.
4. **Preço fixo por operação**: novas tentativas internas (ex.: storyboard reparado) não cobram de novo.
5. **Cache compartilhado é grátis**: se o resultado já existe, não chama a IA e não cobra.
6. Saldo nunca fica negativo.
7. Créditos bônus (admin, promoções) vencem junto com o período, a não ser que o admin marque validade própria.

### 4.2 Mecânica atômica (reservar → confirmar → devolver)
Para impedir que duas abas/requests simultâneos gastem o mesmo saldo:

```
credits_reserve(user, operation, amount, idempotency_key)  -- trava a linha do saldo (FOR UPDATE)
   → checa disponível = concedido − usado − reservado ≥ amount e tetos do plano
   → cria reserva (expira em 10 min) e devolve reservation_id
chamada à IA
   → sucesso: credits_commit(reservation_id)  (vira "usado" + registra custo real em ai_usage)
   → falha:   credits_release(reservation_id)
cron a cada 5 min: libera reservas vencidas
```
Tudo em funções SQL `security definer`, chamadas só pelas edge functions (service role). O navegador não chama essas funções.

### 4.3 Onde o usuário vê
- **Sempre visível no sidebar** (desktop) e no topo da página "Eu" (celular): dois medidores compactos, **Créditos 142/450** e **Minutos 87/120**, com barra de progresso e "renova em 12 dias". Atualiza ao vivo (Realtime) a cada uso; fica âmbar abaixo de 20% e vermelho no zero. Tocar abre o extrato.
- Página **Minha assinatura** com extrato (data, operação, livro/palavra, créditos, saldo).
- Antes de gerar uma página: "Gerar esta página usa 10 créditos (restam 142)". Opção "não perguntar de novo".

---

## 5. Ciclo de vida da assinatura (máquina de estados)

```
none(Grátis) ─checkout─▶ pending ─webhook pago─▶ active
active ─renovação paga─▶ active (novo período + créditos)
active ─renovação falhou─▶ past_due (3 dias de carência) ─pago─▶ active
                                                       └─não pago─▶ expired ▶ Grátis
active ─cancelar─▶ active + cancel_at_period_end ─fim do período─▶ expired ▶ Grátis
active ─reembolso/arrependimento─▶ refunded ▶ Grátis imediato
active ─chargeback─▶ disputed ▶ Grátis imediato + conta sinalizada
```

### 5.1 Upgrade (ex.: Essencial → Plus)
- Imediato. **Novo ciclo começa hoje** (a data de renovação muda para hoje + 1 mês).
- Valor cobrado = preço do novo plano − **desconto proporcional**:
  `desconto = valor pago no ciclo atual × min(dias restantes / dias do ciclo, créditos restantes / créditos do plano)`
  Usar o *menor* dos dois evita os dois abusos: quem já gastou todos os créditos não ganha desconto por dias; quem está no fim do ciclo não ganha desconto por créditos.
- Créditos: saldo vira o pool cheio do novo plano (o restante do antigo já virou desconto em dinheiro).
- A tela mostra o cálculo antes de confirmar: "Plus R$ 44,90 − crédito do Essencial R$ 6,20 = **R$ 38,70 hoje**. Depois R$ 44,90 todo dia 14."
- A assinatura antiga é cancelada na Zouti **só depois** que o webhook da nova confirmar pagamento (nunca deixar o usuário sem plano ou com dois ativos).
- Se a Zouti não aceitar valor de primeira cobrança diferente: cobrar o valor cheio e converter o desconto em créditos bônus no novo ciclo (comunicar isso claramente).
- Bloqueado em `past_due` (precisa regularizar antes).

### 5.2 Downgrade (ex.: Pro → Essencial)
- Agendado para o fim do período (`pending_plan_id`). Créditos atuais seguem até lá.
- Pode ser desfeito a qualquer momento antes da data.
- Se o plano novo tem limite de importados menor, os excedentes ficam só leitura (não apaga nada).

### 5.3 Cancelamento
- `cancel_at_period_end = true`; acesso e créditos até o fim do período.
- Reativar antes do fim = só remover a flag, sem nova cobrança.
- Fluxo de cancelamento com 1 tela de retenção (motivo + oferta de downgrade), nunca enganosa.

### 5.4 Falha de pagamento
- `past_due` por 3 dias: mantém acesso à biblioteca, **não concede créditos novos**, banner fixo + e-mail com link para atualizar pagamento.
- Depois de 3 dias → `expired` → Grátis.

### 5.5 Arrependimento (CDC art. 49), reembolso e chargeback
- Até 7 dias da primeira compra: reembolso integral pelo app, acesso cai na hora, créditos zeram.
- Reembolso manual pelo admin registra motivo.
- Chargeback: revoga na hora, sinaliza conta, bloqueia novas compras até o admin liberar.

### 5.6 Outras brechas fechadas
- **Preço mudou**: a assinatura guarda o `price_cents` contratado; preço novo só para novas assinaturas ou com aviso de 30 dias.
- **Dois checkouts abertos ao mesmo tempo**: só um `checkout_intent` aberto por usuário; um segundo pagamento confirmado vira reembolso automático + alerta no admin.
- **Excluir conta com assinatura ativa**: cancela na Zouti primeiro, depois apaga dados; registros de pagamento ficam anonimizados (obrigação fiscal, 5 anos).
- **Admin**: acesso ilimitado por papel no banco, mas o uso continua sendo registrado no custo.

---

## 6. Pagamento — Zouti

> Não achei documentação pública da API da Zouti. Antes de implementar, **confirmar com eles** os itens da 6.4. O código fica atrás de um adaptador (`PaymentProvider`) para trocar de gateway sem mexer no resto.

### 6.1 Fluxo
1. Usuário escolhe plano → edge function `billing-checkout` cria um `checkout_intent` (user_id, plano, tipo: new/upgrade, valor calculado) e pede a URL de checkout à Zouti com `external_reference = intent_id`.
2. Redireciona para a Zouti. Recomendado **cartão + Pix** (boleto atrasa a liberação; se usar, fica `pending` até compensar).
3. Zouti chama `billing-webhook`:
   - valida assinatura/segredo do webhook;
   - grava o evento bruto em `payment_events` com ID único (**idempotência**: evento repetido é ignorado);
   - **consulta o status na API da Zouti** (não confia só no corpo do webhook);
   - aplica a transição na máquina de estados (ignora eventos fora de ordem/antigos);
   - concede créditos do período, registra `payments`, dispara e-mail.
4. Retorno ao app em `/checkout/retorno?intent=…`: a tela **consulta o status** a cada 2s (até 60s). Confirmado → modal de sucesso. Ainda pendente (Pix/boleto) → "Pagamento em processamento, avisaremos por e-mail".
5. Cron diário de **reconciliação**: compara assinaturas ativas no banco com a Zouti e corrige divergências (webhook perdido).

### 6.2 Tela de sucesso
Modal com confete leve: "Bem-vindo(a) ao plano **Plus**! 🎉 A biblioteca inteira é sua e você tem **450 créditos** este mês." Botão principal **"Escolher um livro para começar"** → galeria.

### 6.3 Página "Minha assinatura" (`/assinatura`)
Plano atual, status, próxima cobrança e valor, créditos e extrato, histórico de pagamentos (com nota fiscal quando houver), trocar plano, cancelar/reativar, atualizar forma de pagamento (link Zouti).

### 6.4 Perguntas para a Zouti (bloqueantes)
1. Tem **assinatura recorrente nativa**? Se não, nós controlamos o ciclo e geramos cobrança avulsa todo mês (muda o desenho).
2. Lista de eventos de webhook (pago, recusado, renovado, cancelado, reembolsado, chargeback) e **como verificar a autenticidade** (assinatura HMAC? token?).
3. Permite **valor diferente na primeira cobrança** (pró-rata do upgrade) ou cupom dinâmico?
4. Trocar plano de uma assinatura existente ou só cancelar + criar outra?
5. Pix recorrente / Pix Automático?
6. Reembolso via API? Taxas por método? Prazo de repasse?
7. Ambiente de testes (sandbox) e chaves de teste.
8. Retorno do checkout com URL de sucesso/cancelamento configurável por pedido.

### 6.5 Web agora, lojas depois (mesmo servidor)
**Agora:** só web (PWA). Nada de build iOS/Android nesta etapa; a pasta `ios/` e o Capacitor ficam parados.

**Mas tudo já nasce preparado para virar app de loja:**
- **Mobile-first de verdade**: toda tela nova (planos, paywall, presente, assinatura, Conversa, Cenas) é desenhada primeiro em 375 px, com áreas seguras (`safe-area-inset`), alvos de toque ≥ 44 px, TabBar, botões grandes de microfone e nada que dependa de hover.
- **Pagamento atrás de um adaptador** (`PaymentProvider`): `zouti` (web) hoje; `apple` e `google` amanhã. A tabela `subscriptions` já tem a coluna `provider`.
- **Direito de acesso (`get_entitlements`) não sabe de onde veio o pagamento**: assinou na web, usa no app; assinou na loja, usa na web.
- **Recursos nativos isolados** em `src/lib/native.ts` (microfone, haptics, share), com fallback web.

**Quando for para as lojas (fase futura):**
- iOS cobra por **Apple In-App Purchase (StoreKit)**; Android por **Google Play Billing**. Recomendação: usar o **RevenueCat** como camada única (um SDK para as duas lojas, webhooks padronizados para o nosso `billing-webhook`, validação de recibos no servidor deles).
- Preço na loja pode ser maior para cobrir a taxa (15% no programa de pequenas empresas da Apple/Google, 30% acima de US$ 1 mi/ano).
- No app, **não mostrar preço nem link para pagar na web** (regra da Apple). Quem já assina pela web vê "Sua assinatura é gerenciada no site".
- Uma assinatura ativa por pessoa: se já assina na web, o app não oferece compra; se assina na loja, a web mostra "Gerencie pela App Store / Google Play".
- Upgrade, downgrade e cancelamento acontecem **na plataforma onde a pessoa assinou** (a loja faz o pró-rata dela).
- Reembolsos da loja chegam por webhook (RevenueCat) e seguem a mesma máquina de estados (seção 5).

---

## 7. Acesso e primeiro acesso

### 7.1 Fluxo completo
```
/signup (e-mail+senha, nome, data de nascimento, aceite dos termos)   ou   "Continuar com Google"
   │                                                                        │
   ▼                                                                        ▼
/verificar-email ("enviamos um link", reenviar com espera de 60s,   /completar-cadastro (data de nascimento + aceite,
 trocar e-mail)                                                      que o Google não fornece) — obrigatório
   │ clica no link (e-mail via Resend)                                      │
   ▼                                                                        ▼
/auth/callback ──────────────────────────────▶ /planos (primeiro acesso, onboarding_step = 'plans')
                                                  │
                         ┌────────────────────────┴───────────────────────┐
                    Grátis (R$0)                                    Plano pago
                         │                                               │
               animação cartão-presente                          checkout Zouti → retorno
                         │                                               │
               galeria em modo presente                      modal de sucesso → galeria
                         │                                               │
                         └──────────────▶  Home / estante  ◀─────────────┘
```

### 7.2 Regras
- Sem e-mail confirmado: não entra no app (Supabase "Confirm email" ligado). Google já vem confirmado.
- `profiles.onboarding_step`: `complete_profile` → `plans` → `gift` → `done`. O `ProtectedRoute` redireciona para o passo pendente; não dá para pular digitando a URL.
- Abandonou o checkout: a pessoa fica no plano Grátis (já recebe o presente) e vê um banner "Finalize sua assinatura". A tela de planos não volta a bloquear.
- Menores de 18: checkout pede confirmação de que um responsável autorizou; menores de 12 não compram (LGPD/CDC).
- Mesma pessoa com Google e senha no mesmo e-mail: vinculação automática de identidades no Supabase (e-mails verificados).
- Recuperação de senha: `/esqueci-senha` → e-mail Resend → `/nova-senha`.

### 7.3 Resend
- Comprar domínio → configurar SPF, DKIM e DMARC na Resend.
- **E-mails de autenticação**: SMTP customizado do Supabase apontando para a Resend (`smtp.resend.com`), templates em pt-BR com a marca (confirmação, recuperação de senha, troca de e-mail, link mágico).
- **E-mails transacionais** (edge function `notify` usando a API da Resend): boas-vindas, pagamento confirmado, falha de pagamento, assinatura cancelada, reembolso, créditos em 80%, créditos esgotados, renovação próxima (anual), alerta de custo para o admin.
- Remetentes: `ola@dominio` (produto) e `nao-responda@dominio` (auth).

### 7.4 Google
Google Cloud Console → OAuth client (web) → URLs de redirecionamento do Supabase → ativar provider Google no Supabase → botão "Continuar com Google" no Login e no Cadastro. Tela de consentimento com nome e logo do app (exige domínio e política de privacidade publicados).

---

## 8. Painel admin financeiro (`/admin/financeiro`)

Fontes: `payments` (receita), `ai_usage` (custo por chamada, com tokens e imagens que a própria OpenAI devolve), `subscriptions`, `fx_rates` (dólar do dia via PTAX do Banco Central, com fallback manual).

**Cartões do topo (período selecionável):** receita bruta · taxas do gateway · receita líquida · custo de IA (US$ e R$) · **resultado (receita líquida − custo IA)** · margem % · MRR · assinantes ativos por plano.

**Gráficos e tabelas:**
- Receita × custo de IA por dia.
- Custo por operação (páginas, explicações, mosaico…) e por modelo.
- Custo médio por usuário em cada plano × preço do plano (mostra se algum plano está no prejuízo).
- Top 20 usuários por custo (detectar abuso).
- Funil: cadastros → e-mail confirmado → presente escolhido → pago. Conversão grátis→pago, churn, ARPU.
- Créditos concedidos × usados × expirados por plano (ajuda a recalibrar preços).
- Taxa de acerto do cache compartilhado (quanto o cache economizou).
- Eventos de pagamento com erro / divergências da reconciliação.
- Conferência mensal com a fatura da OpenAI (Costs API com chave admin) para validar a estimativa.

**Ações do admin:** conceder créditos bônus, trocar plano manualmente (cortesia), reembolsar, liberar conta sinalizada, ajustar teto diário de custo, ver o extrato de qualquer usuário.

Segurança: hoje o admin é reconhecido por **lista de e-mails no front** (`AuthContext.tsx:108`). Passa a ser papel no banco (`admin_users`), checado nas RPCs e nas políticas RLS.

---

## 9. Travas — onde cada regra é aplicada

### 9.1 Servidor (obrigatório)
| Regra | Onde |
|---|---|
| Texto dos livros da galeria | Hoje `catalog_books` é lido inteiro por qualquer usuário (`catalog.ts:206` faz `select('*')`). Separar: **metadados públicos** em `catalog_books`; **conteúdo** em `catalog_book_content`, lido só via RPC `catalog_open(id)` que checa `has_book_access(user, catalog_id)` (plano pago **ou** presente). A amostra pública vem de uma coluna `sample` limitada. |
| Cópia do livro na estante (`books` + `book_links`) | Inserir `book_links` de catálogo exige `has_book_access`. Ao fazer downgrade, um trigger marca `book_links.locked = true` (exceto o presente) e o conteúdo da cópia fica protegido pela mesma checagem. |
| Páginas ilustradas da galeria (`catalog_comic_pages`, bucket `comic-pages`) | Leitura só para quem tem acesso ao livro. |
| Toda chamada de IA | `ai-text`, `comic-generate`, `comic-layout`: `requireEntitlement(user, operation)` + `credits_reserve/commit/release` + registro em `ai_usage`. Operações só pagas (estilo próprio, editar painel, transcrever PDF) recusam no plano grátis com código `plan_required`. |
| Importação EPUB/PDF | O upload passa por uma edge function `import-book` (ou trigger em `books` com `source in ('epub','pdf')`) que checa plano e limite de livros importados. |
| Admin | RPCs `admin_*` checam `admin_users`. |
| Pagamento | Só o webhook altera `subscriptions`. O cliente nunca escreve nessas tabelas (RLS só de leitura do próprio registro). |

### 9.2 Front (experiência)
- Hook `useEntitlements()` (plano, créditos, tetos, presente, flags) carregado no login e atualizado via Realtime quando a assinatura ou o saldo mudam.
- `<PremiumGate feature="import">` envolve botões; ao clicar abre o paywall com contexto.
- Erros `plan_required` / `no_credits` vindos do servidor abrem o modal certo (rede de segurança se o front estiver desatualizado).
- Livros travados no aparelho (cache offline/IndexedDB) são escondidos quando o plano muda.
- Novas rotas: `/planos`, `/checkout/retorno`, `/assinatura`, `/verificar-email`, `/completar-cadastro`, `/auth/callback`, `/esqueci-senha`, `/nova-senha`, `/admin/financeiro`.

---

## 10. Fim da chave de API do usuário

1. Criar secret `OPENAI_API_KEY` (e opcionalmente `GEMINI_API_KEY`) nas edge functions.
2. `pickProvider()` em `supabase/functions/_shared/ai.ts` passa a devolver a chave da plataforma; some o erro `no_api_key`.
3. Remover a tela `AiConnections.tsx` da página de Configurações (vira o cartão "Seus créditos"), remover `src/lib/aiKeys.ts` e a edge function `ai-keys`.
4. Migration: **apagar as chaves guardadas** (`user_ai_keys`) e depois a tabela e as funções `ai_key_*`. Aviso no app para quem tinha chave conectada: "Agora a IA vem inclusa no seu plano, sua chave foi apagada com segurança".
5. Atualizar Termos (seção 6), Privacidade ("Chaves e conteúdo de IA") e FAQ ("Preciso pagar?", "Como conecto minha chave?") — ver seção 13.

---

## 11. Comunicação estratégica

### 11.1 Modal de assinatura (paywall)
Precisa ser **convidativo, não punitivo**. Estrutura:
- Ilustração/hero no topo (estante iluminada abrindo).
- Título conforme o gatilho:
  - Livro premium: "Este livro está esperando por você 📚"
  - Importar: "Traga seus próprios livros para estudar"
  - Créditos acabaram: "Sua imaginação não precisa esperar"
  - Estilo próprio: "Ilustre do seu jeito"
- 3–4 benefícios com ícones (biblioteca completa · importar EPUB/PDF · X páginas ilustradas por mês · estilos próprios).
- Os 3 planos em cards, **Plus destacado** como "Mais escolhido", preço por mês e "≈ R$ 0,83/dia" no Essencial.
- Botão principal "Assinar o Essencial" + link secundário "Ver todos os planos". Fechar sempre visível.
- Rodapé: "Cancele quando quiser · 7 dias de garantia".
- Registrar o gatilho (`paywall_shown`, `paywall_cta`) para medir conversão por contexto.

### 11.2 Grátis
- Banner na Home (fechável, volta em 7 dias): "Você está lendo 1 de N livros. Liberte a biblioteca inteira."
- Selo Premium nos cards da galeria + faixa no topo da galeria.
- Após a 1ª página ilustrada: toast "Gostou? No Essencial você gera ~15 por mês".
- Na 3ª página (última do mês): modal de créditos esgotados com o dia da renovação **e** oferta do Essencial.
- E-mails: dia 3 (o que dá para fazer), dia 7 (livros mais lidos da galeria), quando os créditos esgotam.

### 11.3 Planos pagos
- 80% dos créditos: toast discreto + e-mail.
- 100%: modal "Seus créditos acabaram" com **upgrade para o plano de cima** já com o valor do pró-rata calculado, e a data de renovação como alternativa ("ou espere até dia 14").
- Pro sem créditos (não tem plano acima): mostrar a renovação. **Fase futura:** pacote de recarga avulsa (ex.: +200 créditos por R$ 19,90, vence no fim do período).

---

## 12. Antifraude e abuso
- E-mail confirmado obrigatório; bloquear domínios de e-mail descartável.
- Limite de cadastros por IP/aparelho por dia; créditos do grátis só após confirmação.
- Captcha invisível (Cloudflare Turnstile) no cadastro.
- Limite de taxa por usuário e por IP nas edge functions de IA.
- Alerta de custo anômalo por usuário (ex.: > 3× a média do plano) no admin.
- Conteúdo gerado continua passando pela moderação mínima já existente em `vocab.ts`.

---

## 13. Jurídico e textos
- **Termos**: nova seção de planos, créditos (não acumulam, sem valor monetário, não reembolsáveis à parte), renovação automática, cancelamento, upgrade/downgrade, arrependimento de 7 dias, livro-presente, livros travados após downgrade. Reescrever a seção 6 (sai "com a sua chave").
- **Privacidade**: sai "suas chaves"; entra "dados de pagamento ficam com a Zouti, nós guardamos só status e valores"; operador OpenAI; e-mails via Resend.
- **FAQ**: novas perguntas — planos, créditos, presente, cancelamento, reembolso, nota fiscal.
- **Nota fiscal**: emitir NFS-e por pagamento (a conta Spedy já está conectada; dá para automatizar pelo webhook numa fase posterior). Confirmar CNPJ e regime tributário.
- Preços exibidos com impostos inclusos.

---

## 14. Modelo de dados (migrations)

```sql
plans (id text pk, name, price_cents int, interval 'month'|'year', monthly_credits int,
       limits jsonb  -- {"pages":3,"mosaic":5,"imports":0,"custom_style":false}
       , provider_product_id, active bool, sort int)

subscriptions (id uuid pk, user_id, plan_id, status, price_cents,          -- preço contratado
               provider, provider_subscription_id unique,
               current_period_start, current_period_end,
               cancel_at_period_end bool, pending_plan_id, created_at, updated_at)
               -- índice único parcial: 1 assinatura não-final por usuário

checkout_intents (id uuid pk, user_id, plan_id, kind 'new'|'upgrade', amount_cents,
                  proration_cents, status, provider_checkout_id, created_at, expires_at)

payments (id uuid pk, user_id, subscription_id, provider_charge_id unique, amount_cents,
          fee_cents, method, status, kind 'new'|'renewal'|'upgrade'|'refund', paid_at, invoice_url)

payment_events (id uuid pk, provider_event_id unique, type, payload jsonb,
                received_at, processed_at, error)

credit_periods (id uuid pk, user_id, plan_id, starts_at, ends_at, granted int,
                used int, reserved int)              -- 1 linha ativa por usuário (trava FOR UPDATE)

credit_ledger (id bigserial, user_id, period_id, delta int,
               kind 'grant'|'reserve'|'commit'|'release'|'expire'|'bonus'|'admin',
               operation, ref text, idempotency_key unique, created_at)

ai_usage (id bigserial, user_id, operation, provider, model, input_tokens, output_tokens,
          image_count, image_quality, cost_usd numeric(10,5), credits int,
          status 'ok'|'failed'|'cache_hit', latency_ms, book_id, created_at)

gift_redemptions (user_id pk, catalog_id, redeemed_at, swapped_at)

catalog_book_content (catalog_id pk, content, chapters jsonb)   -- sai de catalog_books
admin_users (user_id pk)
fx_rates (day date pk, usd_brl numeric)
app_settings (key pk, value jsonb)          -- teto diário de custo, câmbio manual, flags

profiles + onboarding_step, birth_date_confirmed
book_links + locked bool
```

Funções: `get_entitlements(user)`, `has_book_access(user, catalog)`, `credits_reserve/commit/release`, `ensure_current_period(user)` (avaliação preguiçosa, sem depender de cron para o grátis), `redeem_gift`, `apply_subscription_event` (máquina de estados), `admin_finance_overview(from, to)`.

---

## 15. Fases de implementação

| Fase | Entrega | Depende de |
|---|---|---|
| **0** | Bug do Voltar + avatar no sidebar | — |
| **1** | Migrations de planos/créditos/uso; chave da plataforma; `credits_*` + `ai_usage` nas edge functions; remoção de BYOK; separação do conteúdo do catálogo + `has_book_access` | Seu OK para deploy no Supabase |
| **2** | `useEntitlements`, `PremiumGate`, paywall, página `/planos`, cartão-presente + modo presente, contador de créditos, selos Premium, travas de importação | Fase 1 |
| **3** | Zouti: adaptador, checkout, webhook, reconciliação, `/checkout/retorno`, `/assinatura`, upgrade com pró-rata, downgrade, cancelamento, reembolso | Respostas da Zouti (6.4) + sandbox |
| **4** | Domínio + Resend (SMTP auth + transacionais), login Google, `/verificar-email`, `/completar-cadastro`, `onboarding_step` | Nome e domínio definidos |
| **5** | Painel financeiro, alertas de custo, comunicações (banners, toasts, e-mails de ciclo de vida) | Fases 1–4 |
| **6** | Textos legais/FAQ, migração dos usuários atuais, QA completo, lançamento | Tudo |
| **7a** | Teste técnico de 2–3 dias da Conversa (latência real no iPhone Safari e Android Chrome) | Pode rodar em paralelo à Fase 1 |
| **7** | Cenas prontas + feedback com nota + controle de minutos | Fase 1 + resultado do 7a |
| **8** | Tutor de leitura no leitor, Criar Cenas próprias, Conversa livre com tutor, Análise de perfil, Histórias de reforço | Fase 7 (reusa o motor de voz) |
| **Futuro** | Apps de loja (Capacitor) com Apple IAP + Google Play Billing via RevenueCat | Web estável |

### 15.1 Roteiro de testes (antes de lançar)
- Duas abas gerando página com saldo para só uma → apenas uma passa.
- Falha da OpenAI no meio → crédito volta.
- Usuário grátis chamando a RPC/edge function do catálogo diretamente pelo console → negado.
- Webhook duplicado, fora de ordem e com assinatura inválida.
- Webhook perdido → reconciliação corrige.
- Upgrade no dia 1 sem uso, no dia 1 com créditos zerados e no dia 29 → valores corretos.
- Downgrade agendado + upgrade antes do fim; cancelar + reativar.
- Falha de pagamento → carência de 3 dias → volta para o grátis → livros travados, presente intacto.
- Reembolso em 7 dias; chargeback.
- Cadastro com Google sem data de nascimento → obrigado a completar.
- Pular o onboarding digitando a URL → redirecionado.
- Teto diário global atingido → gerações pausam, admin recebe e-mail.
- Cena: tentar continuar falando depois do tempo acabar (mesmo alterando o relógio do aparelho) → servidor recusa; sair no meio → minutos não usados voltam.
- Usuário do Essencial chamando a criação de Cena própria direto pela API → `plan_required`.
- Todas as telas novas testadas em 375 px (iPhone) e 360 px (Android), com teclado aberto e áreas seguras.

---

## 16. Pendências suas (decisões)
1. **Nome do app e domínio** (bloqueia Resend, Google OAuth e textos).
2. **Nomes e preços finais** dos planos (proposta: Grátis / Essencial R$ 24,90 / Plus R$ 44,90 / Pro R$ 89,90).
3. **Respostas da Zouti** (seção 6.4) e acesso ao sandbox.
4. **CNPJ e regime tributário** (afeta margem e nota fiscal).
5. **Usuários atuais (beta)**: sugestão: todos ficam no Grátis com **1 mês do Essencial grátis** como "Fundadores", e os livros que já estão na estante ficam liberados durante esse mês.
6. **Amostra grátis** dos livros premium: quantas páginas (sugestão: primeiras ~3 páginas do cap. 1).
7. **Voz da IA na Conversa pelo celular**: VoiceStudio (melhor qualidade, depende de o servidor responder rápido) ou voz do próprio navegador (instantânea, mais robótica). O teste 7a decide.
8. **Lista inicial de Cenas prontas**: sugestão de 10 na seção 17.4.

---

## 17. Conversa por voz, Cenas e Análise de perfil — estudo de viabilidade

### 17.1 Veredito
**Viável, usando só o que já temos.** Não vai ser uma ligação instantânea (não usamos API de voz em tempo real), e sim **conversa turno a turno rápida**: a pessoa fala, o sistema transcreve, a IA responde em texto e a resposta é falada. Meta: **1,5 a 3 segundos** entre a pessoa parar de falar e a voz da IA começar. Com resposta em streaming e a voz começando já na primeira frase, a sensação fica natural para treino de idioma.

### 17.2 Como funciona (pilha atual do projeto)
```
🎙️ microfone
   │  fim da fala: botão "segurar para falar" ou silêncio de ~0,8 s
   ▼
Reconhecimento de fala — já existe em src/lib/speech/recognizers.ts
   • Web Speech API (Chrome, Edge, Safari/iPhone): ao vivo, grátis  ← padrão
   • Whisper local (77 MB, desktop/Firefox): fallback privado
   │  texto
   ▼
Edge function nova `conversation-turn` (gpt-4.1-mini, mesmo modelo de texto de hoje)
   • prompt da persona + metas da cena + nível + resumo do perfil + histórico curto
   • resposta em streaming, quebrada em frases
   │  frases
   ▼
Voz — já existe em src/lib/tts.ts
   • Kokoro local (desktop): grátis e boa qualidade
   • VoiceStudio (servidor próprio): celular, se a latência por frase for boa
   • Voz do navegador: fallback instantâneo
```

**Custo:** ~12 turnos em 5 minutos, ~1.500 tokens de entrada e ~80 de saída por turno → **~US$ 0,01 por conversa de 5 min** + ~US$ 0,005 do feedback. Reconhecimento de fala e voz são grátis (no aparelho ou servidor próprio).

### 17.3 Controle de minutos (sem brecha)
- Minuto = **tempo de relógio da sessão**, medido no servidor (não no aparelho).
- Ao iniciar, o servidor cria a `conversation_session` com a duração escolhida (3, 5 ou 10 min) e **reserva** esses minutos do saldo.
- Cada turno confere no servidor se a sessão ainda está dentro do tempo (+30 s de tolerância). Depois disso, recusa.
- Saiu no meio ou ficou 60 s sem falar → sessão encerra e os **minutos não usados voltam**.
- 1 sessão ativa por usuário. Limite de turnos por minuto (anti-script).
- Saldo de minutos segue a regra dos créditos: mensal, reseta, não acumula.

### 17.4 Cenas
**Cenas prontas** (curadas por nós, todos os planos pagos; 1 de demonstração no Grátis). Catálogo completo na **seção 17.9**: 34 cenas em 12 categorias (+3 infantis), começando pelas que você pediu (Mercado, Aeroporto, Cafeteria, Restaurante, Conversa profissional, Relacionamento).

O que deixa uma cena boa (consenso dos materiais de professores de inglês para adultos):
- **Situação real da vida do aluno** (viagem, trabalho, dia a dia), não cenário artificial.
- **Objetivo concreto** ("conseguir trocar o assento para a janela"), não "converse sobre o aeroporto".
- **Uma complicação no meio** (voo lotado, item em falta, conta errada): obriga a pessoa a improvisar, e é aí que o aprendizado acontece. A IA introduz a complicação por volta de 40% do tempo.
- **Variação a cada vez**: nomes, preços, itens e a complicação são sorteados, então repetir a mesma cena nunca é igual.
- **Nível ajustável**: a mesma cena funciona em A2 (frases curtas, fala mais lenta, personagem paciente) e em B2/C1 (fala natural, gírias leves, personagem com pressa).

**Criar Cena** (Plus e Pro), formulário pensado para celular:
1. **Onde?** texto livre + sugestões ("Em um pub na Irlanda numa sexta à noite").
2. **Quem é o personagem?** nome, jeito (simpático, apressado, irônico…), e a voz.
3. **Seu objetivo** ("pedir uma bebida e descobrir se vai ter música ao vivo").
4. **Nível** (padrão = o do perfil) e **duração**.
5. A IA monta a cena (frase de abertura, 3 metas, palavras úteis) e a pessoa revisa. Capa ilustrada opcional (2 créditos).
- **Moderação** antes de salvar: nada sexual, de ódio, imitação de pessoa real, conteúdo impróprio para a idade. Para menores de 18 a regra é mais rígida. O personagem nunca sai do papel nem da regra de segurança.

**Durante a cena** (tela cheia no celular):
- Capa/avatar do personagem, cronômetro circular, legendas (dá para esconder e treinar só o ouvido).
- Botão grande de microfone.
- **Ajuda**: sugere em português 2 frases do que dá para dizer agora (sem custo extra).
- **Repetir**, **Mais devagar**, **Traduzir a última fala**.
- Metas da cena em checklist, marcadas conforme a pessoa cumpre.
- Faltando ~20 s, o personagem encerra de forma natural ("Oh, my bus is here, nice talking to you!").

**Fim: nota e feedback**
- **Nota de 0 a 100** e nível estimado (A1–C1) daquela conversa.
- 5 critérios (0–20 cada): **Comunicação** (metas cumpridas), **Gramática**, **Vocabulário**, **Fluência** (palavras por minuto, tempo para responder, hesitações) e **Pronúncia** (inteligibilidade: palavras que o reconhecedor não entendeu; não mede sotaque, limite já documentado em `recognizers.ts`).
- Plus/Pro: lista frase a frase "**Você disse → Forma mais natural**", com o porquê.
- Palavras novas com botão "salvar no vocabulário", ouvir a conversa de novo, XP.
- Histórico de conversas com a evolução das notas.
- Grátis/Essencial: nota + 3 dicas principais (o detalhado aparece borrado com convite para o Plus no Grátis).

### 17.5 Conversa livre com tutor (Plus e Pro)
Mesma tecnologia, com um personagem "tutor" que recebe o resumo do perfil (nível, palavras em Revisar, erros que se repetem) e puxa esses pontos na conversa. Gancho forte com o produto: **conversar sobre o livro que a pessoa está lendo**.

### 17.6 Análise avançada de perfil e Histórias de reforço (Plus e Pro)
**Dados que já temos:** vocabulário e status (Revisar/Aprendi/Importante), sessões de prática de fala e ditado com as palavras erradas, livros e páginas lidos, tempo de estudo e nível. **Dados novos:** erros das conversas, classificados por tipo (tempo verbal, preposição, ordem das palavras, vocabulário, pronúncia).

**Raio-X semanal** (job automático para quem estudou na semana): os dados viram um resumo compacto (sem texto de livros) → a IA devolve pontos fortes, as **3 maiores dificuldades** (ex.: passado irregular, preposições de lugar, final "-ed"), palavras que mais travam e uma recomendação da semana (uma Cena, um livro, uma prática). Painel com gráficos de evolução. Custo ~US$ 0,01 por pessoa por semana.

**Histórias de reforço:** botão "Criar história de reforço" → história de 150 a 300 palavras no nível da pessoa, usando 5 a 8 palavras-alvo e a estrutura gramatical que ela mais erra, com áudio (voz que já existe), palavras-alvo destacadas, 3 a 5 perguntas no final e o atalho "Praticar isso numa Cena". Fica em "Minhas histórias" e abre no leitor como um mini-livro. Acertar a palavra no quiz conta para tirá-la da revisão. Custo ~US$ 0,003 por história.

### 17.7 Riscos e limites (honestos)
- **Não dá para interromper a IA falando** como numa ligação. Mitigação: botão "parar" corta o áudio na hora.
- **iPhone/Safari**: microfone e áudio só funcionam depois de um toque da pessoa; o Web Speech do Safari às vezes para sozinho (reiniciar automaticamente).
- **Eco**: a voz da IA pode ser captada pelo microfone. Mitigação: microfone desligado enquanto a IA fala + cancelamento de eco do navegador.
- **Firefox não tem Web Speech**: no desktop cai no Whisper local; no celular, oferece digitar a resposta.
- **Kokoro é pesado no celular** (~80 MB): no celular a voz vem do VoiceStudio ou do navegador. O VoiceStudio hoje funciona com fila; para conversa vai precisar de um caminho rápido para frases curtas (medir no teste 7a).
- **Privacidade**: no Web Speech o áudio passa pelo Google/Apple (já explicado no app); o texto vai para a OpenAI. **Não guardamos áudio**, só a transcrição, e a pessoa pode apagar. Atualizar a política de privacidade.

**Critério de seguir ou não (teste 7a):** mediana abaixo de 2,5 s do fim da fala ao início da voz no iPhone Safari e no Android Chrome.

### 17.8 Dados novos
```sql
scenes (id, owner_id null = curada, title, setting, persona jsonb, goals jsonb, level,
        voice_id, cover_url, moderation_status, created_at)
conversation_sessions (id, user_id, scene_id null, kind 'scene'|'tutor', planned_seconds,
        started_at, last_turn_at, ended_at, used_seconds, status)
conversation_turns (id, session_id, role 'user'|'ai', text, stt_confidence, created_at)
conversation_feedback (session_id pk, score, cefr, criteria jsonb, corrections jsonb, new_words jsonb)
learner_errors (id, user_id, source, kind, example, correction, created_at)
profile_insights (user_id, week_start, summary jsonb, report jsonb)
reinforcement_stories (id, user_id, title, body, target_words, grammar_focus, quiz jsonb, created_at)
credit_periods  + minutes_granted, seconds_used, seconds_reserved
```
Travas no servidor: `conversation-start`, `conversation-turn` e `conversation-end` checam plano, saldo de minutos, duração permitida e se a cena pertence à pessoa (ou é curada).

### 17.9 Catálogo de Cenas prontas (lançamento)

Formato de cada cena: **personagem · objetivo do aluno · complicação sorteada · nível**. ⭐ = categorias que você pediu. 🔞 = só para 16+ (respeita a faixa etária do perfil).

**⭐ Mercado**
| Cena | Personagem | Objetivo | Complicação (sorteada) | Nível |
|---|---|---|---|---|
| Supermercado | Funcionário de reposição, simpático | Achar 3 itens da lista | Um item acabou; precisa escolher substituto | A1–A2 |
| Feira / hortifrúti | Feirante falante | Comprar frutas, perguntar preço e pedir desconto | Ele só aceita dinheiro | A2–B1 |
| Caixa do mercado | Caixa apressado | Pagar e pedir sacola | Cobrou um item duas vezes | A2–B1 |

**⭐ Aeroporto**
| Cena | Personagem | Objetivo | Complicação | Nível |
|---|---|---|---|---|
| Check-in | Atendente da companhia | Despachar a mala e pedir janela | Mala 2 kg acima do limite | A2–B1 |
| Imigração | Agente de imigração, sério | Responder motivo, tempo e hospedagem da viagem | Pede o endereço do hotel que você não lembra | B1 |
| Bagagem extraviada | Atendente do balcão de bagagens | Registrar a mala perdida e descrevê-la | Formulário exige o número da etiqueta | B1–B2 |
| Portão de embarque | Agente do portão | Entender o atraso e o novo horário | Voo cancelado; negociar outro voo ou hotel | B1–B2 |

**⭐ Cafeteria**
| Cena | Personagem | Objetivo | Complicação | Nível |
|---|---|---|---|---|
| Pedir café | Barista animado | Pedir bebida personalizada e um lanche | Acabou o leite que você pediu | A1–A2 |
| Conversa com o barista | Barista curioso | Fazer small talk (de onde você é, o que faz) | Ele recomenda algo que você não conhece | A2–B1 |
| Trabalhando no café | Pessoa na mesa ao lado | Pedir a senha do wi-fi e dividir a tomada | A pessoa puxa conversa sobre seu trabalho | B1 |

**⭐ Restaurante**
| Cena | Personagem | Objetivo | Complicação | Nível |
|---|---|---|---|---|
| Reserva por telefone | Recepcionista | Reservar mesa para 4 numa sexta | Só tem horário mais tarde | A2–B1 |
| Pedir a refeição | Garçom | Pedir entrada, prato e bebida; falar de uma alergia | O prato tem o ingrediente da alergia | A2–B1 |
| Reclamar com educação | Gerente | Resolver um prato frio/errado sem ser grosseiro | Ele oferece só um desconto pequeno | B1–B2 |
| Pub na Irlanda | Bartender irlandês divertido | Pedir bebida e descobrir se tem música ao vivo | Ele fala rápido e com expressões locais | B1–B2 |

**⭐ Conversa profissional**
| Cena | Personagem | Objetivo | Complicação | Nível |
|---|---|---|---|---|
| Entrevista de emprego | Recrutadora | Falar de você, experiências e pontos fortes | Pergunta difícil: "qual seu maior defeito?" | B1–C1 |
| Apresentar-se na reunião | Gerente do time | Apresentar-se e explicar sua função | Pedem sua opinião sobre um tema na hora | B1–B2 |
| Ligação com cliente | Cliente insatisfeito | Entender o problema e propor solução | Cliente pede prazo impossível | B2–C1 |
| Networking em evento | Profissional da sua área | Trocar contatos e marcar um café | Ele pergunta algo técnico do seu trabalho | B1–B2 |
| Pedir aumento / feedback | Chefe | Argumentar com resultados | Chefe diz que não há orçamento agora | B2–C1 |

**⭐ Relacionamento**
| Cena | Personagem | Objetivo | Complicação | Nível |
|---|---|---|---|---|
| Fazer amizade | Pessoa num curso/academia | Puxar conversa e combinar algo | Descobrem um interesse em comum inesperado | A2–B1 |
| Novo vizinho | Vizinho recém-chegado | Apresentar-se e oferecer ajuda | Ele reclama educadamente do barulho | A2–B1 |
| Primeiro encontro 🔞 | Pessoa simpática | Conversar, fazer perguntas, mostrar interesse | Silêncio constrangedor; você precisa retomar | B1–B2 |
| Conhecer a família | Pai/mãe do(a) parceiro(a) | Causar boa impressão no jantar | Perguntam sobre seus planos de futuro | B1–B2 |
| Conversa difícil com amigo | Amigo chateado | Pedir desculpas e resolver o mal-entendido | Ele ainda está magoado e resiste | B2–C1 |

**Outras categorias (pesquisa: as mais usadas em materiais de inglês para adultos)**
| Categoria | Cena | Personagem | Objetivo | Complicação | Nível |
|---|---|---|---|---|---|
| Hotel | Check-in | Recepcionista | Fazer check-in e perguntar horário do café | O quarto não está pronto | A2–B1 |
| Hotel | Problema no quarto | Recepcionista | Reclamar do ar-condicionado e pedir troca | Hotel lotado, sem outro quarto | B1 |
| Transporte | Pedir direções na rua | Morador local | Chegar a um museu | Ele dá instruções rápidas e confusas | A2–B1 |
| Transporte | Táxi / app de carro | Motorista falante | Confirmar destino e conversar no caminho | Trânsito; ele sugere outro caminho | A2–B1 |
| Saúde | Farmácia | Farmacêutico | Descrever sintomas e pedir remédio | Precisa de receita; ele sugere alternativa | A2–B1 |
| Saúde | Consulta médica | Médico | Explicar há quanto tempo e o que sente | Pede detalhes que você não sabe dizer | B1–B2 |
| Compras | Loja de roupas | Vendedor | Achar o tamanho e provar | Não tem seu tamanho na cor que quer | A2 |
| Compras | Devolver produto | Atendente | Trocar ou devolver um produto com defeito | Passou do prazo de devolução | B1–B2 |
| Moradia | Visitar apartamento | Corretor | Perguntar aluguel, contas e regras | Pedem fiador/depósito alto | B1–B2 |
| Small talk | Elevador / fila | Desconhecido simpático | Conversar 2 min sobre o tempo e o fim de semana | Ele faz uma piada que você precisa entender | A2–B1 |

**Para crianças e iniciantes (A1, faixa etária livre)**: comprar sorvete, apresentar-se na escola nova, pedir um livro na biblioteca. Personagens pacientes, frases curtas, sem complicação difícil.

**Ordem de produção:** começar pelas 6 categorias ⭐ (24 cenas), validar notas e feedback com usuários reais, depois liberar o resto. Cada cena guarda no banco: `setting`, `persona` (nome, jeito, voz, velocidade), `goals`, `twists[]`, `variables` (itens/preços/nomes sorteáveis), `level_range`, `age_min`, `ambient_sound`, `useful_phrases`, além dos fillers próprios da seção 17.10.

### 17.10 Esconder a espera: animação + "fala-ponte" (fillers)

**Ideia (a sua, e funciona):** assim que a pessoa termina de falar, o próprio sistema já começa a responder com uma **fala curta pronta** ("Hmm, let me see…", "Oh, nice!", "Right, so…"), tocada **na hora**, enquanto a IA ainda está pensando. Quando a resposta da IA chega, ela **continua a frase** em vez de começar do zero. Para quem ouve, parece que o personagem respondeu imediatamente. Assistentes de voz de grandes empresas usam a mesma técnica (há até patente antiga sobre "mascarar a latência de TTS com frases prontas"), e o cuidado principal é **não ficar repetitivo nem genérico**.

**Como fica sem parecer genérico:**

1. **A IA sabe o que o sistema já falou.** O filler é escolhido *antes* de mandar o pedido para a IA, e vai junto no pedido:
   `"Você já disse em voz alta: 'Oh, the window seat…'. Continue a partir daí, sem repetir e sem contradizer."`
   Assim a resposta encaixa: *"Oh, the window seat…"* (sistema, instantâneo) + *"let me check if we still have one. Yes, row 14!"* (IA).
2. **Filler neutro, que nunca se compromete.** Nada de "Yes!" ou "No problem!" (a IA pode precisar dizer o contrário). Só reações que servem para qualquer continuação: surpresa, reflexão, confirmação de que ouviu.
3. **Escolhido pelo contexto, sem IA** (decisão local em milissegundos):
   - **Tipo da fala do aluno**, por regras simples sobre a transcrição: pergunta (termina com "?" ou começa com what/where/can/do…) → "Good question…", "Hmm, let me think…"; agradecimento → "Oh, you're welcome…"; frase longa/história → "Oh, really?", "Wow, okay…"; resposta curta (yes/no) → "Alright…", "Okay, so…"; saudação → "Hey! …"; o aluno não foi entendido (baixa confiança no reconhecimento) → "Sorry, could you…", e aí nem precisa da IA.
   - **Cena e personagem**: cada cena tem seus próprios fillers. Barista: "Coming right up…"; agente de check-in: "Alright, let me pull that up…"; bartender irlandês: "Ah, grand…"; recrutadora: "That's interesting…". Personagem apressado usa fillers curtos; simpático, mais calorosos.
   - **Eco de palavra-chave**: se a transcrição tem um item conhecido da cena (window seat, latte, size M), o filler repete esse pedaço ("Oh, a latte…"). Esse eco é gerado por template com a palavra do próprio aluno, o que faz soar muito específico.
4. **Sem repetição**: nenhum filler se repete nos últimos 6 turnos; ~25% dos turnos vão **sem filler** quando a resposta tende a ser rápida (falas muito curtas), para não virar tique.
5. **Tamanho ajustado à espera**: o sistema mede a demora média da IA naquela sessão. Espera curta → filler curto ("Oh!"); espera longa → filler mais longo. Se passar de ~2,5 s e a IA ainda não respondeu, entra um segundo som natural (respiração, "uhm…") e, no último caso, "Just a sec…".
6. **Áudio pronto, tocado na hora**: os fillers são frases curtas, então entram no **cache compartilhado de TTS que já existe** (frases até 60 caracteres). Cada voz tem seus fillers pré-gerados uma vez e baixados quando a cena abre. Tocar leva ~0 ms; nenhum custo por uso.
7. **Costura sem buraco**: a resposta da IA chega em streaming; a primeira frase vai para a voz assim que fica pronta e entra na fila **logo depois** do filler (com crossfade curto). Instruímos a IA a começar com uma frase curta (até ~8 palavras) para a primeira voz sair rápido.

**Outros truques que somam:**
- **Pedido antecipado**: o Web Speech entrega o texto parcial enquanto a pessoa fala. Com ~0,6 s de silêncio já mandamos o pedido; se ela continuar falando, cancelamos e reenviamos. Ganha ~0,5 s.
- **Transcrição na tela na hora**: o aluno vê o que disse aparecendo palavra por palavra, então a espera parece processamento, não travamento.
- **Som ambiente da cena**: barulho de cafeteria, anúncios de aeroporto, conversa de pub. Já existe o componente `AmbientSound.tsx` no leitor; é só adicionar trilhas. O silêncio é o que mais denuncia o atraso, e o ambiente preenche.

**Animação do personagem (3 estados):**
| Estado | O que aparece |
|---|---|
| **Ouvindo** | Anel/onda em volta do avatar reagindo ao volume do microfone em tempo real (Web Audio `AnalyserNode`); a transcrição vai aparecendo. |
| **Pensando** | Avatar inclina levemente, olhos/brilho "pensativos", três pontos suaves no balão. Dura só o tempo entre o fim do filler e a resposta, que muitas vezes é zero. |
| **Falando** | Boca/onda sincronizada com o volume do áudio que está tocando; legenda aparece palavra por palavra, junto com a voz. |

Avatar: ilustração do personagem no estilo da cena (gerada uma vez por cena curada e guardada), com animação leve em CSS/Lottie para não pesar no celular. Haptic leve no celular ao trocar de vez (já existe `haptics.ts`).

**Como medir se funcionou:** registrar por turno o tempo "fim da fala → primeiro som" (com filler) e "fim da fala → resposta da IA" (sem filler). Meta: primeiro som abaixo de 300 ms em 90% dos turnos. No feedback do teste 7a, perguntar aos testadores "o personagem pareceu demorar?".

**Riscos dos fillers:**
- Filler e resposta contraditórios: resolvido pelo item 1 (a IA recebe o filler) e pelo item 2 (fillers neutros). Ainda assim, revisar um lote de conversas reais no teste.
- Voz do filler diferente da voz da resposta: os dois usam a mesma voz e o mesmo motor. No celular com voz do navegador, os fillers também usam a voz do navegador.
- Filler tocando quando a pessoa ainda não terminou de falar: só dispara depois do fim de fala confirmado; o pedido antecipado não toca nada.

### 17.11 Tutor de leitura (Plus e Pro)

Um tutor de voz que mora **dentro do leitor**: a pessoa está lendo, toca no botão do canto inferior direito e conversa sobre o livro sem sair da página. Usa **o mesmo motor** da Conversa e das Cenas (reconhecimento de fala → IA de texto → voz, com fillers e animação da seção 17.10).

**Do que dá para falar**
- **A história até onde a pessoa leu**: "o que aconteceu até aqui?", "por que a Alice ficou com medo?", "quem é esse personagem?".
- **Termos e frases da página**: "o que significa *peculiar*?", "como se usa *had better*?". O tutor pode **destacar a palavra na página** e oferecer "salvar no vocabulário" (botão no balão).
- **Opinião e interpretação**: "o que você acha que vai acontecer?", "você concorda com a decisão dele?". É prática de conversa de verdade, com assunto concreto.
- **Quiz rápido**: "me faça 3 perguntas sobre este capítulo".
- **Pronúncia**: "como se fala esta frase?" → lê o trecho com a voz do tutor.

**Regras de conteúdo**
- **Sem spoiler**: o tutor só recebe o que a pessoa já leu (capítulos anteriores resumidos + a página atual). Se perguntarem do final, ele desconversa com bom humor ("No spoilers! Keep reading 😉").
- Livros da galeria: resumo por capítulo gerado **uma vez por livro** e compartilhado (barato; usa o `bible.md`/capítulos que já existem no catálogo). Livros importados: resumo por capítulo gerado sob demanda e guardado só para a pessoa.
- Fala em inglês no nível da pessoa. Se ela falar português, o tutor entende, responde em inglês simples e, no A1/A2, dá a tradução curta no balão.
- Fica no assunto do livro e do estudo; recusa o resto com educação.

**Como funciona a interação**
1. Botão flutuante redondo no **canto inferior direito** do leitor (avatar do tutor com um brilho "respirando" bem sutil). Não cobre o texto: no celular fica acima da TabBar e da área segura; some quando a pessoa rola rápido e volta ao parar.
2. Toque → o botão cresce num **painel compacto** ancorado no canto (não abre tela cheia; o livro continua visível).
3. **Play**: liga o modo escuta contínua (mãos livres). A pessoa fala, o avatar **ouve** (anéis reagindo ao volume da voz), a frase reconhecida aparece em cinza e se firma.
4. O avatar **pensa** (rara vez visível, graças ao filler) e **responde pulsando** no ritmo do áudio; os **balões** da resposta aparecem acima do avatar, palavra por palavra junto com a voz. Ficam os 3 últimos balões; os mais antigos sobem e somem com fade (histórico completo num toque).
5. Terminou de falar → volta a ouvir sozinho. **Stop** encerra a escuta na hora (e corta a voz se estiver falando).
6. 30 s sem ninguém falar → pausa sozinho (economiza minutos e protege a privacidade), com o aviso "Toque no play para continuar".
7. Se o áudio do livro (leitura em voz alta) estiver tocando, ele **pausa** quando o tutor começa e retoma quando o tutor termina.

**Controles do painel**
| Controle | Função |
|---|---|
| ▶ / ⏹ **Play / Stop** | Liga a escuta contínua / para tudo |
| 💬 **Legendas** | Liga/desliga os balões (só voz, se quiser treinar o ouvido) |
| 🐢 **Velocidade** | Voz do tutor mais lenta / normal |
| ⏱ **Minutos** | Chip discreto "87 min" com o saldo; vermelho perto do fim |
| ⚙ **Ocultar tutor** | Esconde o botão do leitor (volta em Configurações → Leitura → Tutor) |
| ✕ **Minimizar** | Volta a ser só o botão |

**Animação (precisa parecer premium)**
- Feita com a biblioteca `motion` que já está no projeto: transições com **mola** (spring), nada linear.
- **Botão → painel**: o círculo se expande com mola para o painel arredondado (morph de forma, não um popup que "aparece").
- **Play ⇄ Stop**: o ícone **se transforma** (o triângulo vira quadrado) com um anel de progresso em volta; ao tocar, há uma leve compressão (escala 0,94) e um haptic curto no celular.
- **Estados do avatar** (orbe com gradiente nas cores do tema):
  - *Parado*: respira devagar (escala 1 → 1,03, 4 s).
  - *Ouvindo*: 2–3 anéis concêntricos que crescem conforme o volume da voz (Web Audio `AnalyserNode`, 60 fps).
  - *Pensando*: o gradiente gira lentamente dentro do orbe.
  - *Falando*: o orbe pulsa no ritmo do volume do áudio do tutor; os balões entram de baixo com mola e um leve desfoque que se desfaz.
- Respeita "reduzir movimento" do sistema (troca animações por fades simples).
- Leve no celular: só `transform` e `opacity` (sem recalcular layout), e o canvas/análise de áudio só roda com o painel aberto.

**Consumo**
- Usa os **minutos de conversa** do plano (mesmo saldo das Cenas).
- Como a conversa é aberta (não tem 3/5 min fixos), conta **só o tempo de fala de verdade**, calculado no servidor pelo texto de cada turno (palavras do aluno + palavras do tutor ÷ ritmo de fala), com mínimo de 5 s por turno. Ficar com o painel aberto em silêncio **não gasta nada**. Não dá para burlar pelo aparelho, porque o servidor vê o texto.
- Destacar palavra, salvar no vocabulário e o quiz não gastam créditos extras.
- Saldo sempre visível no sidebar e no chip do painel (seção 4.3). Minutos acabaram → o painel mostra o convite de upgrade (Plus → Pro) ou a data de renovação.

**Planos**
- **Plus e Pro**: liberado.
- **Grátis e Essencial**: o botão aparece com um cadeado pequeno. Ao tocar, abre o paywall com uma **prévia animada** do tutor conversando ("Converse com seu tutor enquanto lê") e o botão para o Plus. Quem não quiser ver pode ocultar o botão.

**Técnico**
- Componente `ReaderTutor` no leitor + hook compartilhado `useVoiceConversation` (o mesmo das Cenas: microfone, fim de fala, fillers, fila de áudio, estados da animação).
- Edge function `tutor-turn` (ou `conversation-turn` com `kind: 'reader'`): recebe `book_id`, capítulo/página atual e a fala; monta o contexto sem spoiler; checa plano e minutos; responde em streaming.
- Ações estruturadas na resposta (ex.: `{"highlight": "peculiar", "offer_save": true}`) para o leitor destacar a palavra e mostrar o botão no balão.
- `conversation_sessions.kind` ganha o valor `'reader'` com `book_id`; o histórico de conversa daquele livro fica salvo (a pessoa pode retomar e apagar).
- Dados novos: `catalog_chapter_summaries (catalog_id, chapter, summary)` compartilhada e `book_chapter_summaries (book_id, chapter, summary)` privada.

---

### Fontes de preço consultadas
- [GPT Image 2 — Opper](https://opper.ai/openai/gpt-image-2)
- [GPT Image 2 cost per image — yingtu.ai](https://yingtu.ai/en/blog/gpt-image-2-cost-per-image)
- [OpenAI image pricing — costgoat](https://costgoat.com/pricing/openai-images)

Preços de terceiros que citam a tabela oficial; confirmar na página de preços da OpenAI antes de fechar os valores.
