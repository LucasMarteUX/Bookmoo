
Você vai construir uma tela de login diretamente no Paper utilizando as ferramentas MCP disponíveis.

Nenhum arquivo de código deve ser gerado. Toda a saída deve ser aplicada diretamente na tela do Paper via MCP tools.

---

## INICIALIZAÇÃO

Utilize ⁠find_placement⁠ para localizar uma posição adequada na tela, depois chame ⁠create_artboard⁠ com as seguintes configurações:
- Nome: "WebApp – Login"
- Largura: 1440px
- Altura: 900px
- Cor de fundo: #F0F0F2 (cinza claro neutro)

Em seguida, antes de qualquer construção, chame ⁠get_font_family_info⁠ para confirmar disponibilidade das fontes "Plus Jakarta Sans" e "DM Sans". Caso alguma não esteja disponível, utilize a alternativa mais próxima e informe.

---

## SISTEMA TIPOGRÁFICO

Aplique este esquema de fontes de forma consistente em todo o layout:

- **Títulos, destaques e chamadas principais** → font-family: "Plus Jakarta Sans", sans-serif
- **Rótulos, placeholders, botões, textos de apoio e corpo** → font-family: "DM Sans", sans-serif

---

## ESTRUTURA DO LAYOUT

Use ⁠write_html⁠ para montar a tela completa dentro do artboard.

A composição é dividida em dois painéis lado a lado, ocupando toda a altura:

### PAINEL ESQUERDO (680px de largura)
- Fundo: gradiente radial em tons de azul médio a azul royal (#3B4FD8 → #1A2FC4 → #2E1FA3)
- Padding interno: 72px
- Conteúdo alinhado verticalmente ao centro e ao fundo
- Elementos a incluir:
  1. Eyebrow label: "Você pode facilmente" — font-family: "DM Sans", tamanho 14px, cor branco com 70% opacidade, peso 400
  2. Título principal: "Acelere seu trabalho\ncom nosso Web App" — font-family: "Plus Jakarta Sans", tamanho 48px, peso 700, cor #FFFFFF, line-height 1.2
  3. Logos de parceiros na base do painel — label "Nossos parceiros" em "DM Sans" 13px cor branca 50% opacidade, seguido de 4 logos fictícios exibidos em linha (podem ser textos estilizados como: ◆ Discordia, ⊕ Instago, ▶ Streamly, ✦ Tiktal) em branco 60% opacidade, espaçados uniformemente

### PAINEL DIREITO (760px de largura)
- Fundo: #FFFFFF
- Display: flex, centralizado horizontal e verticalmente
- Contém o formulário de login (descrito abaixo)

---

## FORMULÁRIO DE LOGIN

Monte o bloco central no painel direito com as seguintes especificações:
- Largura: 440px
- Sem card container (formulário flutuante, sem fundo ou borda)
- Padding: 0
- Todos os elementos em coluna com espaçamento definido abaixo

Dentro do formulário, aplique via ⁠write_html⁠ os seguintes elementos em sequência:

### 1. Cabeçalho do Formulário
- Título: "Comece Agora" — font-family: "Plus Jakarta Sans", tamanho 36px, peso 700, cor #111111
- Subtítulo: "Faça login na sua conta para continuar." — font-family: "DM Sans", tamanho 15px, cor #888888, margin-top 8px

### 2. Campo — Nome
- Rótulo: "Nome" — "DM Sans", 13px, peso 500, cor #333333, margin-bottom 6px
- Input:
  - Largura: 100%
  - Altura: 50px
  - Fundo: #F7F7F8
  - Borda: 1px solid #E0E0E5
  - Border-radius: 10px
  - Padding: 0 14px
  - Placeholder: "Digite seu nome..." — "DM Sans", cor #BBBBBB
  - Fonte: "DM Sans", 15px, cor #111111
  - Foco: borda #3B4FD8, outline nenhum

### 3. Campo — E-mail
- Mesmos estilos do campo Nome
- Rótulo: "Endereço de e-mail"
- Placeholder: "workmail@gmail.com"
- Estado ativo: borda azul #3B4FD8, box-shadow sutil azul claro

### 4. Campo — Senha
- Mesmos estilos base
- Rótulo: "Senha" à esquerda + link "Esqueceu a senha?" à direita — "DM Sans" 13px, cor #3B4FD8
- Placeholder: "••••••••••••"
- Ícone de olho (👁) dentro do input no lado direito, cor #AAAAAA

### 5. Checkbox de Termos
- Checkbox padrão + texto: "Eu concordo com os " + link "Termos & Privacidade"
- Font-family: "DM Sans", 13px, cor #666666
- Link: cor #3B4FD8, sem sublinhado

### 6. Botão Principal de Ação
- Texto: "Entrar" — "DM Sans", 16px, peso 600
- Largura: 100%
- Altura: 52px
- Fundo: #3B4FD8
- Border-radius: 10px
- Cor do texto: #FFFFFF
- Hover: fundo levemente mais escuro #2E3FC0
- Margin-top: 4px

### 7. Link de Cadastro
- Texto: "Não tem uma conta? " + "Cadastre-se"
- "DM Sans", 14px, cor base #999999
- "Cadastre-se": cor #3B4FD8
- Alinhamento: centro
- Margin-top: 20px

### 8. Separador "Ou"
- Linha horizontal com texto "Ou" centralizado
- Cor da linha: #E8E8EC
- Texto: "DM Sans" 13px, cor #BBBBBB

### 9. Botões de Login Social
- Dois botões em linha (50% cada), com gap de 12px:
  - Botão Google: ícone "G" colorido + texto "Login com Google"
  - Botão Apple: ícone Apple (🍎) + texto "Login com Apple"
- Altura: 50px
- Fundo: #FFFFFF
- Borda: 1px solid #E0E0E5
- Border-radius: 10px
- Fonte: "DM Sans" 14px, peso 500, cor #333333

---

## ESPAÇAMENTOS INTERNOS DO FORMULÁRIO
- Entre grupos de rótulo + input: 18px
- Entre o campo senha e o checkbox: 16px
- Entre o checkbox e o botão principal: 24px
- Entre o botão principal e o link de cadastro: 16px
- Entre o link de cadastro e o separador: 20px
- Entre o separador e os botões sociais: 20px

---

## ETAPA FINAL
Após montar todos os elementos, execute ⁠get_screenshot⁠ no artboard e exiba o resultado.