# Estudo de movimento dos tutores (Bia, Luck, Yuno, Yuri)

Como cada personagem mexe a cabeça, o olhar e o corpo conforme a emoção, o gesto e o momento da conversa, e por quê.
Vale para os quatro. Código: `src/lib/livliv/bodyLanguage.ts` (postura), `src/lib/livliv/performance.ts` (gestos e rosto
durante a fala) e `src/components/voice/LivLivAvatar.tsx` (mouse, base fixa, piscadinha, ações).

## Princípios

1. **A base não sai do lugar.** O ponto de apoio é a margem de baixo do personagem. Tudo o que inclina gira em volta dela:
   nos rigs com o corpo no grupo da cabeça (Bia, Yuno, Yuri), cada grau de inclinação é compensado com um deslocamento
   (`basePerDeg` em `characters.ts`, medido em cada rig: Bia 0,0012, Yuri 0,0007 e Yuno 0,0017; o ponto de giro muda de um rig para outro e precisa ser medido de novo se o rig mudar); no Luck o corpo tem grupo próprio e só a cabeça se mexe nas ações.
2. **O rosto lidera, a cabeça acompanha.** A emoção aparece no rosto e a postura vem logo atrás, lida do que está
   desenhado (pesos das expressões). Assim nenhum caminho do app esquece de mexer a cabeça.
3. **Mola, não linha reta.** A cabeça vai até a postura, passa um pouquinho e assenta (mola amortecida). Emoções rápidas
   têm mola dura (surpresa), as lentas têm mola mole (tristeza, timidez).
4. **Pouco e com motivo.** Movimento só quando há uma razão (emoção, gesto, pausa na fala, alguém falando). Nada de
   balançar em toda sílaba; inclinações de 2 a 6 graus.
5. **Não puxar sempre para o mesmo lado.** Inclinações de lado sorteiam o lado quando começam e alternam entre uma vez e
   outra.

## Postura por emoção

| Emoção | Cabeça | Olhar | Ritmo | Por quê |
|---|---|---|---|---|
| Alegria (smile) | queixo um pouco para cima, leve inclinação | levemente para cima | mais energia nas batidas | alegria abre e levanta a postura |
| Surpresa | recua para cima num tranco rápido, depois assenta | para cima | mola dura | reflexo de retração diante do inesperado |
| Tristeza | baixa a cabeça, inclina de lado | para baixo | lento, pouca energia | tristeza fecha e abaixa a postura |
| Raiva | queixo para baixo, firme, sem inclinar | à frente | firme | olhar "por baixo" é sinal clássico de confronto |
| Timidez | baixa e vira um pouco, inclina | desvia para baixo | lento | evitar o olhar e encolher |
| Dúvida (confused) | inclinação clara para um lado | um pouco para cima | médio | inclinar a cabeça é o sinal universal de "hein?" |
| Piscadinha | inclina para o lado do olho fechado e desce um pouco; o olho aberto fecha um pouco | | breve | cumplicidade |

## Postura por gesto

| Gesto | Cabeça |
|---|---|
| Mão no queixo (reflexão) | baixa um pouco e inclina para o lado da mão, olhar para cima |
| Ênfase | queixo levemente para baixo (firmeza) |
| Abertura | queixo para cima (acolher) |
| Explicativo | inclina para o lado da mão levantada |
| Conclusão | assenta, um pouco para baixo |

O gesto soma com a emoção pela metade: o rosto manda na emoção e o gesto na intenção da frase.

## Momento da conversa

- **Esperando (antes de começar):** saudação de uns 2 s, depois quase parado; convites a cada 10,5 s; só a mão no queixo
  quando o convite é de dúvida, tristeza, impaciência ou timidez.
- **Ouvindo:** cabeça levemente inclinada (interesse) e um aceno curto a cada 3,5 a 7 s, como quem diz "aham".
- **Pensando:** queixo um pouco para cima e de lado, devagar, olhar para cima.
- **Falando:** "batidas" da fala, um aceno pequeno quando a voz volta depois de uma pausa (começo de frase, palavra
  forte), no máximo uma a cada 0,7 s, com força conforme a energia da emoção; às vezes junto uma inclinação leve.
  Os gestos do corpo seguem a direção de gestos (pose mínima de 3 s, ver `performance.ts`).

