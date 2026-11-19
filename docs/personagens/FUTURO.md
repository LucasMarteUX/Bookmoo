# Personagens: possibilidades para o futuro

Resumo das possibilidades exploradas na [documentação de criação do Codex](criacao/README.md) (principalmente
[Skins, temas e cenários](criacao/SKINS-TEMAS-E-CENARIOS.md)), com o que a integração no app já ensinou para cada uma.
**Nada disto está produzido ou implementado ainda**; é o mapa para os próximos pacotes. O controle de qualidade de qualquer
item abaixo segue [QA-CORRECOES-E-VALIDACOES.md](QA-CORRECOES-E-VALIDACOES.md).

## Quatro eixos independentes

| Eixo | Exemplos | Regra |
|---|---|---|
| Identidade | Bia, Luck, Yuno, Yuri, personagem novo | Rosto, idade, sinais e proporções não mudam por acidente |
| Roupa (skin) | Original, Natal, Páscoa, uniforme, casual diferente | Nova referência neutra vestida + todos os gestos coerentes |
| Cena | Cafeteria, aeroporto, restaurante, balada, casa/estudo | Cenário e props separados do PNG transparente do personagem |
| Intenção | Acolher, explicar, surpreender, refletir, discordar, concluir | Gesto + reação + fala escolhidos pelo contexto, não fixos por tema |

## Quanto cada mudança custa

| Mudança | Reaproveita (depois de conferir) | Precisa produzir/revalidar |
|---|---|---|
| Só o cenário atrás | Pacote inteiro | Escala, contraste, luz aparente, margens |
| Recolorir tecido | Rosto, coordenadas, talvez malha | Máscaras por material, todos os gestos, alpha, paleta |
| Roupa nova, mesma postura | Rosto, olhos, bocas, landmarks | Master vestido, 5 gestos, gola, mangas, mãos, pesos da roupa |
| Gorro, tiara, headset, óculos | Regiões não cobertas | Oclusão de cabelo/orelhas/sobrancelhas, pivô, movimento |
| Avental, cachecol, casaco, objeto na mão | Identidade | Silhueta, tecidos, contato da mão, ordem de camadas |
| Postura/câmera/corpo diferentes | Referência de estilo | Registro e possivelmente o rig inteiro |
| Rosto novo ou outra idade | Linguagem visual | Tudo: master, medidas, olhos, bocas, queixo, reações, rig |

## Skins sazonais

- **Natal:** roupa festiva, gorro, cachecol, casaco, broche. O gorro precisa de pivô no crânio e máscara de oclusão dos fios;
  o pompom pode ter inércia própria. O cachecol invade o pescoço: a continuidade cabeça–gola–tecido tem de ser refeita.
  Vermelho/verde não pode recolorir pele, olhos, sardas ou cabelo; neve não pode virar halo de alpha.
- **Páscoa:** cores suaves, broche, tiara de orelhas (acessório ancorado, não anatomia), cesta e ovos como props com pegada.
  Não encolher tronco ou mãos para caber a cesta.

O que a integração ensinou: a **gola e o pescoço** foram a fonte de defeito mais persistente (Luck e Yuno). Toda roupa que
mexe no colo precisa da validação de gola na entrada, na pose e no retorno da cabeça, não só parada. Acessório na cabeça
precisa seguir o mesmo campo de inclinação e o balanço do corpo que aplicamos pela malha (seção 4 do QA).

## Roupas por cena

| Cena | Roupa/props | Gesto/intenção | Atenção |
|---|---|---|---|
| Restaurante | Uniforme, avental, cardápio, bandeja | Acolher, explicar opções | Bandeja e mãos, avental sobre o torso |
| Cafeteria | Avental, copo, xícara | Explicar preparo, agradecer | Pegada, copo à frente do tecido, vapor em camada própria |
| Aeroporto | Casual ou uniforme, crachá, bilhete, mala, headset | Orientar, enfatizar | Headset/orelhas, mão no bilhete, escala da mala |
| Balada | Casual/noturna | Conversa animada, piscadinha | Luz da cena sem estourar o rosto; nada piscando no avatar |
| Casa/estudo | Confortável, livro, mesa, fone | Refletir, concordar | Oclusão atrás da mesa, dedos no livro |

Segurar objeto exige **pose nova** (as seis atuais não cobrem). O avatar continua transparente; cenário e props em camadas
atrás e à frente. Luz muito diferente da pintada pede uma versão de iluminação coerente, nunca filtro só em uma parte.

## Seletor de skins (quando existir)

- Primeiro passo possível: um pacote completo por variante (`<nome>-<skin>-pintura/`), carregado e pré-aquecido, com os
  adaptadores aplicados uma vez na instância, sem flash nem duas roupas ao mesmo tempo.
- Roupas por peças intercambiáveis exigem um contrato novo (slots, coordenadas, máscaras, pivôs, compatibilidade
  gesto × roupa). O player atual **não** tem `setSkin`; não inventar chamada nem chave de schema.
- No app: `characters.ts` hoje tem uma pasta por personagem. Uma skin pode entrar como outra entrada com o mesmo `id` de
  voz e memória do tutor, ou como campo `skin` escolhido por cena; decidir antes de produzir.
- Registrar por variante: personagem, skin, cena, versão, origem, hashes, assets, player, landmarks, oclusão, props, gestos e
  estado da validação com áudio.

## Reações mais avançadas

Ideias levantadas a partir do que já funciona, para avaliar com o produto:

- **Intensidade:** hoje cada reação é ligada/desligada. Bancos com meio-termo (ex.: sorriso leve × riso) dariam transições
  mais naturais sem trocar o desenho de uma vez.
- **Combinações contextuais:** a tabela de composições da entrega (explicação animada, descoberta, empatia etc.) pode virar
  escolha pelo texto da fala, mantendo gesto por unidade de sentido e pausas em neutro.
- **Olhos expressivos sem troca de desenho:** a pálpebra que desce dos cílios já permite meio-fechado (sono, desconfiança)
  por parâmetro, sem textura nova.
- **Piscadinha e feliz de olhos fechados como desenho próprio:** só voltar a usar os arcos da entrega quando houver
  transição desenhada entre o olho aberto e o arco (hoje eles pulam de lugar).
- **Rir, pensar, assentir falando:** combinações de ação (`acoes.js`) com reação e fala, sem pêndulo nem repetição por sílaba.

Toda reação nova passa pela bateria de olhos, boca e piscada da seção 5 do QA, nas reações de base **e** combinada com os
seis gestos.
