# Plano — Site institucional do Upoonly (upoonly.com)

> Data: 2026-11-19 · Status: proposta para aprovação
> Base visual: template gratuito **AlphaOS** (Framer), exports em `~/Downloads/alphaos.framer.website-2026-11-19` e `~/Downloads/alphaos.framer.website-1795125649140`, e o site ao vivo `alphaos.framer.website`.
> Conteúdo: tudo o que o app Upoonly já tem (planos, tutores, galeria, estilos, prova, comunidade, FAQ, termos).

---

## 0. Resumo das decisões propostas

| Tema | Proposta |
|---|---|
| Onde fica o site | `upoonly.com` vira o **site** (visitante). O app continua no mesmo projeto: visitante em `/` vê o site; quem já está logado em `/` cai direto no app. `/login`, `/signup` e todas as rotas do app continuam iguais. |
| Tecnologia | **Reconstruir** o template em React + Tailwind + `motion` (já instalados no app). **Não** colar o HTML/JS exportado do Framer (é runtime proprietário, 5 MB por página, sem manutenção). Do template usamos o desenho: grid, espaçamentos, tipografia, cores, componentes e animações. |
| Peso no app | Site em **chunk separado** (`lazy()`), o app logado não baixa nada do site e vice-versa. |
| SEO | Páginas do site **pré-renderizadas** no build (HTML estático com texto real, `<title>`, `description`, Open Graph), hidratadas depois. |
| App iOS (Capacitor) | Nunca mostra o site: abre direto no login/app. |
| Idioma | Português primeiro; inglês na fase 2 (o app já tem os textos `pt/en`). |

> ⚠️ **Decisão que preciso de você:** site na raiz `upoonly.com` + app no mesmo domínio (recomendado, acima) **ou** site em `upoonly.com` e app em `app.upoonly.com` (dois projetos na Vercel, muda URLs de retorno do Supabase/Google/Zouti e e-mails).

---

## 1. Análise do template AlphaOS

### 1.1 Estrutura do export

- Export 1 (`…-2026-11-19`): 44 páginas, modo multi, cada `index.html` com ~5 MB (CSS, fontes e imagens embutidos).
- Export 2 (`…-1795125649140`): mesma home (555 KB) + `pages/` (27 páginas), `images/` (PNG/SVG/fontes `.woff2`) e `scripts/` (runtime Framer).
- Páginas do template: Landing v1/v2/v3, Feature, Integration, Pricing v1/v2/v3, Company v1/v2/v3, Contact v1/v2/v3, FAQ, Blog (+ posts), Case studies (+ posts), Careers (+ vagas), Sign in, Sign up, Privacy, Terms, 404.

### 1.2 Design system (extraído do CSS)

**Cores (tokens Framer → nomes nossos)**

| Token | Hex | Uso no template | Nome no site Upoonly |
|---|---|---|---|
| `#f9f8f7` / `#faf9f8` | fundo papel | fundo da página | `--site-bg` |
| `#f2efed` | cinza quente | cartões, chips, divisórias | `--site-surface` |
| `#ffffff` | branco | cartões elevados, nav | `--site-card` |
| `#231f23` | quase preto | títulos, botão primário | `--site-ink` |
| `#5e5d5a` | cinza texto | parágrafos | `--site-muted` |
| `#f3582d` | laranja | acento (barra do logo, destaques, "ACTIVE NOW") | `--site-accent` (avaliar trocar pelo roxo `#7B61FF` do app, ver 1.5) |
| `#fa9762` `#cebffa` `#c8e1ff` `#b4f6ff` `#ccfdcf` `#fbc801` `#ff5c5f` `#33c759` | pastéis | gradientes dos cartões grandes, selos | paleta de apoio |

Gradientes: os cartões grandes (hero, "Built for teams", seção sticky) usam gradiente pastel suave pêssego → rosa → lilás → azul, com "ruído" leve. É a assinatura visual do template.

**Tipografia** (todas Google Fonts, licença livre)

