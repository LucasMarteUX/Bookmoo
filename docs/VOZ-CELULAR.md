# Voz e personagens no celular

Investigação de 17/11/2026: no navegador do celular a voz não saía e às vezes a página caía. Causas e correções.

## Causas encontradas

1. **Voz Kokoro baixando sozinha no celular.** `useAutoInstallVoices` (no Layout) baixava a Kokoro em todo aparelho. No
   celular o motor (ONNX/WASM) ocupa centenas de MB de memória; somado ao personagem animado, o navegador matava a página
   (iPhone recarrega a aba, Android mostra "Ops"). Pior: a voz era marcada como instalada antes de conseguir gerar a
   primeira frase, então dali em diante toda fala ia para ela e, se ela falhasse, o app ficava mudo (sem plano B).
2. **Personagem pesado.** Cada personagem animado carrega cerca de 130 MB de texturas na placa de vídeo. Até o botão
   redondo da tutora (52 px) carregava o personagem inteiro.
3. **Microfone aberto enquanto o tutor fala.** Com o microfone capturando, o iPhone silencia ou abafa a voz do aparelho, e
   o som do alto-falante disparava a interrupção ("falar por cima").
4. **Seletor de voz fora da tela.** O menu de vozes abria para a direita com 288 px de largura; no celular ficava fora.

## O que foi feito

- **Kokoro desligada no celular** (`isKokoroSupported()` é falso no celular; `activeKokoroVoice()` volta null). Não baixa,
  não carrega o motor, não usa voz "instalada" antiga.
- **Voz do próprio aparelho** (`src/lib/deviceVoice.ts`): feminina e masculina em inglês escolhidas pelos nomes de cada
  sistema (iOS, Android, Windows, macOS), sem as vozes de brincadeira; tom mais fino para Yuno e Yuri; se o aparelho tem uma
  voz só, o masculino sai mais grave. Destaque palavra a palavra e boca do personagem pelos eventos da fala. Proteções:
  libera a voz no primeiro toque (iPhone), guarda a fala atual (Chrome perdia o fim), não cancela e fala no mesmo instante
  (Android engolia), retoma ao voltar do segundo plano, não fica preso se a fala nunca começar.
- **Nunca mudo:** qualquer falha da Kokoro ou do servidor de voz cai na voz do aparelho (`tts.ts`).
- **Personagem em WebP sem perda (todos os aparelhos):** `public/characters/bookmoo/<pasta>/web/` com as mesmas texturas em
  resolução total, WebP lossless (`-exact`), idênticas byte a byte às PNG e cerca de 30% menores para baixar. Gerado por
  `scripts/characters/webp-pack.sh` (rodar de novo quando um rig mudar). A memória de vídeo não muda (a imagem é
  descompactada na placa do mesmo jeito); o que derrubava o celular era a Kokoro, que ficou desligada lá. Avatares pequenos e
  mudos no celular viram a foto (`avatar.webp`, 256 px: nítida até num botão de 52 px em tela 3x).
- **Conversa no celular:** o microfone fecha enquanto o tutor fala e reabre para ouvir; sem interrupção por cima.
- **Seletor de voz no celular:** escolha direta Feminina / Masculina (com o nome da voz do aparelho), dentro da tela, sem
  menu suspenso; tocar toca uma amostra. Também em Ajustes > Voz de leitura. No computador o menu continua, e em janela
  estreita abre para baixo, dentro da tela.

## Limites

- A qualidade da voz depende do aparelho (vozes "aprimoradas" do iPhone soam melhor; podem ser baixadas nos Ajustes do
  sistema: Acessibilidade > Conteúdo Falado > Vozes).
- Testado em modo celular no navegador do computador (Android emulado). Ainda falta confirmar num iPhone e num Android reais.
