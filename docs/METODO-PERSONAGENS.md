# Método Bookmoo para criar personagens (o que funcionou no Yuri)

Registro de 16/11/2026. O usuário aprovou o master e, após corrigir quatro sobrancelhas e a flutuação lateral, aprovou também a montagem final do Yuri. Este documento registra o método para novos personagens e futuras personalizações. Não é uma promessa de geração idêntica em uma única tentativa.

Como o personagem é integrado e tocado no app (player, gestos, voz, memória): ver [LIVLIV.md](LIVLIV.md).

## Resultado de referência

Raiz: `/Users/lucasmarte/Desktop/Personagens/`.

- Personagem final: `yuri/rig/model.json` e todas as suas referências `texture`, `frames`, `mask` e `talk`.
- Master aprovado: `yuri/00_master.png`; geração original preservada em `00_master_original.png`.
- Teste funcional: `yuri/testar.html`, servido por HTTP na raiz Personagens.
- PNGs individuais dos gestos: `yuri/gestos/individuais/`.
- Coordenadas das folhas: `yuri/alinhamento.json`.
- Evidências: `yuri/validacao.json`, `yuri_trabalho/teste_player.json`, `teste_combinacoes.json` e `yuri/previas/`.
- Hashes da entrega: `yuri/manifesto.json`.
- Integração: `PROMPT-PARA-CLAUDE-INTEGRAR-YURI.md`.

O rig atual é a fonte executável. Alguns arquivos de edição e prévias são anteriores à última revisão das sobrancelhas. Não assumir que nomes esperados significam arquivos corretos.

## Por que foi mais simples

O Yuri partiu das decisões já testadas na Yuno. Em vez de repetir a separação completa do cabelo e reconstruir o pescoço por aproximação, preservamos o alinhamento do master desde o início. Geramos cada gesto individualmente em resolução nativa e validamos expressões junto com movimentos e gestos.

As decisões que mais reduziram retrabalho:

1. Aprovar um master antes de criar variações. Corpo frontal, cabeça ereta, ombros nivelados, olhos visíveis e mãos dentro do canvas.
2. Um único master como fonte de identidade, proporções, cores e coordenadas.
3. Uma pose corporal por PNG de 1024×1536. Não ampliar personagens pequenos de uma folha com seis poses.
4. Gerar uma base sem olhos, boca e sobrancelhas, preservando o resto. Usar essa geração apenas nas regiões necessárias; manter os contornos e a sombra do pescoço do master.
5. Expressões completas sobre a mesma base, evitando retângulos de pele desalinhados que invadem cabelo/orelhas.
6. Transformação compartilhada nas camadas que precisam encaixar. A versão final usa grupo `head`; não redistribuir grupos por "organização" sem testar a deformação.
7. Roupa fora da camada da cabeça: se uma manga neutra estiver lá, aparecerá sobre o braço de outro gesto.
8. Troca corporal atômica, sem crossfade entre corpos completos.

## Identidade e direção de arte

Yuri é adolescente, sem barba, olhos castanhos, cabelo castanho curto e bagunçado, pequena pinta na bochecha, roupa azul-petróleo com pêssego, camiseta creme e pulseira. A direção é anime limpo, contornos contínuos e cel shading com formas coerentes; sem sombras difusas de persiana, glow, ruído ou manchas nos reflexos.

Referências visuais orientam a criação, não substituem o master aprovado. Para um novo personagem, documentar idade aparente, rosto, penteado, acessórios e paleta. Não reutilizar coordenadas de olhos ou cabeça de outro personagem.

## Sequência de produção

### 1. Master

Gerar uma personagem por imagem, PNG transparente, canvas 1024×1536. Deixar margem para cabelo/mãos e manter pose frontal. Aprovar aparência antes de derivar peças. Preservar original bruto e cópia tratada separadamente.

Prompt-base:

