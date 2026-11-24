# Direção de movimento do site público Upoonly

Estudo de 23 de novembro de 2026. Referências: [home da Contra Labs](https://contralabs.com/) e [Jobs](https://contralabs.com/jobs). Material: navegação no site ao vivo, estilos computados, capturas fornecidas e exportações HTML já inventariadas. A tabela de medições descreve o desktop observado. As marcações percentuais para Upoonly são decisões propostas para o protótipo.

## A cena que explica a referência

Na home, depois das ofertas, o texto fica no centro enquanto pinturas de escalas muito diferentes ocupam as bordas. Há três mensagens no mesmo espaço. O palco visível usa sticky com top 0. No instante medido tinha 737 px de altura e pertencia a um contêiner de 2.524 px. A diferença de 1.787 px cria percurso para a mudança interna antes de o próximo capítulo empurrar a cena. Esses números dependem do viewport e do layout.

| Movimento observado | Segundo texto | Terceiro texto |
|---|---|---|
| Scroll Y = 2.885 px | Opacidade 1, escala 1 | Opacidade 0, escala 0,8 |
| Avanço até 3.606 px | Opacidade 0, escala 0,8 | Opacidade 1, escala 1 |
| Retorno a 2.885 px | Opacidade 1, escala 1 | Opacidade 0, escala 0,8 |

Os textos ficam posicionados no palco. A matriz também continha translação para o alinhamento central. Medimos os estados e sua reversibilidade; a curva entre eles e o deslocamento de cada pintura não foram amostrados quadro a quadro. No Upoonly atual, revelar uma seção na entrada e animar o recorte do jardim cobre apenas parte dessa experiência: ainda falta fazer o texto anterior sair, dar tempo para ler o próximo e recompor o conjunto ao voltar.

## Decupagem editorial da home

| Trecho em ordem de leitura | Construção da referência | Consequência para o Upoonly |
|---|---|---|
| Abertura e hero | Fundo, imagem, conteúdo e chamadas têm camadas distintas na exportação. A headline concentra a primeira leitura. | Capas e marca como abertura breve. A primeira frase ocupa seu próprio plano e continua legível com a arte parada. |
| Apresentação e ofertas | Um título introduz quatro ofertas. Cada unidade combina categoria pequena, título fragmentado, pintura, explicação e ação. Há conteúdo de hover na estrutura. | Montar uma sequência de demonstrações. Exibir a ação também em foco e toque. |
| Galeria de pinturas e três frases | Centro estável, tamanhos e cortes muito diferentes na periferia. Texto ativo substituído durante o percurso fixo medido acima. | Uma cena contínua para ler, ouvir e entender a mesma passagem. Preservar o eixo da palavra enquanto os fragmentos mudam. |
| Título e quadro | Nas capturas, quatro linhas serifadas grandes ocupam uma coluna; uma pintura quase quadrada ancora a outra. | Mostrar o trecho de Potter à esquerda e o jardim inteiro à direita. Reservar uma janela estável para tocar a palavra ou iniciar o acompanhamento visual. |
| Rede e indicadores | Parágrafo, links por especialidade e três números com legendas trazem informação concreta após a sequência pictórica. | Apresentar como o vocabulário salvo volta para a revisão. Usar dados verdadeiros ou uma demonstração identificada. |
| Mosaico tipográfico | Quatro linhas têm contêineres próprios, com recortes entre as palavras. A chamada ocupa uma célula do último conjunto. | Compor os verbos com o material a que se referem: trecho, narração e tutor. Definir posições editoriais por breakpoint. |
| Convite, pesquisa e comparação | Depois do mosaico aparecem chamadas editoriais, uma seção de pesquisa e uma comparação visual de duas alternativas. | Passar da composição livre a uma escolha real: comparar dois estilos de ilustração para uma página, abrir a biblioteca ou começar a ler. |
| Navegação e rodapé | A fita vertical funciona como ponto de orientação recorrente nas capturas. Links, ações e créditos fecham a página. | Usar o marcador do livro como referência estável e manter os destinos reconhecíveis durante a troca de cenas. |

## Jobs: grade, tipografia e interação

Na página ao vivo, a chamada inicial leva diretamente ao índice de vagas por âncora. Em largura de 1.280 px o título declara Source Serif 4, peso 400, tamanho fluido entre 96 e 224 px, entrelinha 0,94 e espaçamento de letras −0,035 em. A grade usa quatro colunas, intervalo de 18 px e margens internas laterais de 60 px. O cartão tem proporção 4:5, raio de 18 px e título de 48 px. Duas superfícies medidas foram #efe9dc e #ddd9c2. As pinturas preenchem as caixas com recorte cover.

A primeira linha contém cartão, **célula vazia com proporção própria**, cartão e pintura. O vazio mantém o ritmo vertical da grade e altera a silhueta da linha. Nas capturas seguintes o vazio muda de coluna. A seta fica no canto inferior direito em um controle de 40 px. O estilo declara 280 ms para expansão do rótulo e transformação da seta, com curva cubic-bezier(0.32,0.72,0,1), e 220 ms para opacidade. Esses tempos são da interação local; não representam o tempo de rolagem da grade. Os registros não estabelecem que os cartões troquem fisicamente de lugar ao rolar.

Depois do índice vêm apresentação da rede, depoimentos repetidos na estrutura, explicação do processo e dos benefícios, perguntas expansíveis, indicadores e rodapé. Para o Upoonly, reservar o ritmo irregular para descoberta de recursos; preços, FAQ e comparação exigem alinhamento estável. As capturas de retratos dispersos e mosaico de palavras correspondem à home, enquanto a grade de funções corresponde a Jobs.

## Partitura proposta para produção

Cada cena de rolagem terá um contêiner de percurso, um palco e camadas independentes. Calcular o progresso local por distância percorrida entre o topo do contêiner e a liberação do palco. Em React, usar useScroll no contêiner e useTransform para ligar esse progresso a escala, posição e opacidade. Aplicar as transformações aos filhos do sticky; deixar seu ancestral livre de recorte ou transformação que interfira na fixação. As faixas abaixo são parâmetros iniciais do Upoonly.

| Cena | Entrada e permanência | Saída e ligação |
|---|---|---|
| Capas e logo | Sequência temporal breve, pulável. Pré-carregar só a primeira arte. | Depois das capas, o coelho acompanha a borboleta. Duas metades se afastam verticalmente e revelam o título. Visitas por âncora entram direto no destino. |
| Jardim, três estados | Palco de uma tela, percurso total inicial de três telas. 0–25%: frase e recortes afastados. 25–40%: primeira frase recua para 0,8 e some; a próxima entra. 40–65%: leitura estável. 65–80%: segunda troca. | 80–100%: terceira frase permanece; o recorte do jardim ganha a proporção da obra seguinte. Ao voltar, cada camada recupera sua posição pela mesma função de progresso. |
| Página com narração | Obra e trecho ocupam lados distintos. Manter a linha de leitura silenciosa e o glossário estáveis durante a interação. | Na borda final, a moldura da obra vira a moldura da comparação de estilos. O visitante pausa ou repete a simulação. |
| Ilustração e conversa | Conservar o trecho como referência enquanto se alternam duas versões da cena. O tutor entra com uma pergunta ligada ao trecho. | A palavra da pergunta reaparece na revisão. Liberar o palco antes de chegar aos controles seguintes. |
| Índice e biblioteca | Alternar cartões, recortes e células vazias no desktop. Entrada por fileira com deslocamento vertical curto; título e seta mantêm posição dentro da célula. | Cartão focado revela a ação; seleção navega. A biblioteca termina em escolha de livro. |
| Páginas internas | Abrir cada rota pelo título e pela demonstração que a identifica. Alternar cena ampla e detalhe interativo conforme o recurso. | Retomar o índice por navegação comum. FAQ, cadastro e comparação de planos mantêm leitura contínua. |

### Mobile e aceite

- No celular, compor o jardim com menos fragmentos e apenas uma frase ativa. Reduzir o percurso inicial para duas telas e testar em aparelho. Na grade, remover as células vazias quando houver apenas uma coluna.
- Respeitar movimento reduzido com mensagens em ordem de leitura, pintura estática e todos os destinos acessíveis. Nenhum áudio inicia pela rolagem. Um CTA invisível não pode receber foco.
- Gravar desktop e celular nos marcos de 0%, 25%, 50%, 75% e 100%. Comparar ida e volta nos mesmos marcos, navegação rápida e parada no meio do percurso. O texto deve ter intervalo de leitura plena e a rolagem deve continuar nativa.
- Validar também voltar do navegador, acessar por âncora, ampliar texto e tocar no glossário com a barra do navegador móvel aparecendo. Usar os arquivos existentes e mídia sem créditos, conforme decisão do projeto.


## Cenas implementadas na home

| Cena | O que acompanha a rolagem | O que o visitante controla |
|---|---|---|
| Abertura e jardim | A pintura da leitora no tablet se aproxima enquanto o título sobe. O jardim fixa a composição, substitui as três frases e abre o recorte até preencher a tela. | Pular a abertura ou começar a ler. |
| Peter Rabbit e mosaico | A moldura se abre, o texto e a pintura passam em velocidades distintas. Os três verbos deslizam em sentidos alternados. | Tocar em *Rabbits*, pausar a linha visual ou repetir as nove palavras. |
| Seis capítulos ilustrados | As bordas revelam e recolhem a pintura. Texto, imagem e demonstração percorrem distâncias diferentes. | A tradução de *voyage* abre junto do texto. Os links levam às respectivas ferramentas. |
| Notebook e temas | Foto e telas se aproximam juntas. Nas duas margens, a palavra salva e a resposta da tutora deslocam-se em sentidos contrários. Depois, a página ilustrada fica à vista enquanto o scroll percorre Dia, Tarde e Noite. | Selecionar manualmente um dos três temas fixa a escolha durante a visita. |
| Ateliê e carrossel | Uma abertura enquadra a enseada de *Treasure Island*. As duas fileiras do carrossel têm deslocamentos opostos sobre o movimento contínuo. | Comparar aquarela, mangá e noir. A pintura anterior continua visível enquanto a próxima carrega. |
| Conversa, fala e prática | Entre dois detalhes da pintura, a pergunta se revela palavra a palavra. O palco dos tutores avança com a rolagem. No exercício, o filete editorial se desenha e a frase se move antes das opções. | Escolher um tutor ou responder à questão de vocabulário e experimentar outra resposta. |
| Biblioteca e convite | As capas sobem e descem em ritmos alternados e se alinham no meio da seção. A pintura final continua em movimento atrás das chamadas. | Abrir a biblioteca, escolher o livro grátis ou comparar os planos. |

A passagem ilustrada dos temas usa um trecho do capítulo 43, quando Elizabeth vê Pemberley. [Pride and Prejudice, Project Gutenberg](https://www.gutenberg.org/cache/epub/1342/pg1342.html)