| Fonte | Uso | Pesos |
|---|---|---|
| **IBM Plex Serif** | títulos grandes (H1 64px, H2 48px, H3 40/34px), tracking negativo | 400 |
| **Stack Sans Headline** | títulos de cartão, números grandes | 500–600 |
| **Stack Sans Text** | corpo, botões, nav (14px domina) | 400–500 |
| **Inter** | fallback, textos de UI | 400–600 |
| Mono (código no editor fake) | trocar por página de livro no nosso caso | — |

Escala: 11 · 12 · 14 · 16 · 18 · 20 · 22 · 24 · 28 · 34 · 40 · 48 · 64 px.
Raios: 8 · 10 · 12 (mais usado) · 16 · 20 px; botões 10px; cartões grandes 20–24px.
Sombras: muito leves (cartão branco sobre fundo papel), nav flutuante com borda 1px `rgba(0,0,0,.06)`.
Container: ~1200px, gutter 24–32px, seções com 120–160px de respiro vertical.

### 1.3 Animações e comportamento (observado ao vivo)

1. **Carregamento**: a página abre só com a nav e o fundo papel; o conteúdo do hero entra depois com *spring* (`stiffness 451, damping 30, mass 1`), subindo (`y`) e com `opacity 0→1`, com atraso escalonado. Uma barra/faixa de aviso fina no topo (azul claro `#b4f6ff`).
2. **Hero**: título serif grande à esquerda; à direita, cartão com gradiente e uma "janela de app" com **abas** (Connection · Editor · Collaborate · Deploy) que trocam o conteúdo sozinhas (auto-play) e ao clicar.
3. **Faixa de logos** (marquee infinito, com fade nas bordas).
4. **Texto que acende com a rolagem**: parágrafo grande onde cada palavra vai de cinza claro para preto conforme você rola.
5. **"How it works"**: 3 cartões com imagem + passo numerado; cartões entram em sequência.
6. **Problema/solução**: lista de 4 itens à esquerda que alterna o painel da direita (gráfico de barras "Save up to 10×").
7. **Seção sticky**: imagem com gradiente fixa à esquerda enquanto 3 blocos de texto rolam à direita; o mock dentro da imagem muda a cada bloco.
8. **Depoimento + números** (284%, 76%) com contagem animada.
9. **Comparativo "Old way × New way"** em duas colunas.
10. **Bento de recursos** (Automation, AI Agent, Send to Team).
11. **FAQ** em acordeão (abre com altura animada, ícone gira).
12. **CTA final** + rodapé com colunas e marca grande.
13. Microinterações: botão escuro com seta que desliza no hover; nav com fundo branco ao rolar; menu mobile em tela cheia; links com sublinhado animado.

### 1.4 O que NÃO levar do template
- Badge e botões "Get this template / Made in Framer".
- Textos, nomes (AlphaOS, Codebox, Stefan Persson), números inventados e logos de empresas falsas.
- Páginas que não fazem sentido agora: Careers, Case studies, Integration, Company v2/v3, Contact v2/v3.

### 1.5 Ponte com a marca Upoonly
- Logo: `LOGOTIPO/Logotipo.svg` e `public/icon.svg` (substitui a "/ AlphaOS").
- O app usa `#191919` (primário), `#7B61FF` (roxo), `#4A8DFF`, `#3AC77A`, `#FFC83D`, fundo `#F6F3EE`. O fundo papel do template (`#f9f8f7`) e o do app (`#F6F3EE`) são quase iguais → continuidade natural site → app.
- **Proposta de acento:** usar o **roxo `#7B61FF`** do app no lugar do laranja, mantendo os pastéis do template nos gradientes. Alternativa: manter o laranja só no site. (Vou montar as duas no primeiro protótipo para você escolher.)
- Ilustrações já prontas: `public/illustrations/*.svg` (reading, chatting, high-five…), capas de categorias `public/categories/*.webp` (claras e escuras), 18 estilos de ilustração `public/styles/*.webp`, tutores `public/characters/bookmoo/banner/*.webp` (Bia, Luck, Yuno, Yuri, normal e sorrindo).

