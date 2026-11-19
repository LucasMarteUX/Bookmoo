# Templates e prompts de retomada

[Voltar à documentação principal](README.md). Os campos entre colchetes são campos deliberados para preencher no brief, não arquivos ou APIs existentes. Salvar o prompt efetivamente usado, as referências e o resultado correspondente.

## Brief de personagem ou variante

```markdown
# [personagem] — [skin/roupa] — [versão]
Data:
Responsável/revisor:
Tipo: identidade nova / roupa nova / tema / cena / iluminação
Pacote base e versão:
Hash do model.json de origem:
Master de identidade:
Master da roupa:
Idade aparente:
Traços fixos do rosto/olhos/cabelo:
Sinais e acessórios, indicando o lado da imagem:
Paleta e materiais:
Roupa/tema e alterações permitidas:
Alterações proibidas:
Cena, enquadramento e iluminação:
Props e contato/pegada:
Gestos necessários:
Reações necessárias:
Regiões reaproveitadas sem mudança:
Regiões e máscaras refeitas:
Coordenadas/pivôs novos:
Player e módulos usados:
Fontes brutas / PNGs tratados / assets finais:
Testes e evidências:
Estado: em criação / revisão visual / rig local validado / integrado / validado com áudio
Limitações e trabalho restante:
```

## Prompt para novo master pintado

> Crie [identidade e idade aparente], personagem original do universo Bookmoo, com [traços específicos]. Direção de pintura digital estilizada com volumes2.5D, pinceladas leves acompanhando rosto/cabelo/tecido e iluminação difusa coerente. Preservar a aparência da idade definida. Pose frontal ereta, cabeça sem inclinação, ombros nivelados, olhar natural, boca fechada com sorriso discreto e braços relaxados. Roupa [descrição completa], acessórios [lado da imagem]. Uma pessoa por imagem1024×1536, com cabelo e mãos completos e margem para gestos. Arquivo PNG RGBA com transparência real. Fundo externo semitransparente, fumaça, glow, texto e cenário não fazem parte do personagem. Não transformar em fotografia nem anime de cores chapadas.

Se houver referências, identificar explicitamente qual fixa identidade e qual orienta estilo. A referência de estilo de uma mulher não muda o gênero ou o rosto do Yuri/Luck.

## Prompt para troca de roupa ou tema sazonal

> Editar [master de identidade] para [Natal/Páscoa/uniforme/roupa]. Mudar somente [roupa e acessórios especificados]. Manter exatamente identidade, idade aparente, anatomia, rosto, cor/formato dos olhos, cabelo, sinais distintivos, posição da cabeça, escala do corpo e qualidade da pintura. Roupa: [materiais, caimento, paleta, gola, mangas, punhos, estampa]. Acessórios permanecem [lados definidos], exceto [mudanças intencionais]. Preservar braços completos, mãos proporcionais e cinco dedos totais. O novo neutro será a referência das cores e da gola para todos os gestos dessa skin. Uma pose por PNG1024×1536 com transparência real e sem cenário ou halo.

Depois da geração, comparar com o master; não interpretar esse prompt como prova de registro perfeito. Trocas no rosto ou gola não autorizadas devem ser corrigidas antes de derivar poses.

## Prompt para gesto de uma skin

> Usar [master neutro da skin] como identidade, roupa, cor e escala. Alterar os braços para [descrição anatômica/intenção do gesto]. Manter cabeça, tronco, gola, ombros, cintura e comprimentos dos braços nas coordenadas da referência. Mãos proporcionais, polegar mais quatro dedos, linhas contínuas e mangas com volume/caimento da roupa. Acessórios no lado [definido]. Não diminuir o corpo para caber a mão: ajustar cotovelos e respeitar as margens. PNG nativo1024×1536, uma pose, fundo transparente sem fumaça. Preservar as pinceladas e a iluminação do neutro.

Para reflexão, acrescentar: dedo encostando sob o queixo sem cobrir a boca; mão à frente com contornos completos; nenhum lábio estático pertence à mão. Para conclusão, explicitar polegar e **quatro** dedos longos. Para explicativo, especificar uma mão e qual lado; não aceitar duas palmas como abertura repetida.

## Prompt para expressão ou visema

