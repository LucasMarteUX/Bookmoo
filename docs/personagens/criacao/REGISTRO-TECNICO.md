# Registro técnico da baseline

[Voltar à documentação principal](README.md). Estado inspecionado nos arquivos em18/11/2026. Não uniformiza ou atualiza os personagens antigos: registra as diferenças existentes para permitir manutenção segura.

## Prioridade das fontes

1. O pacote completo atualmente selecionado: `rig/model.json`, todas as texturas referenciadas e os módulos carregados pela sua prévia.
2. Master visual e instruções específicas desse pacote.
3. Evidências `validacao_*.json` e capturas correspondentes, verificando sua versão.
4. Inventário de hashes desta baseline.
5. Documentos antigos e fontes/histórico como registro do processo, nunca como escolha automática de assets finais.

Nome de arquivo, timestamp recente, um JSON de validação antigo ou ausência de erro no console não demonstram sozinhos que a versão é visualmente correta.

## Mapa dos pacotes pintados

| Item | Bia | Luck | Yuno | Yuri |
|---|---|---|---|---|
| Pasta | `bia_pintura/` | `luck_pintura/` | `yuno_pintura/` | `yuri_pintura/` |
| Master atual | `00_master_revisado.png` | `00_master.png` | `00_master.png` | `00_master.png` |
| Revisão relevante | Olhos reduzidos, reparo de cabelo e reações | Explicativo, boca conversacional, triste/bravo, ações | `gola-v4` | `yuri-v1`, alpha real |
| Canvas |1024×1536 |1024×1536 |1024×1536 |1024×1536 |
| Camadas no modelo |19 |19 |19 |19 |
| Estados faciais/corporais |7 /6 |7 /6 |7 /6 |7 /6 |
| Textura da boca |157×88 |151×84 |153×80 |153×80 |
| Origem x,y da boca |452,417 |443,390 |452,350 |441,331 |
| Pivô da boca |530,448 |516,418 |526,378 |518,364 |
| Campo de queixo: cx/top/chin/end |521 /475 /535 /555 |516 /440 /502 /528 |519 /398 /447 /469 |518 /382 /422 /448 |
| Largura integral/externa do campo |60 /110 |60 /112 |48 /91 |46 /82 |
| Aberturas half/open/round/wide em px |0,7 /3,5 /2,2 /2,7 |1,3 /7,2 /4,2 /5,6 |1,1 /6,4 /3,7 /5 |1,2 /6,2 /3,6 /4,8 |
| Triangulação da boca |40, anterior |40, contornos próprios |38, faixa/envelope |38, faixa/envelope |
| Argolas |Sim, pivôs nos furos |Não |Não |Não |
| `acoes.js` separado |Não |Sim |Sim |Sim |
| Regra explícita de manter olho direito aberto em `x_wink` |Não presente no adaptador atual |Não presente no adaptador atual |Presente |Presente |
| `model.tex` explícito por conteúdo |Ausente |Ausente |Presente |Presente |

Valores são coordenadas nativas atuais, não um template para outro rosto. `jaw.open` representa a amplitude configurada; o vértice amostrado pode deslocar menos pelo peso da malha. Testes isolados registram cerca de2,953125 px para Bia,7,0787 para Luck,6,33096 para Yuno e6,15506 para Yuri. Esses resultados não se transferem a um rosto redimensionado.

As ausências da tabela são diferenças de implementação, não autorização para corrigir Bia/Luck durante uma troca de roupa. Portar regras novas exige uma versão isolada e nova validação. Os quatro pacotes não usam exatamente o mesmo código. Bia ainda não encaminha o ID da reação ao repouso da boca como as versões posteriores; não presumir que ela contém todas as correções recentes do Yuri.

## Contratos do runtime

Player local inspecionado: `auditoria/livliv-player/dist/index.js`, família LivLiv0.5.1, modelo schema v4. O perfil visual declarado no modelo não transforma o conteúdo em geometria3D. Adaptadores usam internals por instância: `puppet`, camadas, deformação, desenho, pesos de boca e mapas de expressão.

Inicialização de referência, adaptada aos imports e URLs do pacote de destino:

```js
await player.load(baseDoRig);
const jawControl = configurarQueixoLocal(player);
const natural = await configurarMovimentoNatural(player);
```

Bia possui cinco módulos locais: queixo, movimento, boca, resposta de cabeça e reações. Luck/Yuno/Yuri acrescentam `acoes.js`; `fala_demo.js` é exclusivo da demonstração. Não acrescentar um módulo ausente por nome esperado nem chamar novamente o que o adaptador natural já inicializou.

Entradas principais: `mouthOpen` entre0 e1, `vowel` entre−1 e+1, aberturas dos olhos, direção do olhar, ângulos e pesos de reação/gesto. No vocabulário atual, o negativo de `vowel` favorece arredondamento e o positivo forma larga. Confirmar o contrato do player na versão utilizada.

IDs de reação: `smile`, `surprised`, `sad`, `angry`, `shy`, `x_wink`; neutro não exige uma reação ativa. IDs de corpo: `gesto_enfase`, `gesto_explicativo`, `gesto_abertura`, `gesto_reflexao`, `gesto_conclusao`; neutro significa todos zero. O primeiro pode ser controlado pelo parâmetro/estado de sorriso conforme a implementação. Consultar `reacoes.js`, não assumir que todos os IDs são só pesos idênticos.

A troca de corpo é atômica nos mapas usados pelo player, sem sobrepor dois corpos. O grupo da roupa é `body`; as peças que precisam se encaixar compartilham transformação e pesos coerentes. Só `model.json` não implementa todo o controlador de gestos e reações da bancada.