---

## 2. Mapa do site

| Rota | Página | Baseada em (template) |
|---|---|---|
| `/` | Home (visitante) | Landing v1 |
| `/recursos` | Todos os recursos, explicados um a um | Feature |
| `/tutores` | Bia, Luck, Yuno e Yuri | Feature + Company |
| `/galeria` | Biblioteca pública (vitrine de livros e estilos) | Blog (grid) |
| `/planos` (pública) | Planos e créditos | Pricing v1 |
| `/prova` (pública) | Teste de nível e Prova de proficiência | Feature |
| `/sobre` | Missão, método, quem faz | Company v1 |
| `/contato` | Contato e suporte | Contact v1 |
| `/faq` | já existe (`LegalPage`), recebe o novo visual | FAQ |
| `/terms`, `/privacy` | já existem, recebem o novo visual | Terms / Privacy |
| `/login`, `/signup` | já existem no app; só ganham link "voltar ao site" | — |
| 404 | página de erro com tutor | 404 |

> Conflito de rota: o app já usa `/prova` e `/planos` logado. Solução: as versões públicas ficam em `/site/...`? **Não** — melhor: a mesma rota mostra a versão pública para visitante e a do app para logado (como em `/`). Fica uma URL só, boa para SEO e para compartilhar.

---

## 3. Home — seção por seção (conteúdo real do Upoonly)

1. **Faixa de aviso** (topo): "Novo: Prova de proficiência com relatório completo → Conheça".
2. **Nav**: logo Upoonly · Recursos ▾ (Leitura, Ilustrações, Tutores, Conversas, Prova, Comunidade) · Galeria · Planos · Entrar · **Começar grátis**.
3. **Hero**
   - Selo: "LEIA EM INGLÊS DO SEU JEITO".
   - H1 (serif): **"Aprenda inglês lendo as histórias que você ama."**
   - Sub: "Livros de verdade com áudio, explicação de cada palavra, ilustrações com IA e tutores que conversam com você sobre a leitura."
   - Botões: **Começar grátis** · Ver como funciona.
   - Cartão com gradiente + "janela do app" com abas auto-play: **Ler** (página com karaokê do áudio) · **Entender** (tooltip de palavra com explicação) · **Ilustrar** (página virando quadrinho) · **Conversar** (tutor falando com balão). Usar capturas reais do app ou componentes recriados leves.
4. **Faixa de categorias** (marquee no lugar dos logos): Clássicos · Aventura · Fantasia · Mistério · Romance · Biografia · Poesia · Contos · Não ficção · Infantil · Histórias Bíblicas — cada um com a miniatura de `public/categories`.
5. **Texto que acende com a rolagem**: "O Upoonly é um leitor de livros em inglês que transforma cada página em aula. Você lê, ouve, entende cada palavra e conversa sobre a história com um tutor — no seu nível, no seu ritmo."
6. **Como funciona** (3 cartões): ① Escolha um livro (galeria ou seu EPUB/PDF) · ② Leia ouvindo, toque em qualquer palavra · ③ Pratique e converse — vocabulário, fala, ditado e tutor.
7. **Problema → solução** (lista que alterna o painel): "Decorar lista de palavras não funciona" → Vocabulário salvo no contexto (Aprendi, Revisar, Importante) · "Áudio robótico" → Vozes naturais dos tutores · "Não sei meu nível" → Teste de nível CEFR · "Não tenho com quem falar" → Conversas por voz e Cenas.
8. **Ilustrações com IA** (seção grande): carrossel dos 18 estilos (`public/styles`): Aquarela e nanquim, Fantasia épica, Mangá, HQ americana, HQ europeia, Noir, Terror gótico, Cyberpunk… "Cada página vira uma ilustração no estilo que você escolher. O que a comunidade já gerou é grátis."
9. **Tutores (seção sticky)**: imagem fixa com o tutor da vez (troca Bia → Luck → Yuno → Yuri ao rolar, com o sorriso no hover/olhar seguindo o mouse se der para reaproveitar o rig leve); à direita, quem é cada um, a voz e quando aparece (Luck sério, Bia leve, Yuno e Yuri jovens). CTA "Converse com um tutor".
10. **Raio-X e progresso**: cartão de números animados (palavras aprendidas, minutos lidos, nível CEFR). **Só números reais** (agregados do banco) ou exemplos rotulados como exemplo — nada inventado.
11. **Comparativo** "Curso tradicional × Upoonly": aula genérica × histórias que você escolhe; lista decorada × palavra no contexto; ouvir professor × conversar por voz; prova cara × prova de proficiência no app.
12. **Bento de recursos**: Prova de proficiência (4 habilidades, inspirada no formato TOEFL iBT, não oficial) · Comunidade (posts, momentos de leitura, menções) · Sons ambientes (lareira, chuva) · Notas e destaques · Importar EPUB/PDF · Modo escuro.
13. **Planos (resumo)**: os 4 cartões de `src/lib/plans.ts` (fonte única, sem copiar texto à mão) com o Plus destacado → link para `/planos`.
14. **Depoimentos**: só com depoimentos reais (fase 2). Até lá, a seção sai.
15. **FAQ**: as perguntas de `LegalPage` (Preciso pagar? Créditos? Livro-presente? Cancelar? Conversas por voz? Nível?), mesma fonte de dados.
16. **CTA final**: "Comece hoje. Ganhe um livro de presente." + Começar grátis.
17. **Rodapé**: Produto · Recursos · Empresa · Legal (Termos, Privacidade, FAQ) · redes · © 2026 Upoonly.

