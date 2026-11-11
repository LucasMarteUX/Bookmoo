# Plano: Bookmoo com experiência de app iOS no mobile

> Plano de produto + técnico + acessibilidade. Nada aqui foi implementado ainda.
> Base: leitura do código em 2026-11-11 (commit `8330e96` + alterações não commitadas).
> Stack atual: React 19, Vite 6, Tailwind 4, react-router 7, zustand, `motion`, Radix Popover, Supabase, TTS no navegador (kokoro-js / transformers).

---

## 0. Decisão estratégica (leia primeiro)

"Experiência de app" tem três camadas, e cada uma entrega valor sozinha:

| Camada | O que dá | Custo | Quando |
|---|---|---|---|
| **A. Web app com cara de app** | Layout, navegação, gestos, sheets, tipografia, safe areas, a11y | Médio, é o grosso do trabalho | Fases 1–5 |
| **B. PWA instalável** | Ícone na tela inicial, tela cheia sem Safari, offline, push (iOS 16.4+) | Baixo | Fase 6 |
| **C. Shell nativo (Capacitor)** | Haptics reais, push confiável, StatusBar, teclado, compartilhar, biometria, App Store | Médio, só depois de A | Fase 7 |

**Recomendação:** A → B → C, nessa ordem. **Não** reescrever em React Native/SwiftUI: o Reader (1744 linhas), a HQ com balões e o TTS local (WASM/WebGPU) são o diferencial do produto e não migram sem custo enorme. Capacitor embrulha o mesmo código e dá acesso a APIs nativas.

**Dependências novas (enxutas):**
- `vaul` (bottom sheet com arrastar, snap points) — base dos sheets.
- `@use-gesture/react` (swipe, pull-to-refresh, drag) — integra com `motion`, que já existe.
- `vite-plugin-pwa` (manifest + service worker via Workbox).
- `@capacitor/core`, `ios`, `haptics`, `status-bar`, `keyboard`, `share`, `app`, `splash-screen`, `push-notifications`, `preferences` (só na Fase 7).
- Radix: já há `react-popover`; adicionar `react-dialog`, `react-dropdown-menu`, `react-tabs`, `react-switch`, `react-slider` para acessibilidade correta de teclado/foco/leitor de tela (substituindo o `Dialog` caseiro).

---

## 1. Diagnóstico (auditoria do estado atual)

### 1.1 O que já está bom
- `BottomNav` com `safe-area-inset-bottom`, `aria-current`, blur de fundo.
- Tema em variáveis `--theme-*` (light/sepia/dark) e `<html>` recebendo o tema (evita flash branco no overscroll).
- Reader já usa `env(safe-area-inset-bottom)` na barra flutuante e esconde a BottomNav na página do livro.
- 99 `aria-label`, 22 arquivos com `role`/`aria-live`, `focus-visible` em 6 arquivos, `prefers-reduced-motion` no CSS dos diálogos.
- `motion` instalado; animações `dialog-pop`/`drawer-in` existem.

### 1.2 Lacunas (com evidência)

