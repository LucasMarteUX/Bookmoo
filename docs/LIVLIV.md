# Personagens 2.5D do Bookmoo (LivLiv Player)

A tutora usa um personagem 2.5D próprio do Bookmoo, animado pelo [LivLiv Player](https://github.com/livliv-dev/player) (`@livliv-dev/player` 0.5.1, Apache-2.0). Os desenhos são nossos; não há personagem de terceiros no app.

## O que está integrado
- **Bia (mulher):** `public/characters/bookmoo/mulher/` (`model.json` + `textures/`, formato LivLiv v4, sem marca d'água). Aprovada pelo usuário em 16/11/2026, sem aceno. As texturas são cópias byte a byte do pacote aprovado (SHA-256 conferido contra `manifesto_aprovado.json`); o `model.json` é o aprovado mais as bocas das expressões (seção abaixo). O `avatar.webp` foi recortado do `00_master.png` aprovado.
- **Fonte dos desenhos:** `/Users/lucasmarte/Desktop/Personagens/mulher/` (originais, folhas, alinhamento e prévias). Não regenerar nem redimensionar peças: se algo ficar diferente no app, investigar carregamento, versão do player, máscaras, cache e opções antes de mexer em PNG.
- **Luck (homem):** `public/characters/bookmoo/homem/` (rig aprovado em 16/11/2026, sem aceno). 42 arquivos conferidos por SHA-256 contra o `manifesto_aprovado.json` do homem; as 38 texturas que o `model.json` referencia existem. Traz as camadas `expr_mouth_*` e as texturas `talk` do próprio rig; o visema `wide` usa `mouth_f5.png` (aberto, nunca o `mouth_f4`, rejeitado). `rig.roll = 0.28` e `rig.body.roll = 0.15` preservados. O mesmo patch de piscada da Bia vale para ele (idêntico; não foi aplicado de novo).
- **Yuno (jovem):** `public/characters/bookmoo/yuno/` (rig aprovado em 16/11/2026, sem aceno; 36 arquivos conferidos por SHA-256 contra o `manifesto.json` da pasta `Personagens/yuno`; só as 35 texturas do manifesto foram copiadas). Inclinação inicial `angleZ = -4` (`baseAngleZ` em `characters.ts`, aplicada depois de cada carregamento; o recentralizador gira em torno dela). Voz feminina mais fina (`pitch 1.14`). Sugerida nos assuntos infantis (categoria `kids` troca para ela ao escolher a cena). Tem **gestos de corpo** (abaixo).
- **Yuri (jovem):** `public/characters/bookmoo/yuri/` (42 arquivos conferidos por SHA-256 contra o `manifesto.json`). Preservados `rig.drift=[0,0]`, `rig.roll=0.1`, `rig.body.roll=0`, `rig.body.yaw=0`, `jaw=0` e inclinação inicial 0 (sem os -4 da Yuno). Voz masculina jovem (pitch 1.1). Mesmos gestos da Yuno.
- **Menina e menino próprios:** (Yuno e Yuri já são a menina e o menino.) Para acrescentar: copiar o rig para `public/characters/bookmoo/<pasta>` e incluir uma linha em `CHARACTERS` (`src/lib/livliv/characters.ts`) com nome e voz.
- **Troca de tutor:** no palco, ao trocar a personagem aparece uma "ligação" de pelo menos 3 s (foto, ondas e "Chamando <nome>…") antes de ela surgir (`CALL_MS` em `LivLivAvatar`).
- **Cenas:** a lista mostra só o tema e o nível; a pessoa escolhe com quem falar (Bia, Luck ou Yuno) e a personagem assume o papel da cena com o próprio nome (cliente e servidor).
- **Escolha do tutor:** botão redondo com o rosto no cabeçalho da conversa (`TutorPicker`) e as setas do palco, na conversa livre. A escolha vale também para o tutor de leitura. Também nas cenas (botão do cabeçalho).
- **Nome no servidor:** o front manda `tutorName` em cada turno e o prompt da Edge Function `conversation` usa esse nome (Bia por padrão). **A função ainda não foi publicada**; até lá a IA fala com o nome antigo nas respostas (a abertura e os balões já usam o nome certo).

## Bocas das expressões (acréscimo ao pacote aprovado)
O rig aprovado trazia só olhos e sobrancelhas nas expressões: a boca era sempre o sorriso fechado (surpresa sorrindo, tímida igual à neutra). Foram acrescentadas 4 camadas `expr_mouth_<expressão>` ao `model.json`, no estilo do próprio LivLiv (camada `expr` com textura de repouso e variante `talk`):
- **Repouso:** a textura é um retalho de pele do rosto base (cobre o sorriso) com a boca da expressão por cima: surpresa = O, triste = triste, brava = decidida (apertada), tímida = entreaberta pequena. Feliz e piscadinha mantêm o sorriso.
- **Falando:** a variante `talk` é transparente, então a boca da fala (visemas) aparece por cima, com os olhos da expressão mantidos.
- As bocas vêm da folha aprovada `12_bocas.png` (células 4, 7, 8 e 2), na posição exata do master. O método é conferido contra uma boca já existente no rig (diferença média de alfa 0,17 de 255).
- **Regerar:** `node scripts/characters/expression-mouths.mjs` (lê `12_bocas.png` e `alinhamento.json` da pasta dos desenhos, escreve em `public/characters/bookmoo/mulher/textures/final_exprmouth_*.png` e atualiza `model.json`; pode rodar de novo sem duplicar). Trocar uma boca é só mudar a célula em `MOUTHS` no script, ou gerar uma boca nova e apontar para ela.
- **Arquivos aprovados:** nenhuma textura aprovada foi alterada. Só o `model.json` deixou de ser byte a byte o aprovado (ganhou essas 4 camadas); os hashes das texturas continuam batendo.

## Corpo atualizado (pescoço)
Em 17/11/2026 o `textures/body.png` foi substituído pela versão com o pescoço corrigido (`Personagens/mulher/rig/textures/body.png`, SHA-256 `f312ab2d...`). Nada mais mudou: rosto, olhos, cabelo, coordenadas, escala e animações são os mesmos. A URL do modelo leva `?v=<ASSET_REV>` (`src/lib/livliv/characters.ts`), que o player repassa a todos os arquivos: **ao trocar qualquer textura, altere `ASSET_REV`** para o navegador não reaproveitar a imagem antiga do cache. O hash de `body.png` no `manifesto_aprovado.json` deixou de valer; o manifesto novo é o desta pasta.

## Gestos do corpo (Yuno)
- Camadas `gesto_enfase|explicativo|abertura|reflexao|conclusao` (e a mão da reflexão à frente). Rosto e corpo são independentes: a expressão vem do humor, o gesto da intenção da frase.
- **Adaptador versionado:** `src/lib/livliv/bodyGestures.ts`. O player 0.5.1 não tem API pública para isso: os pesos ficam em `player.expr` (alvo) e `player.shownExpr` (desenhado). A troca é atômica (zera o anterior e liga o novo nos dois mapas no mesmo quadro) e um driver reaplica o gesto a cada quadro, porque `setExpression()` troca o mapa inteiro e apagaria o gesto. Se o player mudar, só esse arquivo muda.
- **Direção de atuação:** `src/lib/livliv/performance.ts` (`GestureDirector`). Estudo de naturalidade no cabeçalho do arquivo. Resumo: pose mínima de 3 s SEMPRE (inclusive ao fim da fala e ao ouvir), ênfase 3 a 4,5 s, explicar/acolher 3,6 a 6 s, pensar 4,5 a 7,5 s; entre poses troca direto (~40%) ou descansa 1,2 a 3 s; nunca a mesma pose duas vezes; ~70% das frases gesticulam e depois de 2 gestos descansa; o rosto lidera o corpo em 250 ms e tem 2,5 s entre reações; frase com pista forte (elogio, surpresa, pena) antecipa a troca só depois dos 3 s. Chegada: gesto de acolhida (abertura) com sorriso breve. Qualquer personagem com `gestures: true` em `characters.ts` usa isso.
- **Política antiga** (`gestureForSpeech`, agora em performance.ts): primeiro gesto da fala = abertura ou explicativo; depois conforme o humor ou o texto (elogio/ênfase, pergunta = explicativo ou reflexão, pena = conclusão...); sem pista, alterna explicativo e ênfase. Cada gesto fica 2 a 5 s e volta ao neutro numa pausa de ~1 a 2 s. Pensando = reflexão; ouvindo = neutro. Nesses personagens a expressão do humor é breve (2,6 s; 3,6 s para triste e brava) e volta ao neutro.

## Seguir o cursor
O olhar acompanha o cursor pela página toda, mas a cabeça e o tronco acompanham pouco (ganhos em `GAIN`/`STATIC_GAIN` e `bodyMotion = 0.5` em `LivLivAvatar`): antes ela parecia flutuar atrás do mouse.

## Reações e frases
- `src/lib/tutorReactions.ts` guarda as frases com a reação que combina (convites antes de começar, toque, susto sem microfone) e `moodFromText()`, que lê a frase que ela está dizendo e devolve um humor só quando há sinal claro (elogio, surpresa, pena, riso, timidez, segredo, dúvida); nas demais a expressão fica neutra.
- **Antes de começar:** a cada 9 s um convite novo (inglês e português misturados) com a reação da frase; o rosto volta ao neutro sozinho.
- **Toque:** cada toque sorteia uma reação com a frase correspondente, também durante a conversa ao vivo; 5 toques em 2,5 s a deixam brava, de brincadeira.
- **Sem microfone:** ela se assusta (expressão de surpresa) e avisa no balão; o aviso de baixo continua.
- **Enquadramento sem pulo:** na tela de conversa o personagem só aparece depois de enquadrado (encostado embaixo). A primeira vez mede o topo do cabelo e guarda o resultado por personagem e formato de tela em `localStorage` (`bookmoo:stage-framing:v1`); nas próximas vezes abre direto no lugar certo. Se mudar o desenho ou o enquadramento, apague essa chave.
- **Recentralização:** um driver (`order: 5` em `LivLivAvatar`) aplica um passa-altas ao giro e à inclinação da cabeça e do tronco (`angleX`, `angleZ`, `bodyX`, `bodyZ`, constante de 3 s) e amortece a inclinação (roll). Inclinação ou giro que duram mais que uns segundos (mouse parado de um lado, olhar de lado, inclinação de atenção do player) somem e ela volta ao centro; os movimentos rápidos passam. Medido com a aba visível: sem mouse, a média de `angleZ` caiu de +2,7° (e `bodyZ` de −1,3°) para cerca de 0; com o mouse parado na direita, vira até ~8° e volta a ~0,5° em 9 s. O olhar de pensar também tem menos desvio lateral.
- **Movimento:** sem pulinhos. Os olhares de lado automáticos do player ficam com 35% da amplitude, o primeiro só depois de 18 s, e o sorriso espontâneo do player é desligado (`idler.lv`, campos internos do 0.5.1).

## Como funciona
- `CharacterAvatar` mostra a Bia ou o Luck em 2.5D (`LivLivAvatar`) ou, se ela não puder aparecer (sem WebGL2, arquivos que não carregaram, contexto perdido), o desenho vetorial de sempre (`TutorAvatar`), sem interromper a conversa.
- **Voz sem duplicar:** o app continua com um único player de áudio (`src/lib/tts.ts`). Enquanto a tutora está na tela, ela empresta o próprio `<audio>` (`borrowPlaybackElement`); a mesma voz Kokoro toca por ele, e esse elemento vai para o `startLipSync()` do LivLiv com `{ motion: 0, bounce: false }` (só a boca segue a voz). A ligação acontece no primeiro toque ou tecla, porque o navegador só libera o Web Audio num gesto; até lá a voz toca normal.
- **Voz do navegador (português):** não passa por `<audio>`; a boca segue o relógio da fala (`src/lib/speechClock.ts`).
- **Visemas do rig:** `closed`, `half`, `open`, `round`, `wide`. A folha tem oito bocas, mas só esses cinco viram visemas no runtime.
- **Reações:** o humor da IA vira expressão do modelo (`smile`, `surprised`, `sad`, `angry`, `shy`, `x_wink`) com movimento. As sobrancelhas só são ajustadas por código quando nenhuma expressão está na tela (as expressões já trazem as suas).

## Correção de piscada no player (obrigatória)
O player oficial desenha as expressões como patches estáticos. As camadas do rig marcadas com `x-blink-with-eyes: true` precisam acompanhar a abertura dos olhos: `exprAlpha` multiplica a opacidade por `smooth(0.05, 0.35, min(eyeLOpen, eyeROpen))`, revelando a pálpebra fechada normal durante a piscada.

- **Durável:** `patches/@livliv-dev+player+0.5.1.patch`, aplicado a cada instalação pelo `postinstall` (`patch-package`). A versão do player está fixada em `0.5.1` (o patch edita `dist/index.js`, minificado). Provado: o patch aplica limpo num pacote 0.5.1 recém-baixado e gera o mesmo arquivo.
- **Atualizando o player:** refazer a alteração no código equivalente (fonte de referência: `rig/player-piscada.patch` da pasta de assets) e gerar de novo com `npx patch-package @livliv-dev/player`.
- A extensão é opt-in por camada: qualquer outro modelo sem a marca não muda.

## Valores do rig que não devem ser sobrescritos
`rig.jaw = 0` (sem queda procedural da mandíbula, que deformava o pescoço), `rig.body.yaw = 0.35`, `rig.body.roll = 0.3`, `rig.body.breath = 0.6`, `rig.breath = 0.35`, `rig.pitch = 0.3`, `tuning.nod = 1.15`, íris com `range [12, 8]` e máscaras do branco. O canvas nunca é esticado por CSS; o player redimensiona e respeita a proporção do modelo. Acompanhamento do cursor da página (`followPointer: 'page'`) e movimentos automáticos ligados.

## Licença
- **Código do player:** Apache-2.0 (uso comercial livre, mantendo o `LICENSE`/`NOTICE` do pacote).
- **Personagens:** originais do Bookmoo (`meta.license`: LicenseRef-Bookmoo, sem concessão a terceiros).
- Os personagens de exemplo do LivLiv foram **removidos** do app. A licença deles proíbe uso comercial por empresa sem autorização, e proíbe usá-los para gerar outros personagens.

## Limites conhecidos
- Sincronia da boca com a voz real e as vozes por personagem não foram ouvidas no ambiente de teste (o navegador de teste não libera áudio). Conferir num aparelho real.
- O LivLiv diz que ainda não testou celulares nem WebViews. No celular o player usa no máximo 1.5 pixel por ponto e para de desenhar fora da tela.
- Enquanto a Edge Function `conversation` não for publicada, a IA do servidor pode se apresentar com o nome antigo (Bea) dentro da conversa.

## Memória dos tutores (por pessoa e por tutor)
- Tabela `tutor_memory` (migração `20261121000000_tutor_memory.sql`, **ainda não aplicada**): resumo, acertos, pontos a melhorar, assuntos, nº de conversas e data, uma linha por pessoa e tutor (Bia, Luck, Yuno, Yuri). RLS: a pessoa só lê a própria; só a Edge Function escreve.
- Edge Function `conversation` (**ainda não publicada**): o cliente manda `characterId` ao iniciar e em cada turno; o servidor guarda no contexto da sessão. A cada turno o prompt ganha a memória DESTE tutor e um resumo curto do que a pessoa conversou com os outros. Ao encerrar (qualquer tipo de conversa, com 2+ falas da pessoa), uma chamada de IA mescla as notas antigas com a conversa e atualiza a memória (falha silenciosa: nunca quebra o fim da sessão).
- Boas-vindas de volta: conversa livre sem assunto escolhido abre com "Welcome back! ... Last time we talked about X" (ou, se só falou com outro tutor, "I hear you have been practising with Bia").
- Chamar outro tutor: quando faz sentido, o tutor sugere ("você falou disso com a Bia, quer que eu a chame?") e devolve `suggestTutor`; a tela mostra o botão "Chamar a Bia". Ao aceitar, a conversa atual termina (e é memorizada), o tutor troca com a "ligação" de 3 s. Só na conversa livre.
- Ordem de publicação: migração primeiro, função depois (sem a tabela a função funciona, só sem memória).

## Atualização: gestos em todos os tutores, base fixa, enquadramento, voz e olhar

- **Gestos:** Bia, Luck, Yuno e Yuri têm as camadas `gesto_*` (`gestures: true` em `characters.ts`). Pacotes da Bia e do Luck copiados de `Personagens/bia/rig` e `Personagens/homem/rig` (hashes conferidos com `manifesto.json` e `manifesto_gestos.json`); ASSET_REV `20261120-luck-gestos`.
- **Base fixa (`bodyInHead`):** Bia, Yuno e Yuri têm o corpo no grupo da cabeça (desenho aprovado, não mexer nos grupos). O `bodyZ` vira `angleZ` e o desenho é deslocado de volta (`move.x`, 0,0013 da largura por grau, medido), então o giro é em volta da cintura e a base não sai do lugar. O Luck tem grupo `body` próprio e usa o movimento normal do player.
- **Enquadramento:** `zoomK` (0,9 para Bia e Luck) mostra um pouco mais do corpo. Cache de enquadramento v2.
- **Piscadinha:** com `x_wink`, a cabeça inclina para o lado do olho ABERTO (direita da tela) e desce um pouco, e o olho aberto fecha um pouco (`eyeLOpen/eyeROpen` x 0,6). Se o olho aberto não reagir num rig, é porque a textura da expressão cobre os olhos.
- **Ações (`act`) com base fixa:** em `bodyInHead` o `act` do player é trocado por um driver próprio (nod/shake/tilt/shy só na cabeça, com a base compensada), porque o `act` nativo é aplicado depois dos drivers e balançava a base. Medido: base parada em todas as ações e no toque.
- **Saudação de chegada:** gesto de acolhida de uns 2 s, depois neutro.
- Método de criação de personagens novos: [METODO-PERSONAGENS.md](METODO-PERSONAGENS.md).
- **Olhar:** a cada troca de gesto ou expressão, com o mouse parado, os olhos desviam um pouco e voltam.
- **Espera:** convites a cada 10,5 s; mão no queixo só em confusa, triste, brava e tímida (`GestureDirector.wait`).
- **Voz:** tom alterado gera o áudio em ritmo natural e toca mais rápido; todo áudio do Kokoro ganha 120 ms de silêncio no início (worker). Yuri: tom 1,2, vozes preferidas Puck, Fable, Michael.
- Estudo de movimento (postura por emoção, gesto e momento; inclinação ao contrário do mouse; base fixa com `basePerDeg` medido por personagem): [MOVIMENTO-PERSONAGENS.md](MOVIMENTO-PERSONAGENS.md).