---

## 4. Página de Planos

- Dados de `src/lib/plans.ts` (**Grátis R$ 0 · Essencial R$ 24,90 · Plus R$ 44,90 · Pro R$ 89,90**; 40 / 230 / 550 / 1.100 créditos).
- Tabela comparativa completa (o que cada plano libera).
- Tabela de custo em créditos (`COST_TABLE`: página ilustrada 10, explicação 1, minuto de conversa 1…).
- Bloco "Livro-presente" do plano Grátis (com o cartão-presente animado).
- Regras claras (de `LegalPage` 6-A/6-B): renovação mensal, upgrade imediato, cancelamento no fim do período, 7 dias de arrependimento, pagamento via Zouti.
- Botão de cada plano → `/signup?plano=essencial` (o app já tem `/planos` logado para concluir).

## 5. Página de Recursos

Uma seção por recurso, alternando texto/imagem, com âncora no menu:
Leitura com áudio e karaokê · Explicação de palavras (e o "olho" de tradução) · Vocabulário (Aprendi/Revisar/Importante) e mosaico da comunidade · Ilustrações e quadrinhos (estilos, balões, letreiros) · Prática (fala, ditado, questionário, "Decifrar a página", Desafio) · Conversar (Cenas, conversa livre, tutor de leitura, nota e correção frase a frase) · Raio-X e histórias de reforço · Teste de nível e Prova de proficiência · Comunidade · Galeria e coleções · Importar EPUB/PDF · Sons ambientes, temas e leitura confortável.

---

## 6. Animações — especificação para reproduzir

| Efeito | Implementação | Detalhe |
|---|---|---|
| Entrada da página | `motion` com `initial={{opacity:0,y:24}}` → `animate`, spring `{stiffness:451,damping:30}`, `staggerChildren .08` | Nav aparece primeiro; hero em seguida |
| Revelar ao rolar | `whileInView` + `viewport={{once:true, margin:'-10%'}}` | Cartões, títulos, imagens |
| Texto que acende | `useScroll` no parágrafo + cada palavra com `opacity` mapeada pelo progresso | 0.2 → 1 |
| Abas do hero | Estado + `AnimatePresence` (fade + leve escala), auto-avanço a cada 4 s, pausa no hover | Barra de progresso na aba ativa |
| Marquee | CSS `@keyframes` translateX, duplicar a lista, `mask-image` nas bordas | Pausa no hover |
| Sticky storytelling | `position: sticky` + `useScroll` para trocar o tutor/imagem | Troca com crossfade |
| Contadores | `useInView` + `animate(0 → n)` | Formatação pt-BR |
| Acordeão FAQ | `height: auto` animado com `motion`, ícone `+` gira 45° | Um aberto por vez |
| Botão primário | Seta desliza 4px e fundo clareia | 150 ms |
| Nav | Fundo branco + borda ao passar de 20px de rolagem | |
| Acessibilidade | `prefers-reduced-motion`: tudo vira fade simples, sem marquee e sem auto-play | Obrigatório |

