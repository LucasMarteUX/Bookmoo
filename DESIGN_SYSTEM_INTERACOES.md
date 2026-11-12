# Design system — interação, ajuda e feedback

Padrão para tudo que a pessoa toca, passa o mouse, espera ou precisa entender.
Código-base: `src/index.css` (bloco "Sistema de interação"), `src/components/ui/{button,tooltip,info-hint,toast,confirm}.tsx`.

## 1. Tokens de movimento

| Token | Valor | Uso |
|---|---|---|
| `--dur-instant` | 90ms | press, troca de ícone |
| `--dur-fast` | 140ms | hover, tooltip |
| `--dur-base` | 220ms | popover, toast, entrada de conteúdo |
| `--dur-slow` | 360ms | sucesso, celebração |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | padrão |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | "pop" de sucesso |
| `--ease-ios` | `cubic-bezier(.32,.72,0,1)` | sheets e toasts |

Com "reduzir movimento" ligado no sistema, todas as animações viram instantâneas (regra global já existente).

## 2. Estados de um elemento clicável

| Estado | Regra |
|---|---|
| Cursor | Tudo que é clicável mostra a mãozinha (regra global); desabilitado mostra "proibido". |
| Hover | Fundo `--ui-hover` (8% da cor do texto) — aparece em claro, sépia e escuro. |
| Press | Fundo `--ui-press` (13%) + `scale(.96)`. |
| Foco (teclado) | Contorno de 2px `--ui-focus`, afastado 2px. O mouse não mostra o anel. |
| Desabilitado | Opacidade 50% e sem eventos. |

- Componente `Button`: já aplica tudo. Variantes `ghost`, `outline` e `secondary` usam `--ui-hover`.
- Botão ou linha feita à mão: use a classe **`ui-hover`** (hover + press + transição).
- **Não use** `hover:bg-[var(--theme-nav-hover)]` (quase invisível no escuro). Use `hover:bg-[var(--ui-hover)]`.

## 3. Tooltip

Uma camada só (`<TooltipLayer />` no `Layout`) cuida do app inteiro:

- `title="…"` ou `data-tip="…"` em qualquer elemento → tooltip do sistema (o nativo do navegador é suprimido).
- Botão **só de ícone** com `aria-label` ganha tooltip automaticamente. **Todo botão de ícone precisa de `aria-label`.**
- Atalho: `data-tip-kbd="Esc"`. Desligar: `data-no-tip`.
- Aparece com o mouse após 380ms (em sequência, na hora) e com o foco do teclado; some ao clicar, rolar ou Esc. Não aparece no toque.
- Texto: verbo + objeto, curto, sem ponto final ("Ouvir áudio", "Excluir palavra").

## 4. Ajuda contextual (i)

`<InfoHint title="…" faq="id">texto</InfoHint>` ao lado de um título ou rótulo.

- Uma ou duas frases explicando **o que é** e **o que acontece**.
- `faq` aponta para uma pergunta em `/faq#id` (abre e rola até ela). Ids atuais: `pagar`, `chave-ia`, `status`, `explicacao`, `traducao`, `nivel`, `livros-privados`, `galeria`, `estilo`, `quadrinhos`, `notas`, `perfil`, `excluir-conta`.
- Usar onde a regra não é óbvia (status, estilos, nível, chave de IA). Não usar em ações autoexplicativas.
- Nova pergunta: adicione em `src/pages/legal/LegalPage.tsx` (pt e en) com um `id`.

## 5. Feedback

| Situação | Como |
|---|---|
| Ação feita (salvar, enviar) | `toast('Salvo')` — check desenhado com "pop", some em 3,5s. |
| Ação destrutiva reversível | Faça na hora e ofereça desfazer: `toast('“x” excluída', { tone: 'info', action: { label: 'Desfazer', onClick } })`. |
| Ação destrutiva irreversível | `await askConfirm('Excluir…?', { danger: true, detail })` antes. Nunca `window.confirm`/`alert` (bloqueados no app). |
| Erro | `toast('Não foi possível salvar', { tone: 'error', detail: 'Verifique a conexão e tente de novo.' })` — treme uma vez, fica 8s. Diga o que fazer. |
| Atenção | `tone: 'warning'` — nada quebrou, mas a pessoa precisa saber. |
| Operação demorada | `toastAsync(promise, { loading, success, error })` — spinner que vira check ou erro. |
| Carregando conteúdo | Classe `skeleton` no lugar do conteúdo (brilho passando). |
| Erro num campo | Mensagem embaixo do campo + `anim-shake` no campo. |

O mouse sobre o toast pausa o tempo (a barra embaixo mostra quanto falta).

## 6. Microanimações prontas

| Classe | Efeito |
|---|---|
| `anim-pop` | entra crescendo com mola (ícone de sucesso, selo, contador) |
| `anim-check` | desenha o traço de um SVG (check de sucesso) |
| `anim-shake` | treme na horizontal (erro) |
| `anim-fade-up` | sobe e aparece (popover, item novo na lista) |
| `skeleton` | placeholder com brilho |
| `toast-in` / `toast-out` | entrada e saída dos avisos |

Regra: animação comunica estado (entrou, deu certo, deu errado). Nada de animação decorativa em loop.
