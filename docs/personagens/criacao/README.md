# Criação dos personagens pintados (documentação do Codex)

> Cópia da documentação de criação escrita no ambiente de produção de arte (`/Users/lucasmarte/Desktop/Personagens/`), trazida para o repositório em 18/11/2026. Os caminhos relativos a pacotes (`bia_pintura/`, `luck_pintura/` etc.) e os prompts citados continuam naquela pasta. O controle de qualidade e o que foi corrigido na integração estão em [../QA-CORRECOES-E-VALIDACOES.md](../QA-CORRECOES-E-VALIDACOES.md).

Referência consolidada em **18/11/2026**. Este documento é o ponto de entrada para continuar o trabalho em outro chat, criar personagens e produzir skins, roupas ou situações novas. Os pacotes de arte atuais permanecem preservados; esta documentação não cria versões de Natal, Páscoa ou ambientes novos.

A direção atual é **pintura digital estilizada com sensação de volume e pinceladas suaves**, aplicada a um rig2D deformável. A aparência lembra pintura em movimento; os arquivos não são modelos3D e não possuem materiais/luzes3D em tempo real.

## Onde continuar

| Necessidade | Documento |
|---|---|
| Localizar a versão correta, módulos, coordenadas e diferenças entre personagens | [Registro técnico](REGISTRO-TECNICO.md) |
| Criar um personagem do master até o rig e corrigir defeitos | [Produção e QA](PRODUCAO-E-QA.md) |
| Fazer Natal, Páscoa, roupas profissionais e cenas em outros lugares | [Skins, temas e cenários](SKINS-TEMAS-E-CENARIOS.md) |
| Preparar um pedido completo de geração ou implementação | [Templates e prompts](TEMPLATES-E-PROMPTS.md) |
| Revisar a entrega antes de integrar | [Checklist de entrega](CHECKLIST-DE-ENTREGA.md) |
| Comparar os arquivos desta baseline por SHA-256 | [Inventário verificável](INVENTARIO-BASELINE.json) |

Raiz de trabalho desta sessão: `/Users/lucasmarte/Desktop/Personagens/`. Os caminhos relativos deste manual partem dessa raiz. As prévias precisam de um servidor HTTP; `file://` não é suficiente para módulos e texturas.

## Pacotes de referência atuais

