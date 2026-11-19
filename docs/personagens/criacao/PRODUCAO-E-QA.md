# Produção e QA — personagens pintados

[Voltar à documentação principal](README.md). Esta é a sequência de produção consolidada. Os scripts existentes contêm coordenadas particulares dos personagens; não são geradores universais.

## 1. Definir o trabalho e preservar a baseline

Registrar nome, idade aparente, traços, cabelo, olhos, sinais distintivos, acessórios por lado da imagem, paleta, roupa, enquadramento e estilo. Separar criação de identidade, mudança de roupa e mudança de ambiente. Anotar o que pode mudar e o que deve permanecer idêntico.

Criar uma pasta de versão nova. Guardar o master de identidade, a fonte bruta, o resultado tratado, os prompts efetivos, o rig e as evidências. Nunca reconstruir a entrega sobre uma pasta aprovada sem preservar o estado anterior. Um prompt pedindo “manter tudo igual” não garante que a geração respeite geometria ou cor.

O método que tornou o Yuri original mais simples foi partir de um master coerente, conservar seu alinhamento e gerar gestos individuais, em vez de reconstruir rosto/cabelo/pescoço por aproximação. A evolução pintada mantém essa ideia e acrescenta malha local, bancos faciais e validação de transições.

## 2. Criar e inspecionar o master

Uma pessoa por imagem, frontal, cabeça ereta, ombros nivelados, olhos visíveis, boca fechada simples, braços relaxados e mãos completas. Canvas atual1024×1536, com margem para cabelo, cotovelos, palmas e indicador. Um sorriso muito assimétrico é possível, mas aumenta o cuidado com os landmarks da fala.

Para a direção pintada: volumes estilizados, pinceladas sutis que acompanham anatomia e tecido, sombras suaves coerentes e acabamento de pintura digital. Não transformar o adulto em adolescente ao simplificar o rosto, nem envelhecer o adolescente com poros, barba ou rugas fotográficas. Bia/Luck são adultos; Yuno/Yuri são adolescentes.

Ao reforçar a pintura, editar regiões aprovadas com máscaras suaves. Não aplicar ruído global e chamar isso de pincelada. No Yuri, o detalhe novo de pele foi limitado às regiões internas, preservando o contorno limpo do master.

Antes de derivar assets, abrir o PNG composto sobre branco, cinza, fundo claro e azul-escuro. Inspecionar as pontas do cabelo e os contornos de braços/mãos em aproximação. A extensão `.png` e o modo RGBA não provam que o fundo é transparente.

## 3. Transparência real antes de multiplicar variações

**Defeito observado:** algumas edições do gerador transformaram o RGB oculto de fundo em pixels de alpha parcial. O resultado parecia uma fumaça colorida em volta do avatar. Normalizar alpha de253 para255 não remove essa fumaça; usar um limiar alto indiscriminado corta fios e deixa bordas duras.

Para variantes faciais na mesma pose e no mesmo canvas, reutilizar a máscara limpa do master quando a silhueta realmente não mudou. Zerar também RGB onde alpha é0. Preservar os níveis suaves de alpha nos contornos; não erodir cabelo, cílios ou pulseiras. Conferir se o RGB novo continua alinhado com essa máscara: trocar o alpha de uma pose diferente corta o desenho.

Para gestos com braços em outra posição, usar uma máscara própria. A máscara do neutro não serve para braços levantados. No Yuri, fontes de trabalho com matte uniforme foram extraídas deterministicamente; a borda recebeu recuperação de cobertura/cor contra esse matte para evitar franjas claras. Esse recurso é específico de fundo uniforme conhecido, não um removedor universal. As imagens finais são apenas PNGs transparentes; as fontes intermediárias não entram no produto.

Guardar as fontes problemáticas no histórico, fora dos assets finais. Conferir novamente **o arquivo exportado e o render real**: renderizar com alpha ignorado ou combinar convenções incompatíveis de alpha premultiplicado pode reintroduzir halos.

## 4. Medir e registrar o rosto

Medir cabeça, eixo facial, olhos, sobrancelhas, nariz, boca, queixo, linha do pescoço, pontos de cabelo e furos de orelha quando existirem. Usar coordenadas nativas. Não transportar os números de outro personagem nem estimá-los pelo tamanho de uma prévia redimensionada.