| # | Problema | Evidência | Impacto |
|---|---|---|---|
| G1 | **Sem PWA**: nenhum manifest, service worker, ícones, splash | `public/` só tem `illustrations/`; nenhum `serviceWorker` no `src` | Não instala; abre dentro do Safari com barra de URL |
| G2 | **Viewport sem `viewport-fit=cover`** e sem `theme-color`, `apple-mobile-web-app-*` | `index.html` | `env(safe-area-inset-*)` retorna 0 no iPhone com notch/ilha; sem status bar integrada |
| G3 | **Sem `dvh`** onde importa: 4 usos de `min-h-screen/100vh`, só 3 de `dvh/svh` | grep | Barra do Safari cobre conteúdo; layout "pula" ao rolar |
| G4 | **Cabeçalho mobile estilo web**: hambúrguer + logo + busca; sem título grande colapsável, sem botão voltar contextual | `MobileHeader.tsx` | Parece site responsivo, não app |
| G5 | **Menu lateral de 18rem** com `Sidebar` desktop reaproveitada, sem gesto de borda, sem arrastar para fechar | `MobileHeader.tsx` | iOS usa tab bar + "More"/sheets, não drawer |
| G6 | **BottomNav com 5–6 itens** e rótulos de 10,5px; "Admin" vira o 6º | `BottomNav.tsx` | Passa do limite iOS (máx. 5), rótulo abaixo de legível |
| G7 | **`Dialog` caseiro**: sem focus-trap, sem devolver foco, sem `aria-labelledby`, sem scroll-lock, só Escape, aparece como card centrado | `ui/dialog.tsx` | Falha WCAG 2.4.3/2.1.2; no mobile deveria ser bottom sheet |
| G8 | **Sem transições entre telas**; troca seca de rota | `App.tsx` | Sensação "site" |
| G9 | **Sem haptics, share, mediaSession, wake lock** | grep: 0 ocorrências | Faltam recursos nativos; ouvir TTS com tela bloqueada não funciona |
| G10 | **Sem `overscroll-behavior`**, `touch-action` em 1 arquivo só, `user-select` pontual | grep | Pull-to-refresh do Safari conflita com gestos; duplo-toque dá zoom; tap highlight cinza |
| G11 | **Alvos de toque pequenos**: botões `w-8 h-8` (32px), `w-9 h-9` (36px), 48 ocorrências de ícones/avatares 24–35px | `dialog.tsx`, `MobileHeader.tsx`… | Abaixo dos 44×44pt da Apple e de 24px do WCAG 2.5.8 em vários casos |
| G12 | **Texto minúsculo**: 29 usos de `text-[9–11px]` em 16 arquivos | grep | Ilegível; ignora Dynamic Type / zoom de texto |
| G13 | **Estados `hover:` em 35 arquivos (139 usos)** sem equivalente de toque | grep | Em toque, hover "gruda" ou nunca aparece; faltam estados `:active` |
| G14 | **Reader com `fixed right-8 w-80`** (painel lateral), `max-h-[calc(100vh-8rem)]`, post-its flutuantes `w-[min(90vw,42rem)]` | `Reader.tsx` L1045, L1120 | No mobile precisa de sheets, não painéis flutuantes |
| G15 | **Fontes via Google Fonts em 2 lugares** (index.html + index.css), ~13 famílias | `index.html`, `index.css` | Bloqueia render, falha offline, pesado |
| G16 | **`lang="en"` fixo** no HTML apesar do app ser pt-BR/en | `index.html` | Leitor de tela lê com voz errada |
| G17 | **Sem skeleton/loading consistente**, sem pull-to-refresh, sem estados vazios padronizados em todas as telas | só `BookCardSkeleton`, `empty-state` novo | Percepção de lentidão |
| G18 | **Teclado virtual**: nenhum tratamento (`visualViewport` = 0 usos) | grep | Campos ficam escondidos atrás do teclado, barra fixa sobe junto |
| G19 | **Sem preferência de movimento/contraste/transparência** globais | só 2 ocorrências de `prefers-reduced-motion` | Falha 2.3.3; blur sem fallback |
| G20 | **Modelos de TTS em WASM** sem estratégia de cache/offline/memória no iOS | `kokoro-js`, `transformers` | Safari iOS mata abas pesadas; precisa de fallback `speechSynthesis` |

---

## 2. Princípios de design (o "idioma iOS" adaptado à identidade Bookmoo)

Manter a identidade editorial (papel quente, Newsreader/Literata, pastéis). Adotar **comportamento** iOS, não copiar o visual da Apple.

1. **Hierarquia por navegação, não por menus:** Tab bar (5) → Navigation stack (push/pop) → Sheets (modais) → Context menus (long-press).
2. **Tudo que abre, fecha com gesto:** swipe da borda esquerda = voltar; arrastar sheet para baixo = fechar.
3. **Toque primeiro:** alvo mínimo 44×44pt, feedback imediato (`:active` + haptic), sem depender de hover.
4. **Conteúdo é rei:** barras translúcidas com blur, títulos grandes que colapsam, nada de moldura pesada.
5. **Movimento com propósito:** spring suave (stiffness ~300, damping ~30), sempre respeitando `prefers-reduced-motion`.
6. **Tipografia dinâmica:** `rem`/`clamp`, nunca `px` fixo menor que 12; texto escala até 200%.
7. **Nada quebra offline:** o que já foi aberto continua abrindo.

### 2.1 Tokens novos (em `src/index.css`, dentro de `@layer base`)

```css
:root {
  --safe-t: env(safe-area-inset-top);
  --safe-b: env(safe-area-inset-bottom);
  --safe-l: env(safe-area-inset-left);
  --safe-r: env(safe-area-inset-right);
  --tabbar-h: 3.0625rem;            /* 49pt, padrão iOS */
  --navbar-h: 2.75rem;              /* 44pt */
  --navbar-large-h: 6.5rem;         /* título grande */
  --hit: 2.75rem;                   /* 44pt alvo mínimo */
  --ease-ios: cubic-bezier(.32,.72,0,1);
  --spring-sheet: 0.42s;
  --blur-bar: saturate(180%) blur(20px);
  --sheet-radius: 1.5rem;
  --kb-h: 0px;                      /* altura do teclado, via visualViewport */
}
```

### 2.2 Escala tipográfica (substitui os `text-[10–11px]`)

| Token | Tamanho | Uso |
|---|---|---|
| `--t-caption2` | 0.75rem (12px) | Legendas, badges (mínimo absoluto) |
| `--t-footnote` | 0.8125rem | Metadados |
| `--t-subhead` | 0.9375rem | Rótulos secundários |
| `--t-body` | 1.0625rem (17px) | Texto padrão iOS |
| `--t-title3/2/1` | 1.25 / 1.375 / 1.75rem | Seções/títulos |
| `--t-large` | 2.125rem | Título grande (Newsreader) |