## Mouse

- Os olhos sempre seguem o mouse.
- O corpo inclina para o lado do mouse (o jeito da Yuno), girando em volta da base.
- **Às vezes ao contrário:** a cada 8 a 16 s o modo pode trocar (35% de chance) para inclinar para o lado oposto, com a
  cabeça quase sem virar e só os olhos acompanhando. A passagem é suave.
- Com o mouse parado, cada troca de gesto ou expressão leva os olhos um pouco para o lado e de volta.

## Ações do toque

Acenar, negar, inclinar e timidez mexem só da cabeça para cima. Nos rigs com corpo no grupo da cabeça o `act` do player
foi trocado por um driver próprio (o nativo é aplicado depois dos drivers e balançava a base).

## Ordem dos drivers (por quadro)

`-100` gesto do corpo → `5` recentralizar, mouse, base fixa → `8` piscadinha → `9` ações → `10` lip sync →
`11` voz do navegador → `12` linguagem corporal (lê a boca já decidida para as batidas). Cada driver que inclina
compensa a própria inclinação na base.

## O que ajustar se ficar exagerado ou tímido

Os números estão nas tabelas `EXPR_POSE`, `GESTURE_POSE` e `STATE_POSE` de `bodyLanguage.ts` (graus) e na rigidez base
da mola (`38`). A inclinação do mouse está em `LivLivAvatar.tsx` (`0.7` por grau de giro da cabeça) e a chance do modo
ao contrário (`0.35`).

## Personagem em pé: base quase imóvel, passagens suaves

- **Sem flutuar:** a Yuno tinha `drift` [0,035, 0,025] e tronco com `yaw` 0,35 e `roll` 0,15 no rig, o que fazia o desenho
  todo escorregar junto com a cabeça. Passou para `drift` [0,0], `body.yaw` 0 e `body.roll` 0, os mesmos valores aprovados
  no Yuri justamente para ele não flutuar. Os outros três já estavam assim.
- **Medido (16 idas e voltas do mouse de uma ponta à outra):** base andou 3 px na Yuno, 4 px na Bia, 1 px no Luck e
  1 a 2 px no Yuri (com um desvio de 6 px num momento), enquanto a cabeça andou de 16 a 36 px.
- **Luck:** a inclinação pelo mouse vem do tronco (`bodyZ`), que gira em volta da cintura no rig dele (base parada).
- **Troca de gesto:** a troca do desenho do corpo é instantânea (exigência do rig, sem dois corpos sobrepostos). Para não
  parecer corte, ela acontece dentro de um movimento: no mesmo instante a cabeça dá um pequeno assentar (mola), que
  disfarça a troca.
- **Tudo em mola ou com rampa:** posturas (mola amortecida), modo do mouse (rampa de ~1,2 s), piscadinha e ações (curva
  seno), olhar de lado (o player suaviza). Nada muda de valor de um quadro para o outro.
- **Amplitudes menores:** inclinação pelo mouse 0,5 por grau de giro, dúvida 5 graus, timidez 4, inclinar do toque 4,5.
  Ângulo menor também deixa a base mais parada.

## Atualização: corpo como o do Luck (sem pêndulo) e sempre ao contrário do mouse

- **Sem pêndulo:** girar o desenho inteiro e compensar a base ainda parecia um pêndulo com eixo no meio. Bia, Yuno e Yuri
  agora carregam `model.app.json`, cópia do rig aprovado com só uma diferença: `body` e `gesto_*` no grupo `body`
  (o `model.json` aprovado ficou intacto). Assim o tronco se deforma suave para o lado com a base fixa, exatamente como o
  Luck, e a cabeça se mexe sobre ele. Pescoço conferido sem emenda na inclinação máxima e com a cabeça virada.
- **Sempre ao contrário do mouse:** o corpo inclina para o lado oposto ao mouse, a cabeça quase não vira e só os olhos
  seguem. Amplitude suave (0,2 do giro da cabeça no tronco).
- **Medido com o mouse de verdade:** Yuri, cabeça 57 px e base 4 px; Yuno, cabeça 61 px e base 4 px (um salto de 7 px foi
  troca de pose dos braços). A compensação por grau (`basePerDeg`, `bodyInHead`) não é mais usada.