Gerar uma base facial removendo olhos/sobrancelhas/boca, mantendo pele contínua e nariz. Usar só as regiões necessárias dessa base, preservando silhueta, cabelo e sombras do master. O registro pode usar a região estável do nariz para corrigir pequenas translações; rejeitar desvios grandes. Um alinhamento por nariz não corrige sozinho uma mudança de escala ou proporção do rosto.

## 5. Construir as reações e os olhos

Vocabulário atual: neutro, `smile`, `surprised`, `sad`, `angry`, `shy`, `x_wink`. Cada reação utiliza o mesmo contorno externo, com mudanças internas localizadas. Manter apenas uma sobrancelha por lado, sem restos do neutro por baixo e sem cabelo levado no recorte da sobrancelha.

Separar o desenho do olho, a máscara da esclera, a íris e a pálpebra. A máscara precisa corresponder ao formato daquela reação: reutilizar a abertura do neutro na surpresa deixa o branco sair do olho. Não pintar uma placa retangular branca nem aplicar uma faixa de sombra horizontal sobre os dois olhos. Remover a íris estática sem alterar indevidamente a pintura da esclera.

Fechar a pálpebra sem arrastar a sobrancelha. O feliz pode fechar os dois olhos. A regra mais recente de `x_wink` fecha o esquerdo da imagem e mantém o direito aberto, inclusive durante o idle/comando de piscada. Bia/Luck têm implementações anteriores; isso precisa ser migrado e testado se exigido para eles, não presumido pronto.

Uma piscada comum aciona um sorriso breve, preservando os visemas quando há fala. Tratar esse sorriso como uma fonte com geometria própria, especialmente quando a reação de repouso está triste ou brava.

## 6. Boca contínua e mandíbula

Gerar formas fechada, entreaberta, aberta, arredondada e larga na mesma escala e posição. O vocabulário é reduzido; não fornece, sozinho, um desenho distinto para todo fonema. Na conversa normal, priorizar aberturas moderadas, pouca dentição e pausas. Dentes cerrados persistentes ou abertura máxima a cada sílaba parecem artificiais.

Medir contornos externos e da cavidade **em cada fonte**, incluindo os repousos das reações e o sorriso da piscada. Deformar cada imagem para o contorno interpolado antes de misturar pesos. Um crossfade comum sobrepõe bocas em lugares diferentes e produz uma segunda linha de lábio.

Yuno/Yuri usam38 triângulos, cavidade em faixa e envelope externo consistente. Isso evita o leque central atravessando um sorriso curvo e côncavo. Bia/Luck usam uma versão anterior de40 triângulos. Não substituir a quantidade de triângulos isoladamente: pontos, ordem, fontes e topologia precisam mudar juntos.

Verificar áreas orientadas dos triângulos nas transições, não apenas nos extremos. Reações triste/brava necessitam seus próprios contornos de repouso. Valores típicos dos adaptadores mais recentes:65 ms para abrir,75 ms para fechar,85 ms para formato. Não empilhar outra suavização longa no controlador de voz sem compensação.

O queixo desce pela malha do rosto existente. O peso cresce abaixo da boca, concentra-se no queixo e cai a zero antes do pescoço. Não criar um queixo recortado à parte. Isolar o efeito num teste: nariz, testa, cabelo, pescoço e tronco devem ter deslocamento de mandíbula zero. Deslocamentos máximos não são um padrão universal: dependem da anatomia e da escala de cada pacote.

## 7. Gestos e proporções

Gerar uma pose individual nativa para cada intenção: ênfase com indicador, explicativo com uma mão elevada, abertura com duas palmas, reflexão com mão no queixo e conclusão com mão no peito. Neutro vem do master. Preservar tamanho do tronco, largura dos ombros, cintura, comprimentos dos braços, volume das mangas e acessórios no lado correto.

Comparar em escala idêntica. Não corrigir uma mão pequena aumentando braço, manga e torso juntos indiscriminadamente. A mão no peito precisa ter polegar e quatro dedos, não cinco dedos longos mais polegar. Inspecionar também mãos abertas, dedos parcialmente ocultos, polegares e ponta do indicador. Não cortar o indicador com uma faixa horizontal da montagem.

Reflexão exige oclusão especial: a mão deve estar em frente ao queixo sem carregar lábio estático ou pele do rosto. A máscara acompanha os dedos e as regiões internas. Na montagem do Yuri, corpo da reflexão e mão foreground recebem os mesmos pesos de acompanhamento; campos divergentes criavam linhas cortadas no punho/dedos.

## 8. Encaixe do pescoço e da gola