Regra: nenhum texto de UI abaixo de 12px; tab bar com rótulo 11px é a única exceção aceitável (padrão do sistema) **se** o contraste for ≥ 4.5:1.

---

## 3. Arquitetura da casca mobile

### 3.1 Estrutura de componentes (novos, em `src/components/mobile/`)

```
mobile/
  AppShell.tsx          → substitui Layout no mobile (tab bar + stack + sheet host)
  TabBar.tsx            → 5 abas + hápticos + badge
  NavBar.tsx            → barra superior: voltar, título (inline/large), ações
  LargeTitle.tsx        → título grande que colapsa com scroll (IntersectionObserver)
  ScreenTransition.tsx  → push/pop com motion + gesto de voltar
  Sheet.tsx             → bottom sheet (vaul): detents pequeno/médio/grande
  ActionSheet.tsx       → lista de ações (cancelar separado) para confirmações
  ContextMenu.tsx       → long-press (substitui menus de hover)
  PullToRefresh.tsx     → @use-gesture, só no topo do scroll
  SwipeRow.tsx          → swipe-to-action em listas (excluir, marcar)
  SegmentedControl.tsx  → já existe como padrão em Gallery; extrair e tornar acessível (radiogroup)
  ListRow.tsx / Section.tsx → "inset grouped list" para Configurações
  Toast.tsx             → banner no topo, aria-live
  Skeleton.tsx          → shimmer padrão
  Haptics.ts            → wrapper único (Capacitor → vibrate → no-op)
```

### 3.2 Estratégia de breakpoints
- **< 768px:** `AppShell` mobile (tab bar + stack). **≥ 768px:** `Layout` atual (Sidebar). Um hook `useIsMobile()` com `matchMedia` + `useSyncExternalStore`, sem flicker na hidratação.
- **iPad (768–1180px):** `NavigationSplitView`-like: sidebar colapsável + conteúdo; tab bar some.
- Rotação: paisagem no iPhone esconde a tab bar apenas no Reader.

### 3.3 Mapa de navegação proposto

**Tab bar (5):** `Início` · `Biblioteca/Galeria` · `Praticar` · `Comunidade` · `Perfil`
- **Praticar** abre uma tela hub com *Falar*, *Ditado*, *Palavras (revisão)*, *Estatísticas* (hoje espalhados em 4 abas).
- **Perfil** concentra Configurações, Palavras, Estatísticas, Admin (se admin) como `ListRow`s — resolve G6 (Admin deixa de ser 6ª aba).
- Busca vira **barra de busca na NavBar** (pull-down na lista) + `CommandPalette` só no desktop (hoje `Search` ocupa o ícone do header).

**Stack:** `/book/:id`, `/gallery/:id`, `/profile/:id`, `/practice/:kind` entram como *push* com botão voltar e swipe-back. Reader é **tela cheia modal** (sem tab bar).

**Sheets:** filtros da Galeria, seletor de voz, tamanho de página, VoiceCast, nota, tooltip de palavra, configurações do Reader, ações de livro (long-press).

---

## 4. Fases de implementação

Cada fase termina **entregável e testável**. Estimativas para 1 dev focado.

### Fase 0 — Fundação e medição (1–2 dias)
- [ ] `index.html`: `viewport-fit=cover`, `theme-color` (light/dark via `media`), `color-scheme`, `lang` dinâmico (corrige G16), `apple-mobile-web-app-capable`, `-status-bar-style=black-translucent`, `-title`, `format-detection=telephone=no`.
- [ ] `index.css`: tokens da §2.1, `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation` global (elimina zoom por duplo toque), `overscroll-behavior-y: none` no `body` + `contain` nos scrolls internos, `-webkit-text-size-adjust: 100%`, `-webkit-touch-callout: none` em elementos de UI (não no texto do Reader).
- [ ] Trocar `min-h-screen` por `min-h-dvh`; `100vh` por `100dvh`.
- [ ] Auto-hospedar fontes (`@fontsource-variable`), reduzir a só as usadas, `font-display: swap`, preload da principal (G15). Remover o `<link>` duplicado.
- [ ] Hook `useViewport()` (`visualViewport` → `--kb-h`) para G18.
- [ ] Linha de base: Lighthouse mobile (Performance/A11y/PWA), axe DevTools, teste em **iPhone SE (375×667), iPhone 15 (393×852), 15 Pro Max (430×932), iPad mini**.
- **Pronto quando:** safe areas funcionam no iPhone real, sem zoom de duplo toque, sem barra do Safari cobrindo conteúdo.

