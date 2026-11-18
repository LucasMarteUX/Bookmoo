# Bia pintada: o que foi feito (guia para o Luck)

Registro do que a Bia pintada ganhou na integração e do que aprendemos, para repetir no Luck sem refazer os mesmos erros.

## Onde está

| O quê | Onde |
|---|---|
| Rig e texturas | `public/characters/bookmoo/bia-pintura/` (`model.json`, `textures/`, `avatar.webp`) |
| Adaptadores da entrega | `src/lib/livliv/painted/` (`queixo_local.js`, `boca_natural.js`, `reacoes.js`, `resposta_cabeca.js`, `movimento_natural.js`, `asset_url.js`) |
| Entrada única | `src/lib/livliv/painted/index.ts` → `setupPaintedBia(player, modelBaseURL)` |
| Cadastro do personagem | `src/lib/livliv/characters.ts` (`painted: true`, `folder`, `zoomK`, `ASSET_REV`, `characterBaseUrl`) |
| Avatar na conversa | `src/components/voice/LivLivAvatar.tsx` |
| Lip sync por fonemas | `src/lib/kokoro/kokoro.worker.ts`, `src/lib/kokoro/engine.ts`, `src/lib/tts.ts`, `src/lib/visemeTrack.ts` |
| Correções de textura reproduzíveis | `scripts/characters/bia-pintura-boca.py`, `scripts/characters/bia-pintura-olhos.py` |

## Conquistas

### Carregamento
- Caminhos dos módulos vêm de `modelBaseURL` (URL absoluta da pasta do modelo, terminada em `/`), nunca `./rig/` nem `import.meta.url`. Funciona em `/conversar` e em produção.
- `asset_url.js` repete o `?v=` da base em todo arquivo, então trocar `ASSET_REV` invalida o cache de tudo de uma vez.
- `loadToken` no avatar: se o personagem trocar enquanto os adaptadores carregam, o resultado atrasado é descartado (antes as reações sumiam porque o adaptador pegava um puppet velho).
- `dispose()` antes de trocar de modelo.

### Convivência com os controladores do app
- Para o personagem pintado, o avatar desliga os drivers próprios que brigariam com a entrega: recentralização, piscadinha antiga, `acts`, `bodyLanguage` (gancho `off`) e o `act` do diretor.
- O olhar segue o mouse também durante a conversa (`lookAt(null)` ouvindo e falando).
- Balão: não "anda" ao começar a conversa nem ao trocar de personagem; o fallback do topo só aparece após 1,5 s sem posição da cabeça.

### Rosto e reações
- 7 reações (neutro, feliz, surpresa, triste, bravo, tímida, piscadinha) por troca atômica de textura na mesma malha.
- Sombra oval em volta da boca: a pele dentro dos recortes da boca não batia com a do rosto; harmonizada (`bia-pintura-boca.py`).
- Cílios fantasmas na piscada: estavam pintados no rosto; foram para a camada do olho aberto (`bia-pintura-olhos.py`). No bravo só contam como cílio pixels escuros a até 9 px da máscara, para não apagar a sobrancelha.
- Sem sorriso na piscada comum (a boca subia a cada piscada e ficava estranho): `setBlinkSmile(..., 0)`.
- Piscadinha: pulso rápido de ~0,38 s (fecha 0,1 s, segura 0,12 s, abre 0,16 s), só o olho esquerdo; o outro fica aberto e não pisca junto. Depois do pulso volta ao neutro mesmo que o app ainda peça `x_wink`.
- Surpresa: só o queixo estica ~5,5 px para baixo (campo local do queixo, peso zero no pescoço), com entrada suave.

### Cabeça e corpo
- Resposta breve por gesto (entra 0,44 s, segura 2,2 s, volta 0,6 s) da entrega.
- Mouse: `angleX/angleY` do olhar passam para a cabeça (±14 / ±10), como na Yuno; a base do corpo fica parada.
- Inclinação lenta que troca de lado a cada 6–12 s (1,6° a 3,4°), em vez de ficar presa para um lado. O balanço do idle em Z continua desligado.
- Mechas, roupa e brincos com molas da entrega.

### Lip sync
- O worker do Kokoro devolve a duração de cada fonema; elas são encaixadas nos trechos com voz do áudio gerado (`alignPhones`).
- `visemeTrack.shapeAt` transforma o fonema da vez em `mouthOpen`/`vowel`, pelo relógio do próprio `<audio>` (pausa, velocidade, fim), com coarticulação e 50 ms de antecipação para compensar a suavização da boca.
- Driver `order: 10.5` no avatar, com trava por amplitude: a boca fecha em silêncios acima de ~120 ms.
- Medido: retomada de fala entre −30 e +40 ms, fechamento até ~60 ms. Vozes do aparelho e do servidor não têm fonemas e usam o lip sync por amplitude.

## Erros que não repetir no Luck
- Não remendar automaticamente íris/branco nas texturas de olho: três tentativas pioraram e foram revertidas. Problema de pintura volta para o artista.
- Teste com o painel escondido: o `requestAnimationFrame` para; avance quadros à mão com `player.draw(1/60)`.
- O sorteio de personagem no carregamento troca o personagem no meio do teste; fixe o personagem no localStorage.
- Imports dinâmicos no console criam outra instância do módulo; use os ganchos DEV (`__lvp`, `__painted`, `__visemeTrack`).

