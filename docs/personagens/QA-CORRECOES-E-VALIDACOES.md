# Personagens pintados: controle de qualidade, correções e validações

Referência de **18/11/2026**, depois da integração de Bia, Luck, Yuno e Yuri no app. A criação da arte e do rig está na
[documentação do Codex](criacao/README.md). Este documento cobre o que acontece **depois** que um pacote chega: como integrar,
o que conferir, os defeitos que apareceram, como foram corrigidos e como provar que está certo. Vale para personagens novos,
roupas temáticas, cenas e reações novas.

O histórico detalhado da primeira integração (Bia) está em [bia-pintada.md](bia-pintada.md).

---

## 1. Onde fica cada coisa no app

| O quê | Onde |
|---|---|
| Rig e texturas de cada personagem | `public/characters/bookmoo/<nome>-pintura/` (`model.json`, `textures/`, `avatar.webp`) |
| Versões anteriores (para voltar) | `public/characters/bookmoo/{homem,yuno,yuri}/` e a antiga da Bia; o comentário em `characters.ts` diz o que trocar |
| Módulos da entrega (adaptados) | `src/lib/livliv/painted/` (Bia), `painted/luck/`, `painted/yuno/`, `painted/yuri/` |
| Entrada única dos pintados | `src/lib/livliv/painted/index.ts` → `setupPainted(kind, player, modelBaseURL)` |
| Cadastro e enquadramento | `src/lib/livliv/characters.ts` (`painted`, `folder`, `zoomK`, `mouthGain`, `young`, `ASSET_REV`) |
| Avatar, lip sync, palco | `src/components/voice/LivLivAvatar.tsx` |
| Fonemas da voz | `src/lib/kokoro/kokoro.worker.ts` → `engine.ts` → `src/lib/tts.ts` → `src/lib/visemeTrack.ts` |
| Balão e boas-vindas na conversa | `src/pages/ConversePage.tsx` |
| Banner da home | `src/components/TutorsBanner.tsx` + `public/characters/bookmoo/banner/` |
| Scripts de correção de textura | `scripts/characters/` |

---

## 2. Roteiro de integração de um pacote novo

1. **Copiar** `rig/` inteiro para `public/characters/bookmoo/<nome>-pintura/` e os seis módulos para `src/lib/livliv/painted/<nome>/`.
   Conferir os hashes quando o manifesto trouxer (o da Yuno não trazia).
2. **Tirar os caminhos locais** dos módulos: nada de `./rig/`, `import.meta.url`, `location.href` ou `?v=...` fixo. Tudo vem de
   `modelBaseURL` (pasta do modelo terminada em `/`) por `assetUrl()` (`painted/asset_url.js`), que repete o `?v=` da base em
   cada arquivo. `configurarMovimentoNatural(player, modelBaseURL)` repassa a base para a boca e as reações.
   Conferir com `grep -n "rig/\|import.meta\|location\|?v=" painted/<nome>/*.js` (só pode sobrar comentário).
3. **Aplicar os ajustes do Bookmoo** (seção 4). Os pacotes Yuno e Yuri têm a mesma estrutura; o patch da Yuno serve de modelo,
   trocando só as medidas do personagem.
4. **Registrar** em `index.ts` (import + `PaintedKind`) e em `characters.ts` (`folder`, `painted`, `zoomK`, `mouthGain`,
   `young`), e subir `ASSET_REV` para o navegador não misturar textura antiga com máscara nova.
5. **Miniatura** `avatar.webp` 320×320 recortada do `00_master.png` (fundo escuro do app).
6. **Validar** (seção 5) antes de publicar.

O avatar instala os adaptadores **uma vez por carregamento** (`loadToken` + comparação do puppet: se o personagem trocar
enquanto carrega, o resultado atrasado é descartado) e chama `dispose()` antes de trocar de modelo. Para os pintados ele
desliga os controladores próprios que brigariam com a entrega (recentralização, piscadinha antiga, `acts`, `bodyLanguage`,
o `act` automático do diretor).

---

## 3. Defeitos encontrados e correções

### Olhos

| Defeito | Causa | Correção |
|---|---|---|
| Olho fechado "pula de lugar" no feliz e na piscadinha | O feliz/piscadinha da entrega fecham com um arco pintado mais alto e de outro formato que a pálpebra da piscada normal; cada troca mudava o desenho do olho fechado | Feliz e piscadinha usam olho e pálpebra do **neutro**; o fechamento é sempre pela pálpebra (`ei = 0` em `reacoes.js`). No feliz os olhos ficam abertos |
| Pálpebra aparece já embaixo ao piscar | A pálpebra fechada é pintada na linha de baixo e entrava por transparência | A pálpebra **desce** desde os cílios de cima (`LID_DROP`, medido por reação e por lado nas texturas: mediana da linha dos cílios no olho aberto × na pálpebra) |
| Traço escuro acima do olho ao piscar | Mover a textura inteira da pálpebra subia a borda de cima dela | Só a linha dos cílios sobe; a pele acima dela **comprime** (o topo da textura fica parado) |
| Piscadinha travada e o outro olho piscando junto | A reação mantinha o olho fechado o tempo todo da reação | Pulso curto só no olho esquerdo; o direito fica aberto; depois volta ao neutro |
| Na piscadinha da Yuno, olho fechado "maior e fora do rosto" | O rosto `x_wink` é pintado para o arco da entrega; a pálpebra neutra por cima virava uma oval | Durante a piscadinha o **rosto fica o neutro**; só a boca de canto continua |
| Piscadinha de todos: olho que pisca "maior"/oval fantasma e o outro olho mudando | (1) Fechar em 0,1 s e abrir em 0,16 s deixava vários quadros no meio do caminho do player, que achata o olho para o centro e mistura a pálpebra semitransparente; (2) Bia e Luck trocavam rosto e os dois olhos para as texturas `x_wink` (olho aberto diferente, olho fechado pintado no rosto); (3) no Luck a pálpebra do olho que pisca não descia | A piscadinha é a **piscada normal num olho só, segurada**: fecha em 0,07 s, segura até 0,31 s, abre em 0,14 s (total 0,45 s). Os quatro usam rosto, olhos e pálpebras do neutro; a pálpebra desce de cima (`LID_DROP`) no olho que pisca; o outro olho fica exatamente como no neutro. Validado quadro a quadro (1/60 s) nos quatro |
| Cílios fantasmas na Bia | Cílios pintados no rosto, fora da camada do olho | Movidos para a camada do olho aberto (`scripts/characters/bia-pintura-olhos.py`); no bravo só contam pixels escuros a até 9 px da máscara, para não apagar a sobrancelha |

**Tentativa descartada:** mover cílios do rosto para o olho por cor na Yuno apagou trechos das sobrancelhas do bravo. Texturas
voltaram ao original. Correção de textura por cor só com máscara geométrica restrita e conferência visual de **todas** as
reações, principalmente bravo.

**Pendência de arte:** a pálpebra fechada da Yuno não tem o pedaço de mecha que cruza o olho esquerdo (a mecha some por um
instante ao piscar). Resto de íris antiga em olhos de reação da Bia. Os dois pedem retoque de pintura.

### Boca

| Defeito | Causa | Correção |
|---|---|---|
| Boca sobe a cada piscada (sorriso da piscada) | `setBlinkSmile` | Desligado em todos (`setBlinkSmile(…, 0)`). A entrega pede esse sorriso; ficou fora por decisão do produto |
| Lábio duplicado ao desfazer o sorriso da piscada | Crossfade de dois contornos | Mesmo ajuste acima |
| Sombra oval em volta da boca (Bia) | Pele dentro dos recortes da boca diferente da do rosto | Pele harmonizada (`scripts/characters/bia-pintura-boca.py`) |
| Bico da surpresa sem queixo | O queixo só descia com a fala | Na surpresa o queixo estica 4–5,5 px pelo **mesmo campo local** do queixo (pescoço com peso 0) |
| Adolescentes abrindo a boca demais | A abertura máxima do rig deles é grande para conversa comum | `mouthGain: 0.82` em Yuno e Yuri |

Atenção ao testar: o app troca a reação sozinho (`react` com tempo de volta). Uma captura "triste com boca em sorriso" pode
ser o app voltando para neutro, e não defeito. Sempre registrar `reacoes.state.active` junto da captura.

### Cabeça, corpo, pescoço e cabelo

| Defeito | Causa | Correção |
|---|---|---|
| Mouse não mexia a cabeça | O adaptador zerava `angleX/Y` vindos do olhar | `angleX/Y` passam para a cabeça (limitados a ±14 / ±10) |
| "Sempre inclinado para um lado" | Só a pose do gesto inclinava | Inclinação lenta que troca de lado a cada 6–12 s (1,6°–3,4°). O balanço do idle em Z continua desligado |
| Luck "travado", corpo parado | Rig com `body.yaw/roll = 0` e `bodyMotion` desligado nos pintados | Balanço do corpo **pela malha**: cisalhamento que cresce da base (parada) até a cabeça, com mola, levado pelo mouse, pela inclinação e pela respiração |
| Cabelo parado (Luck) e cabelo parado na surpresa | Molas só reagiam à aceleração da cabeça | Mechas sentem o balanço do corpo e um ar leve; na surpresa o couro cabeludo sobe ~2,6 px e as mechas levam um impulso |
| Pescoço desencaixado na saudação (Luck) | Pescoço na camada do corpo, cabeça girando 16°–24° | O topo do pescoço recebe o deslocamento da cabeça, **vértice a vértice**, só na coluna de pele (|x−516| < ~86, y 505–595) |
| Gola descolando da camiseta (Luck) | A primeira versão do campo do pescoço pegava as laterais da gola | Campo restrito à pele; a gola fica presa ao corpo |
| (Yuno/Yuri) | — | A entrega já liga o pescoço à cabeça pelos pesos `wHead`; não usar o campo manual do Luck neles |

### Palco, balão e banner

| Defeito | Causa | Correção |
|---|---|---|
| Bia/Luck grandes e cortados, adolescentes pequenos | Mesmo zoom para rigs desenhados em escalas diferentes (cabeça de 407 a 522 px no modelo) | `zoomK` por personagem (Bia 0,86, Luck 0,89, Yuno 1,0, Yuri 1,04); adultos um pouco mais altos (topo do cabelo 3,5% mais alto que o dos adolescentes) |
| Balão em cima do cabelo da Yuno/Yuri | A medida do topo do cabelo era feita com o personagem alto demais: o cabelo saía da tela e o topo era achado na linha 0 | Mede com o personagem abaixado (`yMeasure = baseY − 0,25`) e desenha o quadro atual antes da foto; folga de 36 px acima do cabelo |
| Boas-vindas aparecendo antes do personagem | Balão esperava o carregamento, não o fim do "chamando" | `onReady` só é verdadeiro quando o personagem está **visível** (`ready && !calling`); na troca o balão some até o novo aparecer |
| Enquadramento antigo grudado no navegador | Cache em `localStorage` | A chave `bookmoo:stage-framing:vN` sobe a cada mudança de enquadramento (hoje v9) |
| Banner: bustos esticados | `aspect-ratio` ignorado no botão absoluto | Altura explícita em % do grupo + `object-contain`; imagens versionadas (`?v=`) |
| Banner: corte reto embaixo ao subir no hover | Busto terminava rente à borda | Bustos com 60 px a mais embaixo, escondidos abaixo da borda do cartão |
| Banner: braços cortados | Recorte mais estreito que os braços | Cada busto na largura inteira dos braços; Luck atrás dos vizinhos (a imagem dele encosta nas laterais) |
| Banner: balão da Bia cortado | Centralizado no busto colado na borda | Balões das pontas ancorados pela borda de dentro |

**Fechar o banner:** o X esconde o banner; ele volta depois de 1 semana sem conversar com um tutor (1º fechamento),
2 semanas (2º) e 1 mês (3º em diante), contando do que for mais recente entre o fechamento e a última conversa
(`lastTalkedAt` em `useAvatarSettings`). A cada volta o título e o texto mudam. Guardado no aparelho em
`bookmoo.tutorsBanner.v1`.

### Tempo de chamada

Medido em 18/11/2026: o personagem fica pronto em **~0,45 s** depois da troca; o pacote de voz (Kokoro) **não** é baixado
ao abrir a conversa e não atrasa o personagem. Os ~3,4 s até aparecer vêm da animação fixa de "chamando" (`CALL_MS = 3000`),
mantida de propósito.