### Fase 1 — Primitivos de UI nativos (4–6 dias)
- [ ] **Migrar `ui/dialog.tsx` para Radix Dialog** (focus-trap, aria, scroll-lock, devolve foco — fecha G7). Mesma API pública para não quebrar os ~10 usos.
- [ ] `Sheet` (vaul) com detents; `Dialog` vira `Sheet` automaticamente abaixo de 768px (mantém card centrado no desktop).
- [ ] `ActionSheet`, `ContextMenu` (long-press 450ms + haptic + menu), `Toast`, `Skeleton`, `SegmentedControl`, `Switch`, `Slider` (Radix).
- [ ] `ui/button.tsx`: tamanhos mínimos 44px no mobile (`min-h-[var(--hit)]`), estado `:active` com `scale(.97)` + escurecer; `btn-3d` mantém o look mas ganha `:active`.
- [ ] Trocar `hover:` por `@media (hover:hover)` (Tailwind 4: variante `hover:` já usa isso por padrão — **verificar** e criar utilitário `active:` equivalente nos 35 arquivos, G13).
- [ ] `Haptics.ts`: `selection`, `impactLight/Medium`, `success`, `warning`, `error`; no web usa `navigator.vibrate` (Android) e no-op no Safari; no Capacitor usa o plugin.
- **Pronto quando:** todo modal do app abre como sheet no mobile, fecha arrastando, foco preso e devolvido.

### Fase 2 — Casca: tab bar, nav bar, navegação (5–7 dias)
- [ ] `TabBar` de 5 itens (§3.3), ícones preenchidos quando ativos, badge (palavras para revisar, notificações), **toque na aba ativa = voltar à raiz / rolar ao topo**, mantém a pilha de cada aba (preservar scroll por aba com `useRef`/store).
- [ ] `NavBar`: translúcida (`--blur-bar`), botão voltar com título da tela anterior, ações à direita; `LargeTitle` colapsável nas telas de lista (Início, Galeria, Comunidade, Praticar, Perfil). Fecha G4.
- [ ] Remover o drawer lateral no mobile (G5); o conteúdo vai para a aba Perfil. Manter `Sidebar` no desktop/iPad.
- [ ] `ScreenTransition`: push (slide + parallax 30%) / pop, `AnimatePresence` + `useNavigationType()`; cross-fade entre abas; **swipe-back da borda esquerda** (`@use-gesture`, zona de 20px, cuidado com o carrossel horizontal).
- [ ] Restaurar scroll ao voltar; `<ScrollRestoration>` do react-router + posição por aba.
- [ ] Busca: campo na NavBar com cancelar; resultados em tela própria.
- **Pronto quando:** navegar o app inteiro com polegar, sem usar o canto superior esquerdo nem hambúrguer.

### Fase 3 — Telas principais repensadas para mobile (8–12 dias)
Por tela, o que reescrever (não só "ajustar CSS"):

| Tela | Mudanças |
|---|---|
| **Início (`Dashboard`, 630 linhas)** | Título grande "Olá, {nome}"; seções horizontais com `scroll-snap`; cartão "Continuar lendo" fixo no topo; sequência/XP em cabeçalho compacto; pull-to-refresh; long-press na capa → ActionSheet (abrir, remover, compartilhar); swipe na lista de livros. Dividir o arquivo em seções. |
| **Livro (`BookPage`)** | Capa com *hero*; CTA primário fixo acima da tab bar; capítulos em `ListRow`; menu "…" em ActionSheet. |
| **Galeria** | Filtros (CEFR, categoria, autor) saem da linha e vão para **Sheet de filtros** com contagem + "Aplicar"; chips de filtro ativos removíveis; grid 2 colunas (3 no iPad), `aspect-[2/3]` mantido; skeletons. |
| **Comunidade / Perfil** | Perfil com banner colapsável, `SegmentedControl` (Livros/Atividade), botão Seguir fixo na NavBar ao rolar; share nativo. |
| **Palavras (`VocabularyPage`)** | Lista tipo "Mail": swipe esquerda = aprendida, direita = revisar (cores `learned`/`review` já existentes); busca na NavBar; seleção múltipla com barra inferior; `VocabularyModal` → Sheet com detents. |
| **Praticar (Falar/Ditado)** | Hub + telas imersivas; botão de gravar grande (≥ 72pt) com haptic; waveform; permissão de microfone com tela explicativa antes do prompt do sistema. |
| **Estatísticas** | Cartões empilhados; gráficos com rótulos legíveis ≥ 12px e alternativa em texto/tabela (a11y); heatmap rolável. |
| **Configurações** | *Inset grouped list* iOS (`Section` + `ListRow` com chevron, `Switch`, valor à direita); cada sub-tela é push; `AvatarCropDialog` como sheet tela cheia. |
| **Login/Cadastro** | `autocomplete`, `inputmode`, `enterkeyhint`, `autocapitalize=off`, botão acima do teclado (`--kb-h`); suporte a "Entrar com Apple/Google" (obrigatório na App Store se houver login social); Face ID na Fase 7. |
| **Admin** | Aceitável responsivo simples; fora do foco, vai para Perfil. |

### Fase 4 — O Reader (a tela mais importante) (8–12 dias)
Reader.tsx tem 1744 linhas; **refatorar antes de adaptar** (separar `ReaderTextView`, `ReaderComicView`, `ReaderToolbar`, `ReaderSheets`, `useReaderGestures`).

- [ ] **Modo imersivo:** toque no centro mostra/oculta barras (NavBar + toolbar) com fade; status bar some em paisagem.
- [ ] **Barra inferior** (hoje `fixed left-2 right-2`, L1408): vira *toolbar* de ícones (≥ 44pt) com ações principais; secundárias em "…" (ActionSheet). Respeita `--safe-b` e sobe com o teclado só nas notas.
- [ ] **Painel lateral `fixed right-8 w-80` (L1120) → Sheet** com detents (peek/médio/cheio) no mobile.
- [ ] **Post-its `w-[min(90vw,42rem)]` (L1045) → Sheet de nota**; no iPad continuam flutuantes.
- [ ] **Toque numa palavra:** `WordTooltip` vira *sheet pequeno* ancorado embaixo (tradução, áudio, "salvar") em vez de popover flutuante; destacar a palavra tocada; haptic leve. **Long-press = selecionar frase** (substitui o modo "Selecionar texto" separado, ou mantém como atalho).
- [ ] **Gestos de página:** HQ (`ComicPageView`) com swipe horizontal (já é slideshow), **pinch-to-zoom** + duplo toque, pan com inércia, `touch-action: none` só no canvas; pré-carregar página ±1; indicador de página `n/total` com scrubber (slider) arrastável.
- [ ] **Texto:** tamanho de fonte pelo painel "Aa" (sheet) com slider, famílias (Literata/Newsreader/Inter), espaçamento, margens, temas (light/sepia/dark/auto); respeitar tamanho de texto do sistema.
- [ ] **Áudio/TTS:** Media Session API (`navigator.mediaSession`: play/pause/próximo, metadados capa+título) para controlar da tela de bloqueio; **Screen Wake Lock** durante leitura; fallback `speechSynthesis` quando o modelo local não cabe na memória (G20); pausar ao receber chamada/ir ao background.
- [ ] **Balões da HQ:** edição de balão (`useComicBalloonEditor`) com handles de ≥ 44pt e modo "arrastar" explícito para não brigar com o scroll.
- [ ] **Progresso:** salvar posição a cada mudança de página (debounce) e ao `visibilitychange`; retomar exatamente onde parou.
- **Pronto quando:** ler um capítulo e uma HQ inteiros no iPhone só com o polegar, sem pinçar a página do navegador, sem barras sobrepostas.

### Fase 5 — Acessibilidade e responsividade (contínua, com bloco de 4–5 dias de auditoria)
Ver §5 (checklist completo). Entrega: relatório axe zerado em "serious/critical" + teste manual com VoiceOver.

### Fase 6 — PWA (3–4 dias)
- [ ] `vite-plugin-pwa` (`registerType: 'prompt'`, atualização com Toast "Nova versão — Atualizar").
- [ ] `manifest.webmanifest`: `display: standalone`, `orientation: any`, `theme_color`/`background_color` por tema, `lang`, `shortcuts` (Continuar lendo, Praticar, Palavras), `categories: education,books`.
- [ ] Ícones: 180×180 (apple-touch), 192/512 (+ maskable), splash screens iOS (`apple-touch-startup-image` por dispositivo, gerar com `pwa-asset-generator`).
- [ ] **Cache (Workbox):** *precache* do shell; *stale-while-revalidate* para capas/ilustrações; *network-first* com fallback para chamadas Supabase de leitura; **modelos de TTS em Cache Storage persistente** (`navigator.storage.persist()`), com aviso de tamanho e botão "Baixar para offline".
- [ ] **Offline de leitura:** livros abertos salvos em IndexedDB (já há uso de IndexedDB/localStorage em 8 arquivos — consolidar numa camada `offlineStore`); fila de sincronização para progresso/palavras salvas offline; banner "Você está offline".
- [ ] **Prompt de instalação:** no iOS não há `beforeinstallprompt`; criar *sheet* "Adicionar à Tela de Início" com instruções (ícone Compartilhar → Adicionar), exibido após 2ª sessão e uma única vez.
- [ ] Web Push (iOS 16.4+, só instalado): lembrete diário de estudo/sequência, com opt-in contextual (não no primeiro acesso).
- [ ] `vercel.json`: cabeçalhos de cache corretos (`sw.js` sem cache, assets com hash `immutable`), manter o rewrite SPA.
- **Pronto quando:** instalar no iPhone, abrir em tela cheia, ler um livro com o modo avião ligado.