## Pendências da Bia
- Resto de íris antiga nas texturas de olho de surpresa, triste, bravo e tímida (e no olho direito da piscadinha); bravo serrilhado no meio da piscada. Precisa repintar.
- Cantos do sorriso levemente duplicados no começo da abertura em feliz e tímida.
- PNGs ainda não convertidos para WebP.

## Luck pintado (feito)
- Rig em `public/characters/bookmoo/luck-pintura/` (hashes do manifesto conferidos), módulos em `src/lib/livliv/painted/luck/` com a base parametrizada, `setupPainted('luck', ...)`, `painted: 'luck'` em `characters.ts`.
- Ajustes do Bookmoo no Luck: piscadinha em pulso rápido e mouse passando para a cabeça. Mantidos da entrega: sorriso em toda piscada, `REACTION_REST`, `acoes.js`, sem inclinação por timer.
- A pasta antiga `homem/` continua no repositório, sem uso.
- Naturalidade: o corpo balança pela malha com a base fixa (mouse, inclinação e respiração), a inclinação troca de lado como na Bia e as mechas sentem o balanço e um ar leve.
- Pescoço: está na camada do corpo e não seguia o giro da cabeça (desencaixava na saudação). O topo dele recebe o mesmo deslocamento da cabeça, vértice a vértice, sumindo até a gola (y 505–690).
- Piscada: a pálpebra fechada está pintada na linha de baixo; ela agora desce desde os cílios de cima (7–15 px, medido por reação em `LID_DROP`), em vez de aparecer embaixo por transparência.
- Surpresa: queixo estica 5 px (campo local), couro cabeludo sobe ~2,6 px e as mechas recebem um impulso ao entrar.
- Feliz com olhos abertos (olho e pálpebra do neutro): o arco fechado pintado do feliz ficava mais alto e com outro formato que a pálpebra da piscada, e o olho fechado pulava de lugar na saudação.
- Pescoço seguindo a cabeça só na coluna de pele (|x−516| < ~86, y 505–595): a gola começa em y≈500 nas laterais e descolava da camiseta quando entrava no campo.
- Sorriso na piscada desligado também no Luck: ao voltar, os dois contornos ficavam sobrepostos (lábio duplicado).

## Yuno pintada (gola-v4, feito)
- Rig em `public/characters/bookmoo/yuno-pintura/`, módulos em `src/lib/livliv/painted/yuno/` com a base parametrizada (sem `./rig/`, `import.meta.url` nem `?v=gola-v4`; o cache usa `ASSET_REV`). O manifesto desta entrega não traz hashes.
- Versão anterior preservada em `public/characters/bookmoo/yuno/`; o comentário em `characters.ts` diz como voltar.
- Pescoço: a entrega já liga o pescoço à cabeça pelos pesos `wHead` do player (não usar o campo manual do Luck).
- Piscadinha: o rosto fica o neutro durante ela (o rosto x_wink é pintado para o arco fechado da entrega; com a pálpebra da piscada por cima aparecia uma oval maior, fora do rosto). A boca de canto da piscadinha continua.
- Tentativa descartada: mover cílios pintados no rosto para a camada do olho por cor apagou trechos das sobrancelhas no bravo. Texturas voltaram aos originais da entrega.
- Ajustes do Bookmoo aplicados: feliz e piscadinha com olho/pálpebra do neutro (o arco pintado deles pulava de lugar), piscadinha em pulso de ~0,38 s só no olho esquerdo, pálpebra descendo 16–23 px desde os cílios com a pele de cima comprimida (mover a textura inteira subia um traço escuro do topo dela), sem sorriso na piscada, queixo +4 px na surpresa, impulso nas mechas na surpresa, mouse passando para a cabeça, inclinação alternada e balanço do corpo pela malha com base fixa.

## Yuri pintado (yuri-v1, feito)
- Rig em `public/characters/bookmoo/yuri-pintura/`, módulos em `src/lib/livliv/painted/yuri/` (mesma estrutura da Yuno; mudam pontos da boca, mechas e campo do queixo). Versão anterior em `public/characters/bookmoo/yuri/`; comentário em `characters.ts` diz como voltar.
- Mesmos ajustes do Bookmoo da Yuno (olhos do feliz/piscadinha, rosto neutro na piscadinha, pálpebra descendo com `LID_DROP` medido no Yuri, sem sorriso na piscada, surpresa, mouse, inclinação, corpo, mechas).
- `mouthGain: 0.82` em Yuno e Yuri: a abertura máxima do rig dos adolescentes é grande para conversa comum; o lip sync por fonemas multiplica a abertura por esse ganho.
- Alpha conferido sobre branco, cinza e azul-escuro: sem halo.

## Checklist original para o Luck
1. Copiar rig e os seis módulos (inclui `acoes.js`), parametrizar a base, conferir hashes.
2. Generalizar `setupPaintedBia` para `setupPainted(player, base)` e marcar o Luck com `painted: true`.
3. Reaplicar os ajustes do Bookmoo: sem balanço do idle em Z, mouse passando para a cabeça, inclinação alternada, piscadinha rápida, queixo na surpresa (se o artista não já tiver).
4. Atenção: no Luck a entrega pede sorriso em toda piscada e `REACTION_REST` para triste/bravo; não copiar o "sem sorriso" da Bia sem confirmar.
5. Lip sync: já serve a qualquer personagem com voz Kokoro, nada a fazer além de validar com o queixo do Luck.