> Crie [nome/idade aparente/identidade], personagem original, pose frontal ereta e relaxada, ombros nivelados, olhar para o observador, sorriso fechado, braços em repouso, mãos completas dentro do quadro. Roupa [paleta e detalhes]. Uma única personagem em PNG transparente 1024×1536. Arte anime premium com contornos limpos e cel shading coerente, sem faixas diagonais de iluminação, ruído ou glow. Sem texto ou cenário.

### 2. Base facial e registro

Gerar uma edição do master removendo somente olhos, sobrancelhas e boca. Manter cabelo, orelhas, nariz, pinta, contorno, pescoço, sombra e roupa nas mesmas coordenadas. Comparar visualmente e por pixels/landmarks; a instrução de preservar não garante registro perfeito.

Combinar pixels originais e base limpa por máscaras locais controladas. Não usar inpainting automático amplo perto de cílios/cabelo: isso espalhou pixels escuros na pele em tentativas anteriores. Nunca aproximar a cor da pele por uma cor única se houver gradiente/sardas ou sombra local.

A composição final do Yuri mantém cabeça/cabelo/pescoço numa base coerente (`head_base.png`), roupa separada e franja de oclusão (`fringe_occlusion.png`). Não há física independente de mechas nesta versão. Preservar essa escolha até existir substituto validado.

### 3. Olhos e sobrancelhas

Extrair cada olho na posição real, sem espelhar nem nivelar assimetrias do desenho. Separar branco/cílios, máscara do branco, íris e pálpebra fechada. A íris é recortada pela máscara e tem alcance moderado. Preservar o formato do branco ao remover a íris antiga; não pintar uma área maior de branco.

Os detalhes recortados recebem 8px de padding transparente e x/y compensados. Isso evita repetição da borda por amostragem da textura. Não redimensionar esses recortes para canvas completo sem compensar pivôs e comportamento das máscaras.

Não incluir cabelo nos recortes de sobrancelhas: ao rotacionar a peça, um fio vira uma "segunda sobrancelha". O ajuste final do Yuri foi localizado em tímido, bravo, triste e piscadinha, incluindo suas versões `talk`. Preservar neutro e demais expressões aprovadas. Ver `auditoria/corrigir_sobrancelhas_yuri.py` como registro dessa revisão.

### 4. Bocas e expressões

Oito bocas de edição: fechada, entreaberta, A, O/U, E/I, riso, triste, decidida. Cinco visemas do runtime: closed, half, open, round, wide. A boca E/I precisa ter abertura visível; dentes encostados não devem representar um som aberto.

Conservar linha contínua da boca, escala e posição do lábio superior. Se o personagem tiver sorriso inclinado, manter uma inclinação compatível durante a fala; não impor simetria por padrão.

Seis expressões: smile, surprised, sad, angry, shy, x_wink. Compor cada uma no canvas completo sobre a mesma base, com olhos/sobrancelhas/boca próprios. Textura `talk` mantém essa emoção sem a boca estática, permitindo os visemas sem duplicação.

Pálpebras fechadas têm largura do olho, não da caixa inteira de recorte. Piscadinha fecha um olho e reduz um pouco a abertura do outro. Smile pode ter os dois olhos fechados. Preservar o patch opt-in `x-blink-with-eyes` para as expressões que devem revelar a piscada comum.

### 5. Gestos individuais

Gerar separadamente ênfase, explicativo, abertura, reflexão e conclusão. Neutro vem do master. Não incluir contagem. Uma pose por PNG 1024×1536, sem ampliar recorte de atlas.

Prompt-base:

> Edite somente os braços de [master aprovado] para [gesto]. Preserve exatamente cabeça, rosto, cabelo, pescoço, sombra, ombros, tamanho e posição do tronco, cintura e roupa. Mãos com cinco dedos e polegares anatomicamente corretos; manter acessórios no lado original. Não diminuir o tronco para caber mãos: ajustar flexão dos cotovelos. Uma pose por PNG transparente 1024×1536, mesma nitidez e paleta do master.