### Fase 7 — Shell nativo com Capacitor (5–8 dias, opcional mas recomendado para a App Store)
- [ ] `npx cap init`, `cap add ios`; `server.url` só em dev; build de produção embutido.
- [ ] Plugins: **Haptics** (substitui o wrapper), **StatusBar** (estilo por tema), **Keyboard** (resize `native`, accessory bar), **Splash Screen**, **Share** (compartilhar livro/perfil/palavra), **App** (deep links `bookmoo://`, Universal Links, botão voltar), **Push Notifications** (APNs), **Preferences**, **Biometric** (Face ID para reabrir sessão), `@capacitor-community/speech-recognition` se `webkitSpeechRecognition` falhar no WKWebView.
- [ ] Auth: OAuth via browser nativo + deep link de retorno; Sign in with Apple.
- [ ] Verificar WKWebView: WebGPU/WASM threads (TTS local) — se indisponível, TTS nativo (`AVSpeechSynthesizer` via plugin) como fallback.
- [ ] Conformidade App Store: Privacy Manifest, descrições de uso (microfone, notificações), política de privacidade (`/privacy` já existe), exclusão de conta dentro do app (exigência da Apple), sem links que burlem compra, classificação etária, capturas de tela 6,9" e 6,5".
- [ ] CI: build iOS via Xcode Cloud/Fastlane → TestFlight.
- **Pronto quando:** build no TestFlight com push, haptics, share e deep link funcionando.

---

## 5. Checklist de acessibilidade (WCAG 2.2 AA + HIG)

### 5.1 Percepção
- [ ] Contraste texto ≥ 4.5:1 e UI/ícones ≥ 3:1 **nos 3 temas** (revisar `--theme-nav-text-muted #91918E` sobre `#FBFBFA` ≈ 3:1 → escurecer; `--theme-text-secondary #73726E` conferir; pastéis `*-fg` sobre `*-bg`). Script de verificação automática dos pares de tokens.
- [ ] Nenhuma informação só por cor (vocab aprendida/revisar/importante ganham ícone + texto além da cor).
- [ ] Texto escala até 200% sem perder conteúdo (usar `rem`, sem `px` em altura de contêiner de texto); `text-[9–11px]` (29 usos) eliminados.
- [ ] Imagens: `alt` descritivo nas capas; ilustrações decorativas com `alt=""` + `aria-hidden`; **HQ: texto alternativo por quadro/balão** (o texto dos balões já existe — expor em ordem de leitura).
- [ ] Reflow a 320px sem rolagem horizontal; orientação livre (sem travar retrato).
- [ ] `prefers-reduced-motion`: desligar springs, parallax, shimmer, confete/XP; `prefers-reduced-transparency`/`prefers-contrast: more`: trocar blur por cor sólida e bordas mais fortes; `prefers-color-scheme`: tema "Automático".

### 5.2 Operabilidade
- [ ] Alvos ≥ 44×44pt (iOS) — auditar os 48 ícones/avatares de 24–35px e `w-8/w-9` botões; ampliar área de toque com `::before` quando o visual deve ficar menor; espaçamento ≥ 8px entre alvos.
- [ ] Todo gesto tem alternativa por toque simples (swipe-row → botão "Mais" no menu; pinch → botões +/–; arrastar scrubber → botões página anterior/próxima) — WCAG 2.5.1/2.5.7.
- [ ] Foco visível (`:focus-visible`) em **todos** os interativos (hoje só em 6 arquivos); suporte a teclado Bluetooth/iPad: Tab, Enter/Espaço, Esc, setas no Reader (← → páginas), `Cmd+K` busca.
- [ ] Sem armadilha de foco; modais devolvem o foco ao disparador; `inert` no conteúdo de fundo.
- [ ] Skip link "Ir para o conteúdo"; ordem de foco = ordem visual.
- [ ] Sem ações no `pointerdown`; cancelável por arrastar para fora (2.5.2).
- [ ] Tempo: nenhum auto-avanço sem pausa (TTS tem pausa; toasts ≥ 6s ou persistentes para erros).

### 5.3 Compreensão e robustez (VoiceOver)
- [ ] Landmarks: `header`, `nav` (aria-label), `main`, `aside`; um `h1` por tela, hierarquia sem saltos.
- [ ] `TabBar` com `role=tablist`/`tab` **ou** `nav` + `aria-current` (já usado); rótulos completos ("Praticar, aba 3 de 5").
- [ ] `aria-live=polite` para toasts, progresso de download do TTS, "palavra salva"; `role=status` em loaders; `aria-busy` nas listas carregando.
- [ ] Sheets: `role=dialog`, `aria-modal`, título associado (`aria-labelledby`), anunciar abertura, "Fechar" localizado (hoje `aria-label="Fechar"` fixo em pt — usar i18n).
- [ ] Rotores do VoiceOver: capas de livro como links com nome + autor + nível ("O Pequeno Príncipe, A2, 3 de 12"); ações customizadas via `aria-describedby`/botões visíveis para swipe-rows.
- [ ] Reader: palavras tocáveis como `<button>` (ou `role=button` + `tabindex`) com `aria-label` "Traduzir {palavra}"; anunciar tradução; leitura contínua pelo sistema não pode ser bloqueada por handlers de toque.
- [ ] Formulários: `<label>` associado, `autocomplete`, erros com `aria-invalid` + `aria-describedby`, foco no primeiro erro.
- [ ] `lang` por trecho (`<span lang="en">`) em conteúdo bilíngue para pronúncia correta; `lang` do documento acompanha o idioma da interface.
- [ ] Sem texto como imagem; ícone-botão sempre com nome acessível (lint `jsx-a11y`).