| Personagem | Identidade | Fonte executável | Prévia local | Integração |
|---|---|---|---|---|
| Bia | Mulher adulta, cabelo castanho ondulado, argolas douradas, jaqueta terracota, camiseta verde suave | `bia_pintura/rig/model.json` | [Bia](http://127.0.0.1:8765/bia_pintura/testar.html) | [Prompt Bia](PROMPT-PARA-CLAUDE-INTEGRAR-BIA-PINTURA.md) |
| Luck | Homem adulto, traços levemente asiáticos, cachos castanhos, camisa azul-petróleo, camiseta creme | `luck_pintura/rig/model.json` | [Luck](http://127.0.0.1:8765/luck_pintura/testar.html) | [Prompt Luck](PROMPT-PARA-CLAUDE-INTEGRAR-LUCK-PINTURA.md) |
| Yuno | Adolescente, sardas, cabelo curto ondulado, mecha rosa, presilhas, moletom lilás | `yuno_pintura/rig/model.json` | [Yuno](http://127.0.0.1:8765/yuno_pintura/testar.html?v=gola-v4) | [Prompt Yuno](yuno_pintura/PROMPT-PARA-CLAUDE-INTEGRAR-YUNO-PINTURA.md) |
| Yuri | Adolescente, traços levemente asiáticos, cabelo espetado castanho, olhos âmbar, pinta, moletom azul com capuz pêssego | `yuri_pintura/rig/model.json` | [Yuri](http://127.0.0.1:8765/yuri_pintura/testar.html?v=yuri-v1) | [Prompt Yuri](yuri_pintura/PROMPT-PARA-CLAUDE-INTEGRAR-YURI-PINTURA.md) |

As pastas `bia/`, `homem/`, `yuno/` e `yuri/` pertencem a versões anteriores. `mulher/`, `menina/`, `menino/`, pastas `*_trabalho/`, candidatos e históricos não devem ser escolhidos automaticamente como a versão final. Um nome de arquivo como `master` ou `head_base` não prova que o runtime o utiliza.

## Regras que precisam sobreviver a futuras versões

1. **Identidade fixa.** Definir um master e medir suas âncoras antes das variações. Roupa temática não pode trocar rosto, idade, corpo, penteado, tamanho dos olhos ou sinais distintivos por acidente.
2. **Imagens finais em PNG RGBA, com transparência real.** Não entregar fundo branco, halo ou esfumaçado como parte do avatar. Cenário é um asset separado.
3. **Uma pose por imagem nativa.** Padrão atual1024×1536; não gerar várias pessoas pequenas numa folha para ampliar depois.
4. **Rosto e corpo independentes.** Um único corpo visível por frame. Troca atômica dos gestos, sem duas mangas ou mãos translúcidas. Reação não deve resetar braços ou fala.
5. **Boca registrada antes de misturar.** Cada desenho tem contornos próprios; deformar as fontes para uma geometria comum antes de compor. Conferir frames intermediários e sorriso da piscada, não apenas extremos.
6. **Queixo pela malha existente.** Descida pequena proporcional à abertura, sem peça de queixo sobreposta e sem esticar o pescoço inteiro. Coordenadas e amplitudes são específicas de cada rosto.
7. **Olhos recortados pela sua reação.** Esclera, íris, máscara e pálpebra correspondentes; sobrancelhas não descem junto com a piscada. Na regra mais recente, a piscadinha intencional mantém o outro olho aberto.
8. **Pescoço e gola formam uma continuidade.** Não usar um retângulo de pele sobre a roupa. Uma gola antiga não deve permanecer por baixo de outra roupa.
9. **Movimento com causa.** Cabeça responde à troca real de gesto e assenta; não pendula por timer ou sílaba. Mechas, tecidos e argolas respondem com pequena inércia amortecida, ancorada corretamente.
10. **Revisão visual mais evidência técnica.** Testes sem erro não garantem arte correta. Revisar também mãos, contornos, clavícula, cabelo, cor, transições e o contexto da composição.
11. **Voz real é uma etapa própria.** As bancadas atuais simulam fala sem áudio; não afirmar sincronismo real validado só porque o canvas anima.
12. **Variantes em pacotes novos.** Preservar a versão anterior e sua evidência. Troca de skin completa e combinação dinâmica de roupas/cenários ainda precisam de implementação no produto.

## Estado de implementação e limites

Os quatro pacotes possuem sete estados faciais e seis estados corporais (incluindo neutro). Não são cópias intercambiáveis: Bia possui argolas e uma geração anterior do adaptador; Luck tem contornos e malha próprios; Yuno inclui a correção `gola-v4`; Yuri adiciona o controle explícito dos PNGs com halo e exporta13 retratos transparentes em `yuri_pintura/pngs/`.

A infraestrutura atual foi exercitada localmente com o LivLiv0.5.1. Os adaptadores usam propriedades internas e precisam de cuidado ao mudar a versão do player. Não há evidência nesta baseline de validação audiovisual com TTS real no aplicativo, nem de skins sazonais prontas, nem de um seletor de temas/roupas/cenários implementado. O manual descreve como produzir e validar essas próximas etapas.

## Como retomar daqui a meses

Leia este documento e o registro técnico. Escolha **personagem + roupa/tema + cena + versão**. Abra o rig real e a prévia daquele pacote, compare com o inventário e leia o prompt de integração correspondente. Crie uma pasta nova para a variante. Só então gere ou edite os assets necessários. Preserve as regiões aprovadas que não mudam e revalide todas as regiões afetadas pela alteração.

O documento histórico [Método do Yuri original](METODO-PERSONAGENS-BOOKMOO-YURI.md) explica a primeira conquista no estilo anime. Regras antigas como `jaw=0`, ausência de física de mechas ou reduzir o outro olho na piscadinha não devem ser aplicadas às versões pintadas por cópia automática. O registro técnico abaixo descreve o estado real de cada pacote.