---

## 4. Ajustes do Bookmoo que todo personagem pintado recebe

Estes ajustes ficam por cima da entrega e precisam ser reaplicados (e conferidos) em todo pacote novo:

1. Olhar do mouse passando para a cabeça; inclinação lenta alternando de lado; balanço do idle em Z desligado.
2. Corpo balançando pela malha com a base fixa (constantes `BASE_Y`, `TOP_Y` por personagem).
3. Mechas com acoplamento ao balanço do corpo e ar leve; impulso e couro cabeludo na surpresa.
4. Feliz e piscadinha com olho/pálpebra do neutro; piscadinha em pulso; rosto neutro durante a piscadinha (Yuno, Yuri).
5. Pálpebra descendo dos cílios com `LID_DROP` e `LASH_ROW` **medidos nas texturas do personagem** (nunca copiados).
6. Sem sorriso na piscada.
7. Queixo esticando na surpresa pelo campo local.
8. `mouthGain` conforme o rig (adolescentes 0,82).
9. `zoomK` pela altura da cabeça (topo do cabelo ao queixo nas `anchors` do `model.json`) e `young` para o degrau de altura.

Quando um pacote novo trouxer a regra contrária (ex.: "toda piscada com sorriso", "feliz fecha os olhos", "sem vento"),
**confirmar com o produto** antes de manter o ajuste. Todos esses pontos já foram pedidos explicitamente pelo produto.

---

## 4b. Atuação na fala (todos os tutores)

Baseada em estudos de gesto co-verbal (o pico do gesto cai na sílaba tônica; os limites do gesto coincidem com o começo
das frases) e em princípios de diálogo animado (frase, não palavra; uma ou duas poses por frase; cabeça como palco;
moving holds):

- `LivLivAvatar` (driver de ordem 10.6) escreve `speechYaw/Pitch/Roll` e `speaking`; os quatro `movimento_natural.js` somam
  à cabeça e, falando, reduzem a inclinação lenta do idle.
- Pose por frase: cada frase nova vira/inclina a cabeça (3–7 unidades), trocando de lado em ~72% das vezes; perguntas
  sobem o queixo e inclinam.
- Acentos: aceno curto ~100 ms antes da tônica real (marca ˈ dos fonemas do Kokoro, guardada em `visemeTrack`), em ~60% das
  tônicas, com pelo menos 0,55 s entre acenos. Medido: acenos 60–80 ms antes das tônicas, em 4 de 7.
- Riso: frase com "haha", "kkk", "rsrs", "lol" ou emoji de riso balança a cabeça (decai em ~1,6 s); na voz, "kkk"/"rs"/
  "lol"/emoji viram "Haha!" (`vocalize` em `useVoiceConversation`).
- Mãos: o diretor (`performance.ts`) só troca de gesto no começo de uma frase (até 2,5 s de espera) e às vezes desvia o
  olhar ao começar uma frase.
- Pensando: a fala-ponte ("Hmm…", "Let me think…") sai pela voz com o lip sync fechando a boca no "mm", e o olhar sobe.

## 4b2. Piscadinha como atuação (todos os tutores pintados)

Referências: princípios de animação de piscada (sobrancelha descendo, bochecha subindo e cabeça girando de leve dão vida à
piscada; assimetria no rosto) e FACS (piscadinha = AU46; bochecha que sobe = AU6; sobrancelha que desce = AU4).
Coreografia de ~1 s, com antecipação e sobreposição:

1. **Antecipação (0–0,06 s):** a bochecha do olho que pisca começa a subir, a cabeça começa a inclinar (para o lado do olho que pisca) e o
   gesto de mão entra (indicador de "segredo" ou mão levantada; `performance.ts`, `wait('wink')` e `MOOD_GESTURES.wink`).
2. **Fecha (0,06–0,13 s):** o olho fecha rápido (rápido de propósito: devagar aparece o meio do caminho do player, olho
   achatado + pálpebra semitransparente); a sobrancelha desse lado desce ~5 px; o outro olho aperta ~7%, como num sorriso.
3. **Segura (até 0,8 s):** olho fechado ~0,67 s com a cabeça viva (balanço leve), sorriso de canto (canto da boca desse lado
   sobe ~5 px, boca e pele com o mesmo campo), cabeça girando no próprio eixo: o alto vai para o lado do olho que pisca, o queixo para o outro, o rosto vira e abaixa
   um pouco (giro −9, inclinação −6, queixo −4; medido na Bia), e o tronco acompanha só um pouco.
4. **Abre (0,8–0,96 s):** o olho abre; cabeça, tronco e bochecha voltam depois (~0,3 s), e a mão volta ao neutro após ~2 s.

Implementação: tempo do olho nos quatro `reacoes.js`; cabeça, tronco, bochecha, sobrancelha e sorriso de canto em
`painted/index.ts` (`installFaceActing`, pela atuação `speechYaw/Pitch/Roll` e `pointerLean`, que os quatro
`movimento_natural.js` já somam).

## 4b3. Cabeça nunca parada (todos os tutores pintados)

Em `painted/index.ts` (`installFaceActing`): pequenas mudanças de postura coordenadas, nunca balanço de pêndulo. Cada uma
é uma pose leve: o rosto gira um pouco, inclina para o lado do giro, o queixo sobe ou desce e o tronco acompanha. A pose
chega por uma mola (ω 4,5, ζ 0,75), com um assentar sutil, e continua andando devagar durante a pausa (moving hold, até
+15%). Por baixo ficam a respiração (~14/min, no queixo) e uma deriva de atenção mínima em giro e inclinação.

Intervalos: parado, o comum é 3 a 5 s; 20% das vezes um descanso de 5 a 8 s, seguido de uma mudança 35% maior; 30% das
vezes um assentar curto 1,2 a 1,8 s depois (um pedacinho a mais na mesma direção), nunca dois seguidos. Falando, mudanças
menores a cada 2 a 3,5 s. Durante uma reação (piscadinha) a postura não muda. Medido em 40 s: intervalos 1,1 a 8 s, e a
imagem do rosto sempre muda de um segundo para o outro.

## 4c. Seguir o mouse (todos os tutores pintados)

Antes, o player quase não virava a cabeça para o cursor (angleX igual com o mouse nos dois cantos) e a íris andava ~2 px.
Agora `LivLivAvatar` (driver de ordem 9.5) faz o seguimento, com hierarquia de animação: olho primeiro (~0,07 s), cabeça
(~0,3 s), corpo por último (~0,6 s).

- Olhos: `eyeBallX/Y` até o limite com o mouse longe; alcance da íris 2,2x o do modelo (a máscara do olho continua recortando).
- Cabeça: vira até ~10 unidades (teto final ±11 somando tudo) e inclina ~3 para o lado do mouse; para baixo abaixa mais (13) que para cima (7); falando, 60%.
- Para baixo: a pálpebra fecha até 22% e as sobrancelhas descem ~4 px (campo na malha do rosto em `painted/index.ts`,
  `lookDown`), sumindo antes do olho.
- Corpo: vai para o lado **oposto** ao mouse (`pointerLean`, até ~34 px no topo da cabeça, base parada), em todos os
  `movimento_natural.js` (a Bia ganhou o balanço que não tinha).
- Mouse parado por 4,5 s: o olhar volta para a pessoa; "pensando" não segue o mouse.
- Tonto: mouse rodando rápido em volta da cabeça (~1,3 volta acumulada no mesmo sentido) dispara surpresa, cabeça e olhos
  girando ~1,8 s e a frase no balão ("Assim você me deixa tonta/tonto... rs"); espera 12 s para repetir; não interrompe fala.

Defeitos corrigidos no caminho:

| Defeito | Causa | Correção |
|---|---|---|
| Olho fechado "saindo do rosto" (sorriso, piscada) com o mouse de lado | O balanço do corpo só movia camadas visíveis naquele instante; a pálpebra fechada só aparece no desenho (dentro de `withClosedEyes`) e ficava para trás | O balanço move todas as camadas |
| "Testa cortada" (Bia tímida, mão no queixo, mouse embaixo à esquerda) | Giros somados (mouse ~14 + resposta do gesto + posturas) passavam de ~20; o rosto pintado é uma imagem só e a malha dobrava na linha do cabelo: a mecha que cruza a testa virava uma borda reta | Teto final de giro ±11 (e queixo −14/+10) nos quatro `movimento_natural.js`, depois de somar tudo; seguir o mouse gira até 10 |
| Rosto tímido da Bia ruim | A pintura da reação tímida da Bia não agradou | A Bia não usa a tímida: `exprSwap: { shy: 'smile' }` na ficha dela (`characters.ts`), aplicado em `hasExpr` do `LivLivAvatar`; as falas de vergonha saem com o sorriso. Luck, Yuno e Yuri mantêm a tímida |
| Olho "escorregando" ao piscar olhando para o lado | Com a íris no canto, o olho achatado mostrava a íris inteira deslocada dentro da fenda | Fechando a pálpebra, a íris volta ao centro (`withClosedEyes` nos quatro `reacoes.js`) |

## 5. Como validar (o que foi feito e como repetir)

Ferramentas: o próprio app em `/conversar` no navegador do painel, os ganchos de desenvolvimento e capturas do canvas.

- Ganchos DEV: `window.__lvp` (player), `window.__painted` (estado do movimento: `state`, `reacoes`, `boca`, `acoes`),
  `window.__gest.set('<gesto>')`, `globalThis.__visemeTrack()`.
- **Avançar quadros à mão** com `__lvp.draw(1/60)`: com o painel escondido o `requestAnimationFrame` para, e medições por tempo
  real ficam erradas.
- **Capturar** com `__lvp.canvas.toDataURL()` logo depois de um `draw` (o canvas não preserva o quadro) e montar grades
  com Python/PIL fora do repositório.
- Fixar o personagem: o app troca de tutor sozinho na espera; usar o botão "Próximo tutor" e conferir `puppet.model.name`.
- Usar uma **aba separada** em segundo plano para medir: cliques do usuário no painel interferem.

Bateria usada em cada personagem:

| Área | O que capturar | Critério |
|---|---|---|
| Olhos | 6 reações × (aberto, meia piscada, fechado) | Fechado na mesma linha em todas; sem traço, sem cílio fantasma, sem oval |
| Piscadinha | 6 quadros de 70 ms | Só o esquerdo fecha, reabre em ~0,4 s, rosto não muda de formato |
| Boca | neutro/triste/bravo/feliz/surpresa × aberturas 0; 0,08; 0,25; 0,55; 1 + vogais −1/+1 | Sem lábio duplicado ou malha dobrada |
| Queixo | maior peso do campo `wJaw` com boca 1 | Próximo do valor da entrega (Luck 7,07/7,08; Yuno 6,19/6,33; Yuri 5,78/6,16 px) |
| Gestos | 5 gestos na entrada (0,5 s) e na pose (2,9 s) | Um corpo só, braços inteiros, pulseira no punho certo, gola contínua |
| Ações | `act('nod'/'shake'/'tilt')`, `blink()` com idle desligado | ~23°–24° de cabeça; piscada fecha com idle off |
| Movimento | `lookAt(±0,9)`, inclinação por 20 s, `maxHair` | Corpo ±10–16 px, base 0 px, inclinação troca de lado, mechas 2–3 px |
| Transparência | captura sobre branco, cinza e azul-escuro | Sem halo |
| Palco | os 4 lado a lado, topo do cabelo × base do balão | Cabeças de tamanho parecido, adultos mais altos, folga de 33–39 px |
| Carregamento | `performance.getEntriesByType('resource')` | Nenhum 404; texturas da pasta nova |

**Lip sync:** medido nas frases de teste (início −30/+40 ms, fim até ~60 ms), mas **não houve verificação audiovisual** na
conversa real: o microfone é bloqueado no navegador do painel. Toda entrega nova precisa de um teste falando de verdade.

---

## 6. Próximos passos: personagens, roupas e reações

Planejamento de skins sazonais, roupas por cena, props e um seletor futuro está em
[criacao/SKINS-TEMAS-E-CENARIOS.md](criacao/SKINS-TEMAS-E-CENARIOS.md). O resumo e o que já aprendemos para cada eixo estão em
[FUTURO.md](FUTURO.md).