### 5.4 Ferramentas e testes
- [ ] `eslint-plugin-jsx-a11y` no projeto (hoje só há `tsc --noEmit` como lint).
- [ ] `@axe-core/playwright` em CI nas rotas principais × 3 temas × 2 viewports.
- [ ] Roteiro manual: **VoiceOver** (iPhone real), **Voice Control**, **Switch Control**, zoom de tela, texto maior (Ajustes → Acessibilidade), "Reduzir Movimento", "Aumentar Contraste", teclado Bluetooth.
- [ ] Declaração de acessibilidade para a App Store ("Accessibility Nutrition Labels").

---

## 6. Responsividade

| Faixa | Layout |
|---|---|
| 320–389 (SE, mini) | 1 coluna de listas, grid de capas 2 col, toolbar do Reader com 4 ícones + "…" |
| 390–767 (iPhone padrão/Max) | Padrão da §3; grid 2 col; sheets com detents |
| 768–1023 (iPad retrato) | Sem tab bar → sidebar colapsável; grid 3–4 col; sheets viram popovers/formulários centrados |
| 1024+ (iPad paisagem/desktop) | Layout atual (Sidebar + conteúdo); Reader com painel lateral real |

- Containers com `clamp()`, `min()`, container queries (`@container`, Tailwind 4) nos cartões e `BookCard`.
- Imagens: `srcset`/`sizes` nas capas, `loading=lazy`, `decoding=async`, `aspect-ratio` reservado (evita CLS).
- Teclado virtual: `--kb-h` ajusta barras fixas; `scrollIntoView` no campo focado.
- Split View/Slide Over do iPad: layout reage à largura, não ao device.
- Dinâmica de texto: testar com fonte do sistema em "AX3".

---

## 7. Desempenho (parte da sensação de app)

- **Meta:** LCP < 2,0s em 4G, INP < 200ms, CLS < 0,05; 60fps em transições (só animar `transform`/`opacity`).
- Code-splitting por rota (`React.lazy`) — o Reader, Admin e Gallery não precisam entrar no bundle inicial; `kokoro-js`/`transformers` **só sob demanda**, em Web Worker (já existe `tts-worker/`; confirmar).
- Listas longas (Palavras, Galeria, Comunidade): virtualização (`@tanstack/react-virtual`) e paginação por cursor no Supabase.
- Cache de dados: stale-while-revalidate (TanStack Query ou camada simples sobre zustand) para telas abrirem instantâneas com dados antigos.
- Optimistic UI em seguir, salvar palavra, estrela; rollback com toast de erro.
- `content-visibility: auto` em seções longas; `will-change` só durante animação.
- Memória no iOS: descarregar modelo de TTS ao ir para background; limite de páginas de HQ em memória (±2).
- Medir com `web-vitals` → enviar ao Supabase/console em produção.

---

## 8. Recursos nativos: matriz

| Recurso | PWA (iOS) | Capacitor | Uso no Bookmoo |
|---|---|---|---|
| Haptics | ✗ (sem Vibration API no Safari) | ✓ | Salvar palavra, virar página, acerto/erro no ditado, seleção de aba |
| Status bar / safe areas | ✓ (meta + CSS) | ✓ | Estilo por tema |
| Compartilhar | ✓ `navigator.share` | ✓ | Livro, perfil, palavra, conquista |
| Push | ✓ 16.4+ (instalado) | ✓ APNs | Lembrete de estudo, sequência em risco, novo seguidor |
| Controle de mídia (tela bloqueada) | ✓ Media Session | ✓ | Play/pause do TTS |
| Wake Lock | ✓ 16.4+ | ✓ | Tela acesa lendo |
| Microfone/fala | ✓ (HTTPS) | ✓ | Prática de fala |
| Biometria | ✗ | ✓ | Reabrir sessão |
| Deep link | ✗ | ✓ Universal Links | Abrir livro/perfil por URL |
| Offline | ✓ SW + IndexedDB | ✓ | Leitura sem rede |
| Badge do ícone | ✓ `setAppBadge` | ✓ | Palavras a revisar |
| Widgets/Atalhos Siri | ✗ | Plugin nativo/Swift | Fase futura: widget "Sequência" |
| Dictation/Scribble, Dynamic Island | — | — | Fora de escopo |