Tokens de movimento devem seguir `DESIGN_SYSTEM_INTERACOES.md` (mesmas durações/curvas do app).

---

## 7. Arquitetura técnica

```
src/site/
  SiteLayout.tsx        nav + rodapé + faixa de aviso
  tokens.css            cores, fontes, raios do site (escopo .site)
  motion.ts             springs e variantes compartilhados
  components/           Button, Badge, Section, Card, Marquee, Tabs, Accordion,
                        ScrollRevealText, StickyStory, Counter, PlanCard
  sections/             Hero, Categories, HowItWorks, Styles, Tutors, Compare,
                        Bento, PricingPreview, Faq, FinalCta
  pages/                Home, Recursos, Tutores, Galeria, Planos, Prova, Sobre, Contato, NotFound
```

- Roteamento em `src/App.tsx`: `/` → `<VisitorOrApp>` (sem sessão: `SiteHome`; com sessão: app). Mesmo padrão para `/planos` e `/prova`.
- Tudo do site em `React.lazy` (chunk próprio).
- Fontes: `@fontsource` ou Google Fonts só no site (IBM Plex Serif, Stack Sans Headline/Text) com `font-display: swap` e preload das 2 principais.
- Imagens: WebP/AVIF, `loading="lazy"`, `srcset`; capturas do app geradas em 1x/2x.
- SEO: pré-renderização das páginas públicas (plugin de prerender no Vite ou script com Playwright no build), `sitemap.xml`, `robots.txt`, OG image por página, dados estruturados (`SoftwareApplication`, `FAQPage`, `Offer`).
- Métricas: Vercel Analytics (eventos: clique em Começar grátis, plano escolhido).
- Capacitor: `Capacitor.isNativePlatform()` → nunca renderiza o site.

## 8. Conteúdo e assets a produzir

- [ ] Capturas reais do app (leitor, tooltip de palavra, página ilustrada, conversa com tutor, Raio-X, prova) em claro, 2x, recortadas em moldura.
- [ ] OG images (1200×630) da Home, Planos, Tutores.
- [ ] Textos finais revisados (proposta inicial está nas seções 3–5).
- [ ] Validar com você: acento roxo × laranja; nomes/descrições dos tutores.
- [ ] Números reais para a seção de progresso (ou omitir).

## 9. Fases e entregas

| Fase | Entrega | Verificação |
|---|---|---|
| 1. Fundação | Tokens, fontes, `SiteLayout`, nav, rodapé, botões, roteamento visitante × logado | Preview local, app logado intacto |
| 2. Home | Todas as seções da seção 3 com animações | Desktop 1440, tablet 768, celular 375; `prefers-reduced-motion` |
| 3. Planos + Recursos + Tutores | Páginas completas com dados de `plans.ts` / `LegalPage` | Links para `/signup?plano=` funcionam |
| 4. Galeria pública, Prova, Sobre, Contato, 404 | — | — |
| 5. FAQ/Termos/Privacidade no visual novo | Mesmo conteúdo | — |
| 6. SEO e performance | Prerender, sitemap, OG, Lighthouse ≥ 90 | Lighthouse mobile |
| 7. Publicar | Commit, push em `main` → Vercel publica em `upoonly.com` | Abrir `https://www.upoonly.com/` deslogado e logado |

## 10. Riscos e cuidados