## Reações, cabeça e composição

Todos possuem resposta pontual por troca de gesto:0,44 s de entrada,2,2 s de manutenção,0,60 s de retorno; retorno ao neutro0,55 s; centro mantido até nova troca. Ganho positivo1,25. Valores de ângulo do controlador são escalados pelo rig: não descrevê-los automaticamente como graus finais visíveis.

Yuno/Yuri têm12 botões de composição: alegria com ênfase, explicação animada, explicação tranquila, descoberta, ponderação, agradecimento, brincadeira, boas-vindas, discordância, empatia, dúvida e conclusão alegre. Essa camada editorial não cria outra identidade nem torna expressão e corpo inseparáveis.

Argolas da Bia: pivôs documentados `[384.5,419]` e `[659,398]`, na escala nativa dela. As coordenadas não devem ser copiadas para outro cabelo/orelha ou para acessórios novos. Os campos de movimento secundário também são específicos.

## Reconstrução por pacote

| Pacote | Caminho de manutenção |
|---|---|
| Bia | Ler `bia_pintura/README.md`, `MOVIMENTO-NATURAL.md` e `REACOES.md`. O construtor inicial sozinho não reproduz a revisão final: houve redução de olhos, reparo de cabelo, integração de gestos, cores e reações. Usar os scripts específicos e o histórico necessário, numa cópia. |
| Luck | `auditoria/construir_luck_pintura.py`; depende das fontes e referências locais descritas no README. |
| Yuno | `auditoria/construir_yuno_pintura.py`; mantém correções de boca/gola e máscara da reflexão. |
| Yuri | `auditoria/construir_yuri_pintura.py`; usa as fontes tratadas, `reflexao_mao.json` e referências locais. Reparos de alpha em `corrigir_alpha_yuri_pintura.py` e `recortar_gestos_yuri_pintura.py`; exportação em `exportar_pngs_yuri_pintura.mjs`. |

Alguns construtores usam um modelo antigo de Bia apenas como referência de schema. Por isso o diretório de origem faz parte das dependências de reconstrução, embora não faça parte dos assets que o aplicativo carrega. Não distribuir um script isolado como um gerador portátil sem levar e registrar suas dependências.

Python local com dependências de processamento: `.venv/bin/python`, incluindo Pillow, NumPy, OpenCV e SciPy. Headless local: Playwright Core em `auditoria/livliv-player/node_modules/playwright-core/` e Chrome do macOS. Os testes atuais usam esse ambiente; adaptar caminhos se mover para outro computador. Não é necessário regenerar arte para verificar a documentação ou o inventário.

## Executar e verificar

A partir da raiz Personagens, servir os arquivos por HTTP, por exemplo:

```sh
python3 -m http.server 8765
```

Se já existir servidor nessa porta, reutilizá-lo. As páginas `testar.html` de cada pacote são interativas; `teste.html` é a bancada determinística quando presente. Os scripts de QA estão em `auditoria/`; conferir o URL e a pasta de saída antes de executar, especialmente ao adaptar um teste antigo.

Exemplos de testes existentes do pacote mais recente, a partir da raiz:

```sh
node auditoria/testar_transicoes_boca_yuri_pintura.mjs
node auditoria/testar_gestos_yuri_pintura.mjs
node auditoria/testar_encaixe_yuri_pintura.mjs
node auditoria/validar_entrega_yuri_pintura.mjs
```

Eles dependem do servidor e da instalação local descrita acima. Validam escopos diferentes; não substituem revisão audiovisual com TTS real. As evidências presentes de cada pacote estão enumeradas no inventário JSON. Um teste de opacidade no centro do pescoço não prova, sozinho, que a gola não tenha uma ponta sobre a pele.

## Inventário e retomada verificável

`INVENTARIO-BASELINE.json` registra SHA-256 do modelo, do master, das texturas referenciadas, dos módulos locais presentes, do player e do prompt de integração, por pacote. Também lista medidas e validações disponíveis. Os manifestos antigos têm estruturas diferentes; este inventário oferece uma captura comum sem reescrevê-los.

Conferência sem alterar os personagens:

```sh
python3 auditoria/registrar_baseline_personagens.py
```

O comando detecta arquivos alterados/ausentes e confere as referências dos modelos atuais. Não avalia pixels visualmente, comportamento do navegador ou áudio.

Após concluir e revisar uma versão nova, preservar a baseline anterior antes de registrar uma nova captura:

```sh
python3 auditoria/registrar_baseline_personagens.py --registrar
```

Esse segundo comando escreve o inventário e deve ser usado deliberadamente. Não usá-lo para fazer uma divergência desaparecer sem investigar a causa. Se houver novas pastas de personagens/variantes, atualizar o mapa de pacotes do registrador ou criar um inventário específico para a variante.

## Lacunas explicitamente registradas

- Não há validação de voz/TTS real no aplicativo nesta baseline.
- Não há skins de Natal/Páscoa ou cenas de restaurante/aeroporto/cafeteria/balada concluídas por esta documentação.
- Não há seletor genérico de skins, roupas e cenários já implementado.
- Bia/Luck não receberam automaticamente todas as regras novas de piscadinha/cache/topologia da boca.
- O corpo não é3D; novas perspectivas ou movimentos grandes não podem ser inventados por uma pequena deformação2D.

Essas lacunas não invalidam as entregas locais. Elas delimitam o trabalho necessário antes de afirmar que uma nova integração ou variante está pronta.