---

## 9. Plano de testes

1. **Dispositivos reais:** iPhone SE 3, iPhone 15, iPhone 15 Pro Max, iPad mini/Air (Safari e PWA instalado); mínimo iOS 16.4, alvo iOS 18/26.
2. **Automatizado:** Playwright com `devices['iPhone 15']` e `['iPad (gen 7)']` — fluxos: login → abrir livro → tocar palavra → salvar → praticar; axe em cada rota; screenshot visual regression em 3 temas.
3. **Manual:** roteiro de gestos (swipe-back, pull-to-refresh, long-press, pinch), teclado virtual em cada formulário, rotação, modo avião, troca de app/volta (retomar leitura), chamada recebida durante TTS.
4. **Critérios de aceite globais:** nenhuma tela com rolagem horizontal; nenhum alvo < 44pt nas telas principais; axe sem erros serious/critical; Lighthouse PWA ≥ 90 e A11y ≥ 95; nenhum zoom acidental; sem conteúdo coberto por barra/teclado/notch.

---

## 10. Cronograma e ordem de execução

| Fase | Esforço | Depende de | Entrega visível |
|---|---|---|---|
| 0 Fundação | 1–2 d | — | Safe areas, sem zoom, fontes locais |
| 1 Primitivos | 4–6 d | 0 | Sheets, ActionSheet, Dialog acessível |
| 2 Casca/navegação | 5–7 d | 1 | Tab bar, nav bar, push/pop, swipe-back |
| 3 Telas | 8–12 d | 2 | App inteiro com cara iOS |
| 4 Reader | 8–12 d | 1, 2 | Leitura imersiva, gestos, mídia |
| 5 Acessibilidade | 4–5 d + contínuo | 1–4 | Relatório axe/VoiceOver |
| 6 PWA | 3–4 d | 0 | Instalável + offline |
| 7 Capacitor | 5–8 d | 3, 4, 6 | TestFlight |

**Total estimado:** ~38–56 dias úteis. As fases 3 e 4 podem rodar em paralelo depois da 2 (arquivos diferentes). **Marco mínimo "parece app" (Fases 0–2 + 6): ~2–3 semanas.**

### Ordem sugerida para começar (primeira semana)
1. Fase 0 inteira (index.html, tokens, dvh, fontes) — baixo risco, ganho imediato.
2. `Dialog` → Radix + `Sheet` (destrava o resto).
3. `TabBar` de 5 itens + tela hub "Praticar" + aba "Perfil".
4. `NavBar` + `LargeTitle` em Início e Galeria.

---

## 11. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Safari iOS mata a aba por memória (TTS local) | Fallback `speechSynthesis`; descarregar modelo em background; baixar sob demanda |
| Gestos de swipe-back conflitam com carrosséis/Reader | Zona de borda de 20px; desabilitar na HQ e em elementos `data-no-swipe-back` |
| `Reader.tsx` grande demais para mexer com segurança | Refatorar em módulos antes (Fase 4, 1º item) com teste de regressão manual por checklist |
| WebGPU/WASM threads indisponíveis no WKWebView | Detectar capacidades; TTS nativo via plugin |
| Push no iOS só em PWA instalado | Pedir permissão após instalar e em momento contextual |
| Rejeição na App Store ("apenas um site") | Fase 7 entrega valor nativo: push, haptics, share, offline, biometria, Sign in with Apple |
| Tema em `style={{...}}` inline dificulta variantes `:active`/`focus` | Migrar gradualmente para classes utilitárias com variáveis (`bg-[var(--theme-card-bg)]`) ao tocar cada componente |
| Escopo enorme | Cada fase é independente e publicável; Vercel faz deploy a cada push (ver memória de deploy) |

---

## 12. Definição de pronto ("100% experiência iOS")

- [ ] Abre em tela cheia pelo ícone, sem barra do Safari; splash e status bar combinam com o tema.
- [ ] Navegação por tab bar de 5 itens, push/pop com swipe-back, sheets arrastáveis, ActionSheets e menus de contexto.
- [ ] Todas as telas com título grande/NavBar translúcida, listas agrupadas, pull-to-refresh onde faz sentido.
- [ ] Reader imersivo com gestos, zoom, sheets, Media Session e Wake Lock.
- [ ] Haptics, share, push, offline e deep links (via Capacitor).
- [ ] WCAG 2.2 AA verificado com ferramenta **e** VoiceOver; alvos ≥ 44pt; texto ≥ 12px e escalável; reduce motion/transparency/contrast respeitados.
- [ ] Lighthouse mobile: Perf ≥ 85, A11y ≥ 95, PWA ≥ 90; sem rolagem horizontal ou conteúdo coberto em nenhum dispositivo da matriz.