- **Licença do template**: é gratuito, mas confirmar a licença no Framer Marketplace antes de publicar; de qualquer forma reconstruímos o código e trocamos todo conteúdo e imagens — nenhum arquivo do export vai para produção.
- **Rotas compartilhadas** (`/`, `/planos`, `/prova`): testar a troca visitante → logado sem piscar (esperar a sessão do Supabase antes de decidir).
- **Peso**: o app já carrega Kokoro/ORT; garantir que o site não puxe nada disso.
- **Checklist de lançamento** (`CHECKLIST_LANCAMENTO.md`): o token do GitHub dentro da URL do `origin` precisa ser trocado antes do push de publicação.
- **Promessas**: a Prova é "inspirada no formato TOEFL iBT, não oficial nem afiliada à ETS" — o site deve repetir esse aviso.

---

## 11. Valores e plano anual (proposta de 2026-11-19)

### 11.1 Custo de IA por plano (pior caso)

Base: `docs/CONFIGURACAO_PLANOS.md` (página ilustrada ~US$ 0,07–0,10, câmbio R$ 6,00). Uma página = 10 créditos, então
**1 crédito gasto em imagem ≈ R$ 0,04–0,06**; crédito gasto em texto ou voz custa bem menos (~R$ 0,01).
Pior caso = a pessoa gasta todos os créditos do mês em páginas novas (nada do cache da comunidade).

| Plano | Preço | Líquido estimado* | Créditos | Custo pior caso | Sobra pior caso |
|---|---|---|---|---|---|
| Essencial | R$ 24,90 | ~R$ 22 | 230 | R$ 9–14 | R$ 8–13 |
| Plus | R$ 44,90 | ~R$ 40 | 550 | R$ 23–33 | R$ 7–17 |
| Pro | R$ 89,90 | ~R$ 80 | 1.100 | R$ 46–66 | R$ 14–34 |

\* depois de taxa do gateway e impostos (ajustar com o CNPJ real em Admin → Financeiro).

Leitura: os preços mensais se pagam mesmo no pior caso, e o uso típico fica muito abaixo (cache compartilhado). O ponto de
atenção é o **Plus**: no pior caso a sobra cai para ~R$ 7. Os itens "sem limite" do Pro (histórias de reforço e Raio-X sob
demanda) e a correção de escrita/fala da Prova precisam de teto de uso justo no servidor.
**Recomendação: manter os preços mensais como estão.** São competitivos para app de idioma no Brasil e têm margem.

### 11.2 Plano anual

| Plano | Mensal | Anual proposto | Equivale a | Economia |
|---|---|---|---|---|
| Essencial | R$ 24,90 | **R$ 249/ano** | R$ 20,75/mês | 2 meses grátis (~17%) |
| Plus | R$ 44,90 | **R$ 449/ano** | R$ 37,42/mês | 2 meses grátis (~17%) |
| Pro | R$ 89,90 | **R$ 899/ano** | R$ 74,92/mês | 2 meses grátis (~17%) |

Regras:
- **Créditos continuam mensais** (o servidor já faz isso: `plans_credits_billing.sql`, "Plano anual (futuro)"). Nunca o ano todo de uma vez: limita o risco de custo.
- Pagamento à vista ou parcelado no cartão (se a Zouti permitir parcelar sem juros para o cliente, o "12× de R$ 20,75" vende muito bem).
- Arrependimento de 7 dias com reembolso integral (CDC). Depois disso, cancelamento vale no fim do ano pago, sem reembolso proporcional, escrito de forma clara nos Termos.
- Upgrade no meio do ano: o que sobrou vira crédito no novo plano (mesma regra do mensal).
- No site, a página de Planos ganha a chave **Mensal / Anual**, com o anual selecionado e o selo "2 meses grátis".

O que falta para vender o anual (não feito ainda):
1. Criar os 3 produtos anuais na Zouti e mapear no `billing` (id do plano + período).
2. `billing-webhook`: período de 365 dias na assinatura anual.
3. Termos (6-B) e FAQ com as regras acima.
4. Chave Mensal/Anual no site e na tela `/planos` do app.
