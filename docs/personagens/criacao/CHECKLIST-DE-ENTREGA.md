# Checklist de entrega

[Voltar à documentação principal](README.md). Preencher para cada personagem, skin e cena. Uma mudança localizada pede revisão focada e teste das dependências afetadas; uma roupa/identidade nova exige revisão completa.

## Identidade e arte

- [ ] Master correto, idade aparente preservada, rosto/cabelo/olhos/sinais coerentes entre poses.
- [ ] Aparência pintada consistente no rosto, pescoço, braços, mãos, cabelo e tecido.
- [ ] Mesmo corpo e escala nos gestos; mangas e braços não encurtaram.
- [ ] Polegar e quatro dedos por mão; proporção, contornos, punho e ponta do indicador corretos.
- [ ] Acessórios no lado da imagem definido; sem duplicação ou troca entre gestos.
- [ ] Paleta calibrada pelo neutro da roupa atual, preservando sombras e estampas.

## Transparência e arquivos

- [ ] PNGs finais RGBA nativos, um retrato por arquivo; sem branco ou fumaça externa embutidos.
- [ ] Conferir alpha real e RGB sob alpha0, bordas de cabelo, cílios, dedos e acessórios.
- [ ] Compor sobre branco, cinza, claro e escuro; examinar a exportação final, não só a fonte.
- [ ] Variantes faciais têm registro compatível com a máscara compartilhada.
- [ ] Gestos têm silhuetas próprias; não recortar braços pela máscara neutra.
- [ ] Arquivos de trabalho/gerações descartadas fora do conjunto final consumido pelo produto.

## Rosto, olhos e fala

- [ ] Sete estados faciais revisados em repouso, fala, piscada e giro.
- [ ] Esclera não vaza; íris recortada corretamente em todas as reações e posições do olhar.
- [ ] Nenhuma faixa atravessa o olho; pálpebra não arrasta sobrancelha; apenas uma sobrancelha por lado.
- [ ] Regra de piscadinha do pacote documentada; nas versões recentes, outro olho permanece aberto.
- [ ] Sorriso breve da piscada preserva a abertura durante fala.
- [ ] Bocas fechada, pequena, média, aberta, máxima, arredondada e larga revisadas.
- [ ] Frames intermediários de abrir/fechar/mudar vogal e de sorrir na piscada inspecionados.
- [ ] Repousos triste/bravo e sorriso possuem landmarks corretos; nenhuma linha de lábio dupla.
- [ ] Triângulos sem inversão nas transições cobertas; teste numérico acompanhado de inspeção visual.
- [ ] Queixo desce levemente conforme abertura; nariz/testa/cabelo/pescoço/torso estáveis no teste isolado.

## Corpo e continuidade

- [ ] Seis poses, cada uma em repouso/fala/giro; nenhuma pose desaparece ou força piscada ao trocar.
- [ ] Todas as42 combinações de reação+gesto exercitadas na versão completa.
- [ ] Só um corpo ativo; sem crossfade de corpos, roupa neutra sobreposta ou flash entre poses.
- [ ] Gola/clavícula contínuas em ambos os lados, sem borda dupla ou retângulo de pele visível.
- [ ] Revisar as12 composições contextuais, especialmente entradas/retornos da cabeça.
- [ ] Reflexão encosta no queixo, mão foreground sem lábio estático e sem divergência dos pesos do braço.
- [ ] Giros/inclinações dos dois lados não abrem lacunas entre cabeça, cabelo e pescoço.
- [ ] Enquadramento final não corta cabelo, cotovelo, palma ou indicador no desktop/celular.

## Movimento e runtime

- [ ] Cabeça: entrada, pausa, retorno e centro mantido até novo gesto; sem pêndulo por fala/timer.
- [ ] Interromper a transição com novo gesto continua a partir da pose atual, sem salto.
- [ ] Concordar, negar, inclinar e piscar funcionam com idle ligado e desligado, quando disponíveis no pacote.
- [ ] Mechas/tecido/argolas têm causa, pivô correto, pequena amplitude e assentamento em repouso.
- [ ] Módulos inicializados uma vez por instância; descarte de listeners, RAF e recursos gráficos.
- [ ] Caminhos funcionam em rotas aninhadas; todos os PNGs/bancos/máscaras carregam.
- [ ] Cache por versão/hash impede misturar assets antigos e novos.
- [ ] Player/versionamento documentados; outros personagens continuam funcionando.

## Roupa nova, cenário e props

- [ ] Nova gola neutra validada e aplicada às poses compatíveis, sem reutilizar a gola antiga.
- [ ] Chapéu/headset/cachecol/tiara têm pivôs, oclusões e influência sobre cabelo/orelhas documentados.
- [ ] Props separados quando necessário, com contato de mão e ordem de camadas correta.
- [ ] Avatar transparente; cenário separado, escala/perspectiva/luz compatíveis.
- [ ] Nova pose necessária para objeto foi criada e validada, sem fingir que um gesto antigo serve para tudo.
- [ ] Estado do seletor de skin/cena descrito como implementado ou futuro, sem API imaginária.

## Voz real e fechamento

- [ ] Se houver áudio no escopo: início/pausa/retomada/cancelamento e silêncio sincronizados com a reprodução.
- [ ] Testes com p/b/m, f/v, vogais, fala rápida/baixa, pausas e interrupções vistos e ouvidos.
- [ ] Limitação do vocabulário de visemas/amplitude reconhecida; demonstração silenciosa não tratada como TTS real.
- [ ] Master, prompts efetivos, assets finais, fontes e histórico identificados.
- [ ] Manifesto/hashes, medidas, evidências, testes realmente executados e limitações registrados.
- [ ] Prévia abre por HTTP e os links de entrega apontam para arquivos existentes.
- [ ] Nova versão registrada sem sobrescrever a baseline anterior.

No relatório final, separar: **arte produzida**, **rig local validado**, **integração no produto**, **voz real validada** e **aprovação visual**. Marcar um estado não implica os outros.