> Editar somente [olhos/sobrancelhas/boca/reação] do master registrado. Preservar silhueta externa, cabeça, posição/escala, nariz, orelhas, cabelo, sinais, pescoço, roupa e pintura. Expressão: [descrição]. Boca em [posição e dimensão medidas], [grau de abertura moderado], sem dentes cerrados persistentes ou abertura de grito. Não acrescentar segunda sobrancelha nem deformar o branco do olho além do desenho. Mesmo canvas e transparência limpa. Entregar uma variante individual.

Medir os contornos novos e registrar o alinhamento. Se o desenho mudou a forma da boca, ele necessita landmarks próprios; não reutilizar o neutro por conveniência.

## Prompt para cenário separado

> Criar cenário de [lugar/situação] em pintura digital coerente com os personagens Bookmoo. Definir [enquadramento, perspectiva, luz, profundidade e espaço reservado para o avatar]. Personagem será composto separadamente; não desenhá-lo no fundo. Elementos de interação previstos: [mesa, balcão, cadeira, espaço para prop]. Evitar conflito de escala/perspectiva e excesso de detalhe atrás do rosto. Definir [resolução e proporção de destino]. Objetos que precisam passar à frente do avatar devem ser entregues como camadas próprias conforme o plano da cena.

O fundo da cena pode ser opaco; isso não muda o requisito de transparência do PNG do personagem.

## Prompt completo para um próximo agente implementar uma variante

```text
Leia primeiro DOCUMENTACAO-FINAL-PERSONAGENS-BOOKMOO.md, o registro técnico,
o manual de skins e o prompt de integração do pacote escolhido.

Tarefa: produzir/integrar [personagem + skin + cena + versão].
Pacote de origem: [caminho e hash].
Referência de identidade: [arquivo].
Mudanças solicitadas: [lista].
Invariantes: [lista].
Destino da nova versão: [pasta isolada].

Use os arquivos efetivamente referenciados por rig/model.json, com todos os
bancos de textura, módulos e caminhos corretos. Preserve a baseline e os outros
personagens. Não aplicar coordenadas, máscaras ou roupas de outro personagem.
Não usar fontes de histórico como se fossem assets finais.

Conclua master da roupa, PNGs individuais, registro facial quando necessário,
gola/oclusões, gestos, reações, boca contínua, queixo local, movimentos,
prévia e validação. Preserve transparência real: sem fundo branco ou halo.
Cenário/props ficam separados e com ordem de camadas/contatos documentados.

Rosto e corpo independentes; exatamente um corpo por frame. Visemas registrados
antes da composição. Não duplicar lábio, sobrancelha, manga ou mão. A cabeça
responde a trocas reais de gesto, assenta e não pendula por sílabas/timer.

Teste tudo sobre fundos claros/escuros, no close e no enquadramento final,
com todos os gestos e reações, transições, giros, inclinações e ações com idle
ligado/desligado. Revise gola, clavícula, cabelo, dedos, mangas, cor, olhos e boca.
Não encerrar somente porque os testes não lançam erro; inspecione as imagens.

Ligue a fala ao áudio/TTS real quando estiver no escopo. Não usar fala_demo.js
como lipsync de produção. Informe claramente o que foi e não foi testado.

Entregue pacote completo, PNGs RGBA finais, master, prompts efetivos, metadados,
hashes, coordenadas, testes/evidências e instruções de execução. Registre a
variante como final apenas depois de concluir a revisão correspondente.
```

## Registro de composição contextual

| Campo | Exemplo de intenção |
|---|---|
| Contexto | Acolher cliente na cafeteria |
| Reação | Sorriso discreto, olhar para o interlocutor |
| Gesto | Abertura breve, depois neutro |
| Fala | Sincronizada com o áudio, com pausas |
| Resposta da cabeça | Uma entrada pelo gesto, pausa e retorno |
| Prop | Nenhum, ou copo com pose de pegada validada |
| Saída | Voltar ao neutro ao terminar a intenção |

As12 composições atuais são exemplos, não uma tabela obrigatória de uma emoção para um corpo. O agente pode melhorar as combinações conforme intenção e ritmo, respeitando as restrições visuais e sem repetir mecanicamente o mesmo gesto.