Esse foi o defeito mais recorrente. Um retângulo estreito recortado do neutro incluía partes de capuz/roupa; sobre os outros gestos, criava linhas claras, clavícula truncada e degraus marrons. Dilatar esse recorte espalhava cor da roupa na pele. Preencher só por trás não removia as pontas erradas que continuavam nos sprites da frente.

A solução final de Yuno/Yuri preserva o pescoço superior com a cabeça, usa uma referência contínua do busto por trás e **substitui** a região central da gola nos corpos compatíveis pela referência do neutro, incluindo alpha. O blend fica fora da abertura. Não é alpha-over da gola antiga sobre a nova. A mão foreground da reflexão continua separada.

As áreas exatas de substituição variam por personagem e por gesto. O campo de Yuno está em `construir_yuno_pintura.py`; o de Yuri em `construir_yuri_pintura.py`. Para outra roupa, definir uma NOVA gola neutra dessa roupa e aplicá-la às poses compatíveis. Não usar a gola do moletom num uniforme diferente. Mudança de postura do tronco, gola aberta ou braço que invade a região exige máscara específica, não um retângulo genérico.

A parte superior do pescoço acompanha a cabeça; clavícula, capuz e ombros permanecem ancorados ao corpo, com transição suave de pesos. Conferir cabeça inclinada, girada e durante o retorno, não só frontal parada.

## 9. Cores, pinceladas e movimento

Neutro é a referência cromática da roupa de cada skin. Calibrar em áreas de tecido equivalentes, respeitando pele, símbolos, costuras, estampas e sombras locais. Os scripts usam amostras e máscaras particulares, algumas baseadas em HSV/LAB; trocar a paleta pode invalidá-las. Não aplicar ao vermelho natalino o seletor que reconhecia moletom lilás ou azul.

A cabeça responde à troca real de gesto: entrada0,44 s, manutenção2,2 s, retorno0,60 s, depois centro estável. Retorno ao neutro0,55 s. Partir do estado atual quando chega outro gesto. O ganho positivo atual é1,25. Não pendular continuamente, alternar lados por relógio ou reiniciar a inclinação a cada sílaba.

Ações explícitas `nod`, `shake`, `tilt` e `blink` compõem com o controlador e funcionam com idle on/off nas versões que possuem `acoes.js`. Filtrar os ângulos de idle não deve apagar as ações. Movimento secundário usa pequenas molas amortecidas alimentadas pela aceleração real. Mechas têm raízes estáveis; tecido reage perto das dobras. Brincos da Bia giram em torno do furo, não do centro da argola. Não copiar esses campos para personagens sem brincos.

## 10. Integração e voz real

Carregar o modelo, inicializar queixo e movimento uma vez por instância e preservar os módulos importados. Movimento já inicializa boca e reações; Luck/Yuno/Yuri também inicializam ações. Usar a versão do pacote correto, sem hooks duplicados por render React ou concorrência de dois timers de olhos.

Um único corpo ativo por frame. Atualizar `player.expr` e `player.puppet.expr` de forma coerente; preservar/restaurar pesos corporais quando `setExpression` os zera. Evitar remontar o player e forçar piscada na troca. Manter referências de arquivos e campos do modelo completas.

Parametrizar URLs de assets para rotas reais e propagar a versão/hash aos bancos carregados diretamente. A documentação de integração tem pontos dependentes dos internals do LivLiv0.5.1; não assumir compatibilidade após atualizar o motor. Liberar listeners, RAF e texturas ao desmontar.

A fala real deve acompanhar o relógio de reprodução. Usar marcas de fonemas/visemas quando o TTS as fornece; amplitude sozinha não identifica vogais. Sincronizar início, pausa, retomada, cancelamento e silêncio, considerando o atraso do áudio e da suavização. A demonstração silenciosa não é lipsync de produção. Verificar a voz em português com p/b/m, f/v, vogais, pausas, fala rápida/baixa e interrupções.

## 11. Entrega e evidência

Executar o [checklist](CHECKLIST-DE-ENTREGA.md). Guardar arquivos efetivamente carregados, hashes, prompts, coordenadas, versão do player, testes executados, capturas e limitações. Distinguir geração concluída, rig local validado, integração no produto e aprovação visual; são estados diferentes.

A entrega mínima é um pacote coerente, não somente `model.json`. Informar o caminho do master e os PNGs finais. Preservar versões anteriores, documentando qual delas deve ser usada. Atualizar o inventário quando uma nova versão for realmente finalizada; nunca ocultar uma regressão apenas recalculando hashes.