A geração pode mudar roupa/torso apesar do prompt. Conferir costuras, zíper, símbolo e âncoras antes de integrar. Não ativar no teste uma peça apenas porque foi gerada.

A reflexão exige mão à frente do queixo e continuidade até o braço. A máscara deve incluir contornos e áreas internas dos dedos; limiar de cor puro pode deixar buracos transparentes. Não cortar uma faixa horizontal inteira para preservar pescoço: essa faixa cortou um dedo levantado na Yuno.

### 6. Movimento e controlador

A versão final do Yuri usa jaw=0, drift=[0,0], roll=0.1, body.roll=0 e body.yaw=0, com inclinação inicial 0. Esses valores foram ajustados para ele não parecer flutuar lateralmente; não copiar indiscriminadamente para outro personagem.

Gestos usam pesos `gesto_enfase`, `gesto_explicativo`, `gesto_abertura`, `gesto_reflexao`, `gesto_conclusao`; neutro significa todos em zero. Um gesto ativo por vez, troca no mesmo quadro, sem reload do Player/canvas e sem modificar olhos ou expressão facial. Não fazer crossfade de corpos completos: cria duas mangas e mãos translúcidas.

O adaptador de testar.html acessa `expr` e `puppet.expr`, propriedades internas do player 0.5.1. Encapsular/versionar ou expor API própria na integração. Não tratar isso como API pública estável. Carregar model.json sozinho não implementa a escolha automática dos gestos.

Rosto e corpo independentes permitem feliz com ênfase, explicativo ou abertura; reflexão com neutro/tímido; conclusão com acolhimento. Priorizar intenção e ritmo da frase em vez de mapear rigidamente uma emoção a um único gesto.

## Transparência, exportação e validação

As gerações vieram com pixels semitransparentes difusos ao redor do desenho. O tratamento preservou o núcleo opaco, limitou o antialiasing à borda e estendeu RGB coerente sob o alfa antes de zerar o fundo. Os limiares usados nos scripts são específicos deste material; revisar em cada geração para não apagar fios, cílios, pulseiras ou traços finos.

Folhas de edição em 1536×1024 a 2×: olhos 4×2, sobrancelhas 4×2, bocas 4×2, expressões 2×3; margens de pelo menos 40px no Yuri. Registrar rect_folha e origem_master, validar limites e redução. Exportação por código depois de validar a arte é aceitável; não gerar vários corpos pequenos numa folha para aumentar depois.

Validação mínima antes de entrega:

- RGBA real, dimensões de cada textura/frame/máscara correspondentes ao modelo, arquivos referenciados existentes, schema LivLiv v4.
- Fundo claro e escuro, zoom de olho/sobrancelha, orelhas, bochechas, queixo, sombra e contorno do pescoço, gola, polegares, punhos e dedos.
- Neutro, olhos fechados/meio abertos, cinco visemas e seis expressões.
- Todos os gestos, giro para ambos os lados, cabeça para cima/baixo, inclinação, troca durante fala e piscada.
- Combinar expressões + gestos + movimento: uma montagem neutra correta não valida as outras.
- Nenhum quadro vazio/flash, nenhuma alteração da cabeça ao mudar apenas corpo, nenhuma roupa neutra sobre mãos novas.
- Renderização headless e inspeção visual, depois navegador interativo para o usuário.

No Yuri foram verificados schema, 36 texturas, folhas/células e 23 estados básicos, além de 12 combinações. O usuário aprovou o teste visual final. Sincronia com áudio TTS real e integração no app ainda precisam de validação no sistema.

## Personalizações futuras: roupa, função e ambiente

Objetivo futuro: manter os mesmos personagens reconhecíveis em contextos como restaurante, aeroporto, cafeteria e balada, com roupas e situações apropriadas. Estes cenários ainda NÃO foram produzidos nem são requisitos para alterar a entrega atual.

Separar três eixos no planejamento:

| Eixo | Preservar | Pode variar |
|---|---|---|
| Identidade | rosto, idade aparente, cabelo, olhos, pinta/sardas, proporções e traços distintivos | expressão e direção do olhar |
| Roupa/função | encaixe no pescoço/ombros, escala e qualidade | uniforme, avental, jaqueta, acessórios funcionais e paleta contextual |
| Ambiente/situação | transparência do personagem e legibilidade | cenário, objetos, enquadramento e intenção da conversa |

Criar variantes em pastas novas, sem sobrescrever o personagem aprovado. Exemplo de convenção proposta:

```text
variantes/yuri/cafeteria/v001/
  referencia_identidade.png
  master_variante.png
  rig/model.json
  rig/textures/
  gestos/individuais/
  previas/
  validacao.json
  PROMPTS.md
  ENTREGA.md
```

Essa estrutura é uma proposta futura, não descreve arquivos já existentes.

Fluxo recomendado por variante:

1. Usar o master aprovado de identidade e uma referência clara da roupa/contexto.
2. Trocar somente roupa e acessórios. Comparar rosto/cabelo com o original para detectar deriva. Quando possível, reaproveitar pixels/texturas aprovados de cabeça, olhos, bocas e expressões.
3. Alterações de gola, chapéu ou acessório perto do cabelo/pescoço exigem nova máscara de oclusão; não simplesmente cobrir a emenda.
4. Criar gestos específicos da roupa, um por PNG. Manga curta, avental ou uniforme não encaixa automaticamente nos gestos da roupa anterior.
5. Adicionar objetos como camadas próprias: bandeja, copo, cardápio, mala, bilhete, headset. Testar pegada e oclusão da mão. Não desenhar objeto dentro de todas as expressões do rosto.
6. Manter cenário separado do avatar transparente. Integrar em camada de fundo/ambiente e verificar contraste em claro/escuro. Evitar iluminação pintada no avatar que o prenda a um cenário.
7. Se a nova situação exigir personagem sentado, perfil ou corpo inteiro, gerar um master e rig dessa pose; não deformar o frontal existente para simular uma geometria incompatível.
8. Validar todas as combinações relevantes e registrar o que mudou, o que foi reaproveitado e as limitações.

Exemplos de direção, não entregas prontas:

- Restaurante: camisa/avental, cardápio ou bandeja, gesto de apresentar opções e confirmar pedido.
- Cafeteria: avental em tons suaves, copo/xícara, atendimento e explicação do menu.
- Aeroporto: roupa de viagem ou uniforme conforme o papel definido, mala/bilhete e gestos de orientação.
- Balada: roupa casual de noite adequada à idade e ambiente com luzes separado do avatar; preservar idade aparente, sem transformar adolescente em adulto. Definir se ele é visitante ou outro papel antes de criar uniforme.

Não inferir um novo personagem quando o pedido for personalização. Não produzir todas as variantes antecipadamente: criar e validar a que o usuário solicitar.

## Scripts e reprodutibilidade

- `auditoria/construir_yuri.py`: primeira construção das peças, rig e folhas.
- `auditoria/testar_yuri.mjs`: renderização de estados/gestos/combinações.
- `auditoria/finalizar_yuri.py`: exportações e validações iniciais; parte da documentação gerada nele precede revisões finais.
- `auditoria/corrigir_sobrancelhas_yuri.py`: revisão localizada das sobrancelhas e ganho de movimento; houve limpeza adicional posterior na região abaixo da sobrancelha direita.

**Esses scripts registram o processo, não formam hoje um comando único idempotente que reproduz a entrega final.** Algumas revisões foram aplicadas depois deles. Não reexecutá-los sobre a pasta aprovada sem checkout/cópia isolada e comparação com os hashes. Para integrar, copiar o rig pronto. Para novos personagens, reaproveitar o método, parametrizar coordenadas e validar de novo.
