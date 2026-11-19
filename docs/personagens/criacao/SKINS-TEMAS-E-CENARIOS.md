# Skins, temas sazonais, roupas e cenários

[Voltar à documentação principal](README.md). Este é o plano de produção das variantes futuras. As combinações abaixo são propostas; não representam arquivos já produzidos ou um seletor implementado.

## Quatro decisões separadas

| Eixo | Exemplos | Regra |
|---|---|---|
| Identidade | Bia, Luck, Yuno, Yuri, personagem novo | Preservar rosto, idade aparente, sinais e proporções |
| Skin/roupa | Original, Natal, Páscoa, uniforme, roupa casual diferente | Criar uma referência neutra da nova roupa e seus gestos coerentes |
| Cena | Cafeteria, aeroporto, restaurante, balada | Manter cenário e props independentes do PNG transparente do personagem |
| Intenção | Acolher, explicar, surpreender, refletir, discordar, concluir | Combinar gesto/reação/fala conforme contexto, não por tema fixo |

Natal não é uma identidade nova. Cafeteria não obriga uma expressão fixa. A mesma roupa pode aparecer em várias cenas se iluminação, escala, perspectiva e objetos forem compatíveis.

## Níveis de mudança e o que precisa ser refeito

| Alteração | O que pode ser reutilizado após conferir | O que precisa ser produzido ou revalidado |
|---|---|---|
| Apenas cenário atrás | Pacote completo do avatar | Escala/enquadramento, contraste, iluminação aparente, interação e margens |
| Recolorir tecido | Rosto, coordenadas e eventualmente malha | Máscaras por material; todos os gestos, estampas e acessórios; alpha e paleta |
| Nova roupa com mesma anatomia/postura | Identidade facial e, se intactos, olhos/bocas/landmarks | Master neutro vestido, cinco gestos, gola, mangas, mãos, pesos da roupa e cores |
| Gorro, tiara, headset ou óculos | Regiões faciais não ocultas | Oclusão de cabelo/orelhas/sobrancelhas, pivôs, profundidade e movimentos |
| Avental, cachecol, casaco ou objeto na mão | Identidade não afetada | Silhueta, tecidos, contatos da mão, ordem de camadas e gestos envolvidos |
| Postura, ângulo de câmera, close radical ou tamanho do corpo diferentes | Referência de identidade e estilo | Registro/âncoras e possivelmente todo o rig, não apenas texturas |
| Novo rosto ou mudança de idade | Linguagem visual geral | Master novo, medidas, olhos, bocas, mandíbula, expressões e rig completos |

Mesmo numa troca de roupa, não copiar automaticamente um retângulo de gola ou os pesos de uma manga anterior. Se a geometria muda, a região precisa de novo registro. As regras de identidade orientam a edição; não são garantia de reaproveitamento técnico.

## Estrutura de versões proposta

Criar pacotes completos isolados primeiro. Um sistema de montagem dinâmica de peças pode vir depois, com contratos próprios e testes de compatibilidade. A infraestrutura atual não resolve automaticamente qualquer roupa em qualquer corpo.

```text
variantes/
  yuri/
    natal/
      v001/
        BRIEF.md
        identidade_referencia.png
        master_skin.png
        originais/
        prompts/
        historico/
        rig/model.json
        rig/textures/
        queixo_local.js
        movimento_natural.js
        boca_natural.js
        resposta_cabeca.js
        reacoes.js
        acoes.js
        testar.html
        pngs/
        estudos/
        validacao_*.json
        manifesto.json
        ENTREGA.md
        PROMPT-INTEGRACAO.md
cenarios/
  cafeteria/v001/
    fundo.png
    props/
    CENA.md
```

É uma convenção futura, não a descrição de pastas já presentes. Não exigir `acoes.js` de um pacote anterior que não o possui sem portar e testar a funcionalidade. Os módulos levados à skin precisam ser os módulos efetivamente usados.

Nomear arquivos e IDs com identificadores estáveis, por exemplo `yuri/natal/v001` e `cafeteria/v001`; o nome de exibição pode mudar. Registrar o pacote de origem e seu hash. Evitar `final2`, `novo_final` e seleção automática pelo arquivo modificado mais recentemente.

## Fluxo de uma skin

1. Escolher personagem, pacote base, tema/roupa, cena e intenção de uso. Escrever um brief com invariantes e acessórios por lado da imagem.
2. Criar novo master neutro mudando apenas roupa/acessórios definidos. Usar a identidade atual como referência primária. Conferir rosto/cabelo com o master original, incluindo escala e aparência de idade.
3. Validar transparência real antes de gerar outras poses. Não perpetuar um halo por toda a coleção.
4. Definir a nova gola neutra, mangas, punhos, estampas e acessórios. Aprovar visualmente esse conjunto na escala normal e em aproximação.
5. Gerar um PNG nativo por gesto. Preservar comprimento dos braços e volume das mangas; contar dedos. A mão no peito e a reflexão merecem revisão individual.
6. Reaproveitar a face somente se identidade, geometria e iluminação forem compatíveis. Se a cabeça não mudou, é preferível preservar pixels e medidas aprovados. Não regenerar uma face em cada gesto e aceitar pequenas diferenças como se fossem uma só identidade.
7. Construir as máscaras e oclusões da nova roupa, revalidar a gola nas poses e ajustar os campos de tecido. Uniformizar a cor pelo neutro dessa skin, não pelo neutro de outra roupa.
8. Integrar props e acessórios com pivôs reais e contatos claros. Conferir com a fala, as expressões e o movimento ativos ao mesmo tempo.
9. Colocar o avatar transparente na cena separada. Verificar enquadramento e perspectiva. Completar QA e documentar o que foi aprovado e o que depende da integração.
10. Publicar a variante no registro somente depois de identificar os arquivos finais e guardar evidência. A geração de uma imagem bonita não conclui o pacote animado.

