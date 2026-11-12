# Checklist de lançamento — Bookmoo

Revisão feita em 11/11/2026 sobre o código local e o banco de produção (Supabase `ywnmeacpvmcuhzhshpwz`).
Legenda: 🔴 bloqueia a venda · 🟠 resolver antes de abrir para muita gente · 🟢 melhoria.

## 1. Bloqueia vender (🔴)

- [ ] **Revogar o token do GitHub que está na URL do `origin`** (`git remote get-url origin` tem um `ghp_…`). Trocar por SSH ou credencial do sistema. Quem tiver acesso à máquina/log vê o token.
- [ ] **Cobrança não existe.** Não há Stripe, App Store/Play (IAP) nem planos no código. Decidir: assinatura web (Stripe) + IAP no app iOS (a Apple exige IAP para conteúdo digital vendido dentro do app).
- [ ] **Modelo de IA para cliente pagante.** Hoje cada pessoa precisa colar a própria chave da OpenAI para ilustrar. Para vender, o normal é chave da Bookmoo + créditos/limite por plano (cobrar o custo de ~US$0,04–0,17 por imagem). Exige: chave do servidor, contador de uso por usuário, limite por plano.
- [ ] **Excluir conta não existe.** Obrigatório pela LGPD e pela App Store. Precisa: botão em Ajustes → confirmação → função que apaga auth.user + dados (livros, posts, imagens no storage, chaves no Vault).
- [ ] **"Esqueci a senha" na tela de login.** Só existe troca de senha logado (Ajustes). Adicionar `resetPasswordForEmail` + tela de nova senha.
- [ ] **Termos e Privacidade revisados por advogado** (as páginas `/terms` e `/privacy` existem): citar uso de IA (OpenAI/Gemini), armazenamento de chaves, imagens públicas, idade mínima (há livros infantis), LGPD (controlador, DPO, direitos).
- [ ] **Commit + deploy do front.** Tudo desta fase está só local (sem commit). Na hora: commit, push para `main` (Vercel publica).

## 2. Segurança

Já conferido no banco hoje:
- ✅ Todas as tabelas `public` têm RLS ligado.
- ✅ Chaves de IA ficam no Vault (`vault.create_secret`), nunca em texto puro.
- ✅ Todas as Edge Functions exigem login (`getUser`).
- ✅ Prompt e amostra dos estilos não são legíveis pelo app (grant por coluna).
- ✅ Funções novas (menções) não executáveis por `anon`/`authenticated`.

Pendente:
- ✅ `20261112050000_hardening.sql` aplicada: `admin_overview`/`is_global_admin` fora do visitante; avatares só imagem até 2 MB.
- [ ] 🟠 CORS das funções está `*` (`TTS_ALLOWED_ORIGIN` não definido). Definir para o domínio de produção + `capacitor://localhost`.
- [ ] 🟠 `ai-text` e `ai-keys` sem limite de chamadas. Pôr rate limit por usuário (como em `comic-generate`/`tts-generate`).
- [ ] 🟠 Bucket `comic-pages` é público: qualquer um com a URL vê a ilustração. Ok para galeria; para livros enviados pelo usuário (EPUB próprio) considerar bucket privado + URL assinada.
- [ ] 🟢 Bucket `web` público sem limite de tipo/tamanho (resto antigo do avatar). Remover ou limitar.
- [ ] 🟢 Ativar no Supabase: confirmação de e-mail, proteção contra senha vazada, CAPTCHA no cadastro, MFA para o admin.

## 3. Quebrado / erro de lógica (corrigido hoje)

- ✅ Confirmações não abriam (o app/WebView bloqueia `window.confirm`): trocadas por confirmação própria em todo o app (apagar post, comentário, meta, avaliação, bloquear, remover seguidor, admin, desfazer amizade).
- ✅ Apagar post "funcionava" sem apagar quando o banco recusava: agora mostra erro.
- ✅ Excluir livro na biblioteca entrava no livro: ícones saíram de dentro da capa; confirmação explica que dá para baixar de novo pela Galeria.
- ✅ Apagar ilustração da página não pedia confirmação (e usava `alert`): agora confirma.
- ✅ Geração de imagem falhava (pedido > 32 mil caracteres): estilo encaixado no orçamento; trava final de tamanho.
- ✅ Estilo escolhido não era respeitado: amostra do estilo vai como referência, planejamento sem técnica, sem imitar edições famosas.
- ✅ Cards do Admin ilegíveis no modo escuro.
- ✅ App abria em inglês: padrão agora é português (o livro segue em inglês).

Ainda aberto:
- [ ] 🟠 **Validar a geração com os 16 estilos** (1 página por estilo) e ajustar prompt/amostra onde sair fora.
- [ ] 🟠 Páginas antigas do Short Fiction: gerar de novo no estilo novo.
- [ ] 🟢 Trocar estilo apaga as páginas da pessoa (decisão de produto). Se quiser guardar as antigas, é trabalho à parte.

## 4. Comunidade

- ✅ Emoji ao escrever post, comentário e edição.
- ✅ Marcar pessoas com @ (sugere enquanto digita; @ vira link no post).
- ✅ Notificação "mencionou você" + sino em tempo real. *Migração `20261112040000_mentions.sql` aplicada.*
- [ ] 🟠 Notificação fora do app (push no iOS / e-mail de resumo) não existe.
- [ ] 🟠 Moderação: há denúncia + painel admin, mas não há filtro automático de imagem/texto ofensivo. Mínimo: moderação da OpenAI nos posts com foto.
- [ ] 🟢 Editar post não notifica menções novas duas vezes (de propósito); confirmar se é o desejado.

## 5. Produto

- [ ] 🟠 Galeria tem só 2 livros. Montar o catálogo inicial (domínio público) com capa, categoria e estilo.
- [ ] 🟠 Teste de nivelamento (hoje todo mundo é A1).
- [ ] 🟠 Onboarding: primeiro acesso → escolher nível, objetivo, primeiro livro.
- [ ] 🟢 Textos que ainda aparecem só em inglês: revisar telas com o app em português.

## 6. Operação

- [ ] 🟠 Monitoramento de erros (Sentry ou similar) no front e nas Edge Functions. Hoje não há.
- [ ] 🟠 Analytics de produto (ativação, retenção, conversão).
- [ ] 🟠 Backup: confirmar plano do Supabase com PITR.
- [ ] 🟠 Testes automáticos: não há nenhum. Mínimo: fluxo de login, abrir livro, gerar página (mock), postar.
- [ ] 🟢 PWA pré-carrega 6,4 MB. Reduzir (fontes e workers sob demanda).

## Migrações desta fase

| Arquivo | O que faz | Status |
|---|---|---|
| `20261112040000_mentions.sql` | Menções, notificação "mencionou você", realtime do sino | aplicada |
| `20261112050000_hardening.sql` | Admin fora do visitante, limites do bucket de avatar | aplicada |