## Natal

Possibilidades: roupa festiva, gorro, cachecol, casaco ou pequeno broche. Definir quais acessórios originais permanecem e quais serão substituídos. Um gorro precisa de pivô no crânio e máscara de oclusão dos fios; não desenhá-lo no fundo do cenário. O pompom pode ter pequena inércia própria, sem deslocar o chapéu pela cabeça.

Cachecol invade a região do pescoço: registrar a nova continuidade entre cabeça, gola e tecido. Nunca colocar o cachecol sobre um pescoço já cortado e chamar isso de reparo. Punhos felpudos alteram a silhueta e o contato com as mãos. Estampas devem acompanhar o tecido sem mudar de posição ou quantidade entre gestos.

Manter rosto e idade do personagem. A mudança para vermelho/verde não deve recolorir pele, olhos, sardas, símbolos preservados ou cabelo. A aparência de neve não pode ser confundida com halo de alpha.

## Páscoa

Possibilidades: roupa de cores suaves, pequeno broche, cesta ou tiara temática. Uma tiara com orelhas é acessório ancorado, com oclusão dos fios; não muda a anatomia real das orelhas ou do rosto. Cesta e ovos são props com mão/pegada e ordem de camadas próprios.

Não encolher tronco ou mãos para caber a cesta no mesmo canvas. Ajustar pose ou enquadramento deliberadamente e registrar a mudança. Props opacos, transparentes e brilhantes precisam ser revisados separadamente do alpha do personagem.

## Situações em lugares diferentes

| Cena | Roupa/props possíveis | Intenção e gesto possível | Pontos de atenção |
|---|---|---|---|
| Restaurante | Uniforme, avental, cardápio, bandeja | Acolher com abertura; explicar opções com uma mão | Bandeja/mãos, avental sobre torso, gola e punhos consistentes |
| Cafeteria | Avental, camiseta, copo, xícara | Explicar preparo; agradecer com mão no peito | Alça/pegada, copo na frente do tecido, vapor em camada separada |
| Aeroporto | Roupa casual ou uniforme definido, crachá, bilhete, mala, headset | Orientar com explicativo; enfatizar um detalhe | Credenciais legíveis se houver, headset/orelhas, mão no bilhete e escala da mala |
| Balada | Roupa casual/noturna e acessórios definidos | Conversa animada, piscadinha, acolhimento | Luzes da cena sem queimar rosto, evitar flashes/oscilações contínuas no avatar |
| Casa/estudo | Roupa confortável, livro, mesa ou fone | Refletir, concordar, explicar | Oclusão atrás da mesa, dedos no livro, cabelo e gola em close |

Props associados ao gesto podem exigir poses novas, como segurar copo, mostrar um bilhete ou levar uma bandeja. Não presumir que as seis poses atuais já cobrem essas ações. Definir, nomear e testar a nova pose, preservando as existentes.

## Cena, luz e composição

O avatar continua PNG transparente. O fundo pode ser pintura digital, com props em camadas atrás ou à frente, conforme a cena. Não assar o restaurante ou a cafeteria dentro de todas as texturas de expressão.

Planejar planos de profundidade e pontos de contato: fundo, avatar, mão, objeto e elementos de frente. Não existe uma ordem fixa universal; uma xícara pode ficar atrás dos dedos e à frente do torso. O método de `mão foreground` é um recurso de oclusão que precisa da máscara correta.

A pintura contém iluminação desenhada. Colocar um avatar iluminado frontalmente numa cena com luz lateral extrema pode parecer colagem. Para cenas normais, favorecer luz compatível. Para mudanças fortes, criar uma versão de iluminação coerente e conferir todas as peças afetadas; não aplicar filtros diferentes a rosto, pescoço e braço. O runtime atual não relê uma textura pintada como se ela tivesse materiais3D.

A margem precisa considerar a extensão do gesto, não só a pose neutra. Aumentar a área disponível da cena quando necessário. Se for preciso diminuir o avatar, usar a mesma escala para todas as poses; não corrigir cortes reduzindo apenas abertura ou explicativo.

## O que um futuro seletor de skins precisa implementar

O seletor ainda não faz parte desta entrega. A primeira solução pode carregar um pacote completo por variante e manter estados compatíveis de forma explícita. Uma troca precisa carregar/preaquecer os assets, aplicar os adaptadores uma vez na instância correspondente, preservar a intenção quando compatível e evitar flash, texturas velhas ou duas roupas simultâneas.

Se a roupa for montada de peças intercambiáveis, será necessário um contrato adicional de slots, coordenadas, máscaras, pivôs e compatibilidade entre gesto/roupa. Nomes iguais de arquivo não provam compatibilidade. Não inventar uma chamada `setSkin` ou chave de schema como se o player atual já as suportasse.

Registrar no futuro: personagem, skin, cena, versão, origem, hashes, assets finais, player, landmarks, regra de oclusão, props compatíveis, gestos disponíveis e estado da validação com áudio. Modelos de registro estão em [Templates e prompts](TEMPLATES-E-PROMPTS.md).
