// Termos de uso, política de privacidade, código de conduta e perguntas frequentes (rotas públicas).
// Texto-modelo inicial: recomenda-se revisão jurídica antes de uso comercial.
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { useAuth } from '@/contexts/AuthContext'

export type LegalDoc = 'terms' | 'privacy' | 'faq' | 'conduct'
type Block = { h: string; p: string[]; id?: string }

const UPDATED = '2026-11-23'

export const DOCS: Record<LegalDoc, { pt: { title: string; intro: string; blocks: Block[] }; en: { title: string; intro: string; blocks: Block[] } }> = {
  terms: {
    pt: {
      title: 'Termos de uso',
      intro: 'Ao criar uma conta ou usar o Upoonly, você concorda com estes termos. Se não concordar, não use o serviço.',
      blocks: [
        { h: '1. O serviço', p: ['O Upoonly é uma plataforma para aprender inglês lendo livros: leitura com áudio, vocabulário, prática de fala e ditado, ilustrações geradas por IA, galeria de livros, coleções e recursos de comunidade.'] },
        { h: '2. Sua conta, idade e data de nascimento', id: 'conta', p: ['Você é responsável pela sua conta e por manter sua senha segura. Avise-nos se suspeitar de uso indevido.', 'No cadastro pedimos sua data de nascimento. Ela serve para mostrar apenas os livros adequados à sua faixa etária e para aplicar as regras de proteção de crianças e adolescentes. Informar uma data falsa viola estes termos.', 'Menores de 18 anos devem usar o Upoonly com o conhecimento de um responsável. Para menores de 12 anos é necessário o consentimento específico de um responsável legal para o tratamento dos dados (LGPD, art. 14).'] },
        { h: '3. Faixa etária dos livros', id: 'faixa-etaria', p: ['Cada livro da galeria mostra uma faixa etária indicada, e ao passar o mouse sobre o selo você vê as outras faixas de referência usadas. Trata-se de uma orientação editorial do Upoonly, feita a partir de fontes públicas e do conteúdo da obra (temas, linguagem e violência). Não é uma classificação indicativa oficial do governo.', 'Livros acima da sua faixa etária não são exibidos. Responsáveis podem pedir ajustes pelo contato abaixo.'] },
        { h: '4. Livros que você envia (EPUB e PDF)', id: 'livros', p: ['Os EPUBs e PDFs que você envia ficam somente na sua biblioteca. Eles não vão para a galeria, não são compartilhados com a comunidade e não aparecem em coleções. De um PDF o Upoonly aproveita apenas o texto; imagens e figuras são ignoradas.', 'É proibido enviar EPUB ou PDF protegido pela lei de propriedade intelectual sem autorização de quem detém os direitos (por exemplo, livros comprados, cópias piratas ou materiais com DRM). Envie somente conteúdo de sua autoria, em domínio público ou que você tenha permissão para usar.', 'Ao salvar um livro você confirma, em uma caixa de seleção, que o conteúdo é de sua autoria, está em domínio público ou tem autorização para uso, e que você responde por essa declaração. Podemos remover conteúdo e suspender contas que violem esta regra.'] },
        { h: '5. Galeria, coleções e direitos autorais', id: 'galeria', p: ['A galeria reúne obras em domínio público. Antes de publicar, verificamos a obra, a tradução, as ilustrações, a capa e o arquivo da edição (por exemplo, edições do Standard Ebooks, que dedica suas contribuições ao domínio público, e do Project Gutenberg). Uma obra pode estar em domínio público em um país e não em outro: quando a situação é incerta, não publicamos.', 'Coleções agrupam livros que já estão na galeria, sem duplicá-los. O texto dos livros é o original; não o reescrevemos nem resumimos.', 'Se você é titular de direitos e acredita que algo na galeria viola seus direitos, escreva para o contato abaixo com a identificação da obra e do trecho; analisaremos e removeremos quando cabível.'] },
        { h: '6. Ilustrações geradas por IA', id: 'ilustracoes', p: ['Cada livro da galeria tem um estilo de ilustração padrão e um estilo padrão para o texto das legendas. As imagens geradas no estilo padrão são compartilhadas com todos os leitores do livro, e quem contribui ajuda a comunidade e ganha 5 pontos por página.', 'Você pode criar um estilo próprio na hora de ler. Nesse caso as imagens que você já gerou são zeradas e você começa uma coleção individual, que não é compartilhada com a comunidade. Alterações de estilo, de balões e de legendas valem só para você. Incentivamos que você ajude gerando imagens no estilo padrão.', 'As imagens são geradas por modelos de IA (OpenAI) e podem conter imprecisões. Cada geração nova consome créditos de IA do seu plano; páginas que a comunidade já gerou não consomem créditos.'] },
        { h: '6-A. Planos e créditos', id: 'planos', p: ['O Upoonly tem o plano Grátis e os planos pagos Essencial, Plus e Pro, com benefícios descritos na página de planos. A partir do Essencial, toda a biblioteca da galeria é liberada, assim como a importação de EPUB e PDF.', 'Cada plano inclui, por período, um saldo único de créditos de IA, usado em ilustrações, explicações, histórias, imagens e conversas por voz (1 crédito por minuto). Os créditos renovam a cada período, não acumulam para o período seguinte, não têm valor monetário e não são reembolsáveis separadamente. O custo de cada operação aparece no app.', 'No plano Grátis você ganha 1 livro da galeria de presente, que fica com você para sempre. A escolha é definitiva e não pode ser trocada. Os créditos do Grátis exigem e-mail confirmado.'] },
        { h: '6-B. Assinatura, cobrança e renovação automática', id: 'assinatura', p: [
          'Os planos pagos podem ser contratados no ciclo mensal ou anual, pagando com cartão de crédito ou Pix. A cobrança é feita pelo nosso parceiro de pagamentos (AbacatePay) e o plano só é liberado após a confirmação do pagamento. Preços em reais, com impostos inclusos, informados antes da contratação.',
          'Cartão de crédito: a cobrança é recorrente. Ao fim de cada ciclo a assinatura é renovada automaticamente no mesmo cartão, pelo mesmo plano e ciclo, até você cancelar. Avisamos por e-mail cada renovação. No ciclo anual, o valor do ano é cobrado de uma vez e pode ser parcelado em até 12 vezes; os juros da operadora são pagos por quem assina e o total aparece antes da confirmação. O parcelamento não muda o período contratado: o plano anual dá 12 meses de acesso.',
          'Pix Automático: no checkout você autoriza, no app do seu banco, a cobrança recorrente do Upoonly. A renovação acontece sozinha a cada ciclo, no mesmo valor e plano, até você cancelar. A autorização pode ser revogada no próprio banco; revogá-la sem cancelar a assinatura conta como falta de pagamento na cobrança seguinte.',
          'Quem assinou por Pix antes do Pix Automático continua pagando por fatura: alguns dias antes de cada vencimento enviamos por e-mail a fatura do ciclo seguinte, que aceita Pix ou cartão. Dá para trocar para a cobrança automática quando quiser, em Configurações > Assinatura, sem perder os dias já pagos.',
        ] },
        { h: '6-C. Troca de plano', id: 'troca-de-plano', p: [
          'Upgrade (para um plano maior): vale na hora. O valor dos dias que ainda restavam no plano atual é convertido em dias extras no novo plano, que começa um novo ciclo de cobrança.',
          'Downgrade (para um plano menor) ou troca de ciclo para um valor menor: vale a partir da próxima cobrança. Até lá você continua com o plano atual, sem reembolso proporcional.',
        ] },
        { h: '6-D. Cancelamento e direito de arrependimento', id: 'cancelamento', p: [
          'Você pode cancelar a qualquer momento em Configurações > Assinatura. O cancelamento interrompe as próximas cobranças e as próximas faturas e o acesso pago continua até o fim do período já pago; depois a conta volta para o Grátis. Não há multa nem fidelidade, e não há reembolso proporcional do período em curso, exceto no direito de arrependimento.',
          'Direito de arrependimento: em até 7 dias corridos da primeira contratação (ou da contratação de um novo plano depois de um período sem assinatura), você pode desistir e receber o valor pago de volta, integralmente, conforme o art. 49 do Código de Defesa do Consumidor. Peça pelo formulário de contato ou pelo e-mail da conta. O estorno é feito no mesmo meio de pagamento (no cartão, pode levar até duas faturas para aparecer; no parcelamento, as parcelas futuras são canceladas) e o acesso pago termina quando o estorno é processado.',
        ] },
        { h: '6-E. Falta de pagamento', id: 'inadimplencia', p: [
          'Se uma cobrança não for aprovada, ou se uma fatura do Pix vencer sem pagamento, você mantém o acesso por 3 dias para regularizar e recebe um aviso por e-mail. Depois disso, a conta volta para o Grátis. Seu progresso, notas e vocabulário são preservados; os livros da galeria (exceto o presente) ficam travados até uma nova assinatura.',
          'Contestações de pagamento (chargeback) encerram o acesso pago imediatamente. Menores de 18 anos só assinam com autorização de um responsável; menores de 12 não podem assinar.',
        ] },
        { h: '6-F. Conversas por voz, tutor e análise de perfil', id: 'conversa', p: ['Nas Cenas, na conversa livre e no Tutor de leitura, sua fala é transformada em texto no seu aparelho (ou pelo serviço de reconhecimento do navegador) e só o texto é enviado à IA. Não gravamos seu áudio. As notas e correções são orientações pedagógicas geradas por IA e podem conter imprecisões.', 'Cenas criadas por você passam por moderação automática e não podem envolver conteúdo sexual, discriminatório, violento ou imitar pessoas reais.'] },
        { h: '7. O que é compartilhado e o que é só seu', id: 'compartilhado', p: ['São compartilhados com a comunidade: textos de explicação gerados por IA, histórias, imagens do mosaico de vocabulário e imagens geradas no estilo padrão de livros da galeria.', 'Ficam somente com você: suas notas, seu progresso, suas configurações, os livros que você envia e as imagens em estilo próprio.'] },
        { h: '8. Comunidade', p: ['Ao usar a comunidade você aceita o Código de conduta (upoonly.com/conduta). Seja respeitoso. Não publique conteúdo ilegal, ofensivo ou que viole direitos de terceiros. Denúncias são analisadas e podemos remover conteúdo ou suspender contas. Seu perfil é privado até você torná-lo público.'] },
        { h: '9. Pontos e gamificação', p: ['Pontos, sequências e estrelas não têm valor monetário e podem ser ajustados para evitar abuso. Contribuições no estilo padrão podem render pontos conforme as regras vigentes.'] },
        { h: '10. Encerramento', p: ['Você pode excluir sua conta a qualquer momento nas Configurações. Podemos suspender contas que violem estes termos.'] },
        { h: '11. Responsabilidade', p: ['O serviço é oferecido "como está". Faremos o possível para mantê-lo disponível e seguro, mas não garantimos funcionamento ininterrupto nem a exatidão de conteúdo gerado por IA.'] },
        { h: '12. Alterações e lei aplicável', p: ['Podemos atualizar estes termos e avisaremos mudanças relevantes no app e por e-mail. Mudanças de preço só valem para o ciclo seguinte ao aviso. Aplica-se a lei brasileira, incluindo o Código de Defesa do Consumidor.'] },
        { h: '13. Contato', p: ['Dúvidas, pedidos de reembolso e reclamações: formulário em upoonly.com/contato ou contato@upoonly.com.'] },
      ],
    },
    en: {
      title: 'Terms of use',
      intro: 'By creating an account or using Upoonly, you agree to these terms. If you do not agree, do not use the service.',
      blocks: [
        { h: '1. The service', p: ['Upoonly is a platform to learn English by reading books: audio reading, vocabulary, speaking and dictation practice, AI-generated illustrations, a book gallery, collections and community features.'] },
        { h: '2. Your account, age and date of birth', id: 'conta', p: ['You are responsible for your account and for keeping your password safe. Tell us if you suspect misuse.', 'At sign-up we ask for your date of birth. It is used to show only books suitable for your age and to apply child-protection rules. Giving a false date breaks these terms.', 'Users under 18 must use Upoonly with a guardian’s knowledge. Under 12, a legal guardian’s specific consent to data processing is required.'] },
        { h: '3. Book age ratings', id: 'faixa-etaria', p: ['Each gallery book shows a suggested age; hover the badge to see the other reference ages. This is Upoonly’s editorial guidance, built from public sources and the work’s content (themes, language, violence). It is not an official government rating.', 'Books above your age range are not shown. Guardians can ask for adjustments via the contact below.'] },
        { h: '4. Books you upload (EPUB and PDF)', id: 'livros', p: ['EPUBs and PDFs you upload stay in your library only. They are not added to the gallery, not shared with the community and not placed in collections. From a PDF, Upoonly uses only the text; images and figures are ignored.', 'Uploading an EPUB or PDF protected by intellectual-property law without the rightsholder’s permission is forbidden (for example purchased books, pirated copies or DRM material). Upload only content you wrote, that is in the public domain, or that you are allowed to use.', 'When saving a book you confirm, in a checkbox, that the content is your own, in the public domain or authorized for use, and that you are responsible for this declaration. We may remove content and suspend accounts that break this rule.'] },
        { h: '5. Gallery, collections and copyright', id: 'galeria', p: ['The gallery contains public-domain works. Before publishing we check the work, the translation, the illustrations, the cover and the edition file (for example Standard Ebooks editions, whose contributions are dedicated to the public domain, and Project Gutenberg). A work can be public domain in one country and not in another: when the situation is unclear, we do not publish.', 'Collections group books already in the gallery without duplicating them. Book text is the original; we do not rewrite or summarize it.', 'If you hold rights and believe something in the gallery infringes them, write to the contact below identifying the work and passage; we will review and remove it when appropriate.'] },
        { h: '6. AI-generated illustrations', id: 'ilustracoes', p: ['Every gallery book has a default illustration style and a default caption text style. Images generated in the default style are shared with all readers of the book, and contributors help the community and earn 5 points per page.', 'You can create your own style while reading. When you do, the images you generated are cleared and you start an individual collection that is not shared with the community. Changes to style, balloons and captions apply only to you. We encourage you to help by generating images in the default style.', 'Images are generated by AI models (OpenAI) and may contain inaccuracies. Each new generation uses AI credits from your plan; pages the community already generated are free.'] },
        { h: '6-A. Plans and credits', id: 'planos', p: ['Upoonly has a Free plan and the paid plans Essencial, Plus and Pro. From Essencial up, the whole gallery and EPUB/PDF import are unlocked.', 'Each plan includes a single balance of AI credits per period. Credits renew every period, do not roll over, have no monetary value and are not refundable separately.', 'On Free you get 1 gallery book as a gift, forever. The choice is final.'] },
        { h: '6-B. Subscription, billing and automatic renewal', id: 'assinatura', p: ['Paid plans are available monthly or yearly, by credit card or Pix, billed by our payment partner (AbacatePay). Plans unlock once payment is confirmed. Prices are in BRL, taxes included.', 'Credit card: billing is recurring and renews automatically each cycle until you cancel. Yearly is charged in full once and may be split into up to 12 installments; interest is paid by the subscriber and the total is shown before you confirm. Installments do not change the 12-month access period.', 'Pix Automático: at checkout you authorise the recurring charge in your bank app, and renewals happen on their own each cycle until you cancel. Revoking that authorisation at the bank without cancelling counts as non-payment at the next charge. Subscriptions created by invoice before Pix Automático keep being invoiced each cycle, by email, payable by Pix or card.'] },
        { h: '6-C. Changing plans', id: 'troca-de-plano', p: ['Upgrades apply immediately: the value of the days left on your current plan becomes extra days on the new plan, which starts a new billing cycle.', 'Downgrades apply from the next charge; until then you keep your current plan, with no prorated refund.'] },
        { h: '6-D. Cancellation and right of withdrawal', id: 'cancelamento', p: ['Cancel any time in Settings > Subscription. Future charges stop and paid access continues until the end of the paid period, then the account returns to Free. No fees, no lock-in, no prorated refunds except for the right of withdrawal.', 'Right of withdrawal: within 7 calendar days of your first purchase (or of a new purchase after a period without a subscription) you can cancel and get a full refund, under article 49 of the Brazilian Consumer Defense Code. Ask through the contact form or from your account email. Refunds go back to the original payment method; future installments are cancelled; paid access ends when the refund is processed.'] },
        { h: '6-E. Non-payment', id: 'inadimplencia', p: ['If a charge fails, or a Pix invoice goes unpaid past its due date, you keep access for 3 days and we email you. After that the account returns to Free; progress, notes and vocabulary are kept and gallery books (except your gift) lock until you subscribe again.', 'Chargebacks end paid access immediately. Under-18s need a guardian’s permission to subscribe; under-12s cannot subscribe.'] },
        { h: '6-F. Voice conversations, tutor and profile analysis', id: 'conversa', p: ['Your speech is turned into text on your device (or by your browser’s speech service) and only the text is sent to the AI. We do not record your audio. Scores and corrections are AI-generated guidance and may be inaccurate.', 'Scenes you create are moderated and cannot involve sexual, hateful or violent content or impersonate real people.'] },
        { h: '7. What is shared and what is yours alone', id: 'compartilhado', p: ['Shared with the community: AI-generated explanation texts, stories, vocabulary mosaic images and images generated in the default style of gallery books.', 'Yours alone: your notes, progress, settings, the books you upload and images in your own style.'] },
        { h: '8. Community', p: ['Using the community means accepting the Code of conduct (upoonly.com/conduta). Be respectful. Do not post illegal or offensive content or content that infringes others’ rights. Reports are reviewed and we may remove content or suspend accounts. Your profile is private until you make it public.'] },
        { h: '9. Points', p: ['Points, streaks and stars have no monetary value and may be adjusted to prevent abuse. Contributions in the default style may earn points under the current rules.'] },
        { h: '10. Termination', p: ['You can delete your account at any time in Settings. We may suspend accounts that break these terms.'] },
        { h: '11. Liability', p: ['The service is provided "as is". We do our best to keep it available and safe but do not guarantee uninterrupted operation or the accuracy of AI-generated content.'] },
        { h: '12. Changes and governing law', p: ['We may update these terms and will announce relevant changes in the app and by email. Price changes only apply from the cycle after the notice. Brazilian law applies, including the Consumer Defense Code.'] },
        { h: '13. Contact', p: ['Questions, refund requests and complaints: upoonly.com/contato or contato@upoonly.com.'] },
      ],
    },
  },
  privacy: {
    pt: {
      title: 'Política de privacidade',
      intro: 'Explicamos quais dados pessoais tratamos, por que, com quem compartilhamos e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD).',
      blocks: [
        { h: 'Quem é o controlador', p: ['O Upoonly é o controlador dos dados pessoais tratados na plataforma. O canal do encarregado (DPO) para assuntos de privacidade está no fim desta página.'] },
        { h: 'Dados que coletamos', p: ['Conta: e-mail, nome, foto (opcional), data de nascimento e data de aceite dos termos.', 'Estudo: livros que você envia, páginas lidas, vocabulário, notas, sessões de prática, transcrições das conversas por voz, pontos e tempo de estudo.', 'Perfil e comunidade (opcional): nome de usuário, bio, publicações, comentários, avaliações e o que você escolher mostrar.', 'Assinatura: plano, ciclo, valores, datas, status das cobranças e recibos. Não guardamos número de cartão nem dados bancários.', 'Contato: nome, e-mail, assunto e mensagem enviados pelo formulário, e o endereço IP usado para evitar abuso.', 'Técnicos: registros de acesso e de erros (data, hora, IP, aparelho), mantidos por segurança.'] },
        { h: 'Para que usamos e com qual base legal', p: ['Execução do contrato (LGPD, art. 7º, V): criar e manter sua conta, salvar e sincronizar seu progresso, gerar conteúdo com IA quando você pede, cobrar a assinatura, emitir recibos e enviar e-mails transacionais (confirmação, renovação, falha de pagamento, cancelamento).', 'Cumprimento de obrigação legal (art. 7º, II): guardar registros de pagamento e documentos fiscais e registros de acesso pelo prazo exigido em lei (Marco Civil da Internet, art. 15).', 'Legítimo interesse (art. 7º, IX): segurança, prevenção de fraude e abuso, moderação da comunidade e melhoria do serviço, sempre com o mínimo de dados necessário.', 'Consentimento (art. 7º, I e art. 14): perfil público, contribuições compartilhadas e, para menores de 12 anos, o consentimento do responsável legal. Você pode revogar o consentimento a qualquer momento.', 'A data de nascimento serve para mostrar livros adequados à faixa etária e aplicar as regras de proteção de crianças e adolescentes. Não vendemos seus dados e não os usamos para publicidade.'] },
        { h: 'Crianças e adolescentes', p: ['Menores de 12 anos só se cadastram com o consentimento específico e em destaque de um responsável legal (LGPD, art. 14, § 1º). Coletamos apenas o necessário para o estudo e não exibimos o perfil de crianças publicamente.', 'Menores de 18 anos devem usar o app com ciência dos responsáveis. Menores de 18 só assinam com autorização de um responsável, e menores de 12 não podem assinar. Responsáveis podem pedir acesso, revisão ou exclusão dos dados pelo contato abaixo.'] },
        { h: 'Com quem compartilhamos (operadores)', p: ['Compartilhamos dados apenas com operadores que nos ajudam a prestar o serviço, cada um com o mínimo necessário:', 'Supabase: banco de dados, autenticação, armazenamento de arquivos e funções do servidor.', 'Vercel: hospedagem do site e do app.', 'AbacatePay: processamento das cobranças (cartão, parcelamento e Pix Automático). Os dados de pagamento ficam com ela; recebemos apenas status, valores e datas.', 'Resend: envio dos e-mails transacionais e das respostas ao formulário de contato.', 'Provedores de IA (Google Gemini, OpenAI e ElevenLabs): recebem os textos que você pede para explicar, as páginas a ilustrar, as transcrições das conversas e o texto a narrar, para gerar a resposta. Não enviamos seu nome nem seu e-mail a eles e não guardamos o áudio da sua voz.', 'Também podemos compartilhar dados com autoridades quando a lei exigir.'] },
        { h: 'Transferência internacional', p: ['Alguns operadores (como Supabase, Vercel, Resend e os provedores de IA) processam dados fora do Brasil, principalmente nos Estados Unidos. Essas transferências seguem o art. 33 da LGPD, com cláusulas contratuais e medidas de segurança dos próprios operadores.'] },
        { h: 'Seus livros enviados', p: ['EPUBs e PDFs que você envia ficam apenas na sua biblioteca. Não são publicados na galeria, nem compartilhados com a comunidade ou com outros usuários. De PDFs usamos só o texto. Ao salvar, registramos a sua declaração de que o conteúdo é seu, de domínio público ou autorizado.'] },
        { h: 'O que fica público', p: ['Seu perfil é privado por padrão. Se você o tornar público, outras pessoas veem o que você escolheu mostrar (estatísticas, livros da galeria, versões compartilhadas, publicações e avaliações).', 'Explicações, histórias, imagens do mosaico e imagens geradas no estilo padrão de livros da galeria são compartilhadas com a comunidade sem identificar você. Notas e imagens em estilo próprio não são.'] },
        { h: 'Voz e microfone', p: ['As vozes de leitura no aparelho e o reconhecimento de fala rodam localmente sempre que possível. O áudio da prática de fala não é enviado ao servidor; nas conversas, só a transcrição em texto.'] },
        { h: 'Seus direitos', p: ['Pelo art. 18 da LGPD, você pode: confirmar se tratamos seus dados; acessá-los; corrigir dados incompletos ou desatualizados; pedir anonimização, bloqueio ou eliminação de dados desnecessários; pedir a portabilidade; saber com quem compartilhamos; revogar o consentimento; e se opor a tratamentos baseados em legítimo interesse.', 'Muitos desses pedidos podem ser feitos nas Configurações (exportar e excluir a conta). Os demais, pelo formulário de contato (assunto Privacidade e dados). Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).'] },
        { h: 'Retenção', p: ['Mantemos os dados da conta enquanto ela existir. Ao excluir a conta, apagamos os dados pessoais em até 30 dias; imagens já compartilhadas na galeria podem permanecer sem identificação.', 'Registros de pagamento e documentos fiscais são guardados pelo prazo legal (até 5 anos). Registros de acesso, por 6 meses. Mensagens do formulário de contato, por até 2 anos.'] },
        { h: 'Segurança', p: ['Usamos criptografia em trânsito, controle de acesso por usuário no banco de dados (RLS) e acesso restrito às chaves de serviço. Em caso de incidente de segurança que possa causar risco relevante, avisaremos você e a ANPD.'] },
        { h: 'Cookies e armazenamento local', p: ['Usamos o armazenamento do navegador apenas para manter você conectado e guardar preferências (idioma, tema, voz). Não usamos cookies de publicidade.'] },
        { h: 'Contato e encarregado (DPO)', p: ['Dúvidas sobre privacidade, pedidos de titulares e de responsáveis: formulário em upoonly.com/contato (assunto Privacidade e dados) ou contato@upoonly.com.'] },
      ],
    },
    en: {
      title: 'Privacy policy',
      intro: 'What personal data we process, why, who we share it with and how to exercise your rights under Brazil’s General Data Protection Law (LGPD).',
      blocks: [
        { h: 'Data we collect', p: ['Account: email, name, optional photo, date of birth and terms acceptance date.', 'Study: books you upload, pages read, vocabulary, notes, practice sessions, voice conversation transcripts, points and study time.', 'Profile and community (optional): username, bio, posts, comments and ratings.', 'Subscription: plan, cycle, amounts, dates, charge status and receipts. We never store card numbers or bank details.', 'Contact: name, email, subject and message sent through the form, plus the IP address used to prevent abuse.', 'Technical: access and error logs kept for security.'] },
        { h: 'Purposes and legal bases', p: ['Contract performance: running your account, syncing progress, generating AI content on request, billing, receipts and transactional emails.', 'Legal obligation: payment and tax records and access logs for the legally required period.', 'Legitimate interest: security, fraud and abuse prevention, community moderation and service improvement.', 'Consent: public profile, shared contributions and, for under-12s, a legal guardian’s consent. You can withdraw consent at any time. We do not sell your data or use it for advertising.'] },
        { h: 'Children and teens', p: ['Under-12s can only sign up with a legal guardian’s specific consent. Under-18s should use the app with a guardian’s knowledge; under-18s need a guardian’s permission to subscribe and under-12s cannot subscribe. Guardians can request access, review or deletion via the contact below.'] },
        { h: 'Who we share data with (processors)', p: ['Supabase (database, auth, storage, server functions), Vercel (hosting), AbacatePay (card, installments and Pix Automático billing; payment data stays with them), Resend (emails) and AI providers (Google Gemini, OpenAI, ElevenLabs), which receive only the text needed to generate a response, never your name or email. We may also share data with authorities when required by law.'] },
        { h: 'International transfers', p: ['Some processors handle data outside Brazil, mainly in the United States, under LGPD article 33 safeguards.'] },
        { h: 'Books you upload', p: ['EPUBs and PDFs you upload stay in your library only and are never published or shared.'] },
        { h: 'What is public', p: ['Your profile is private by default. If you make it public, others see only what you choose to show. Default-style images and AI texts for gallery books are shared without identifying you.'] },
        { h: 'Your rights', p: ['You can confirm processing, access, correct, anonymize, block or delete data, request portability, learn who we share with, withdraw consent and object to legitimate-interest processing. Use Settings or the contact form; we reply within 15 days. You may also complain to Brazil’s data protection authority (ANPD).'] },
        { h: 'Retention and security', p: ['Account data is kept while the account exists and erased within 30 days of deletion. Payment and tax records are kept for up to 5 years, access logs for 6 months and contact messages for up to 2 years. We use encryption in transit, row-level security and restricted service keys, and will notify you and the ANPD of any relevant security incident.'] },
        { h: 'Contact and DPO', p: ['Privacy questions and requests from data subjects and guardians: upoonly.com/contato or contato@upoonly.com.'] },
      ],
    },
  },
  faq: {
    pt: {
      title: 'Perguntas frequentes',
      intro: 'Respostas rápidas sobre como o Upoonly funciona.',
      blocks: [
        { id: 'pagar', h: 'Preciso pagar para usar?', p: ['Não. No plano Grátis você lê com áudio, salva vocabulário, pratica, ganha 1 livro da galeria de presente e créditos de IA para experimentar. Nos planos Essencial, Plus e Pro você libera a biblioteca inteira, importa EPUB/PDF e ganha mais créditos, conversas por voz e o tutor.'] },
        { id: 'creditos', h: 'O que são créditos de IA?', p: ['É o saldo mensal para gerar coisas novas com IA: página ilustrada = 10 créditos; explicação, história ou imagem do mosaico = 1. O que a comunidade já gerou é grátis. Os créditos renovam a cada período e não acumulam. O saldo fica sempre visível na barra lateral.'] },
        { id: 'presente', h: 'Como funciona o livro-presente?', p: ['No Grátis você escolhe 1 livro da galeria e ele é seu para sempre. A escolha é definitiva. Os outros livros aparecem com o selo Premium: dá para ver e ler a amostra.'] },
        { id: 'pix', h: 'Posso pagar com Pix?', p: ['Pode, no mensal e no anual, com Pix Automático. No checkout você autoriza a cobrança no app do seu banco e a assinatura renova sozinha a cada ciclo, sem você precisar fazer nada. Para parar, é só cancelar em Configurações > Assinatura (ou revogar a autorização no banco).', 'Quem assinou por Pix antes disso continua recebendo a fatura por e-mail antes de cada vencimento, e pode mudar para a cobrança automática quando quiser.'] },
        { id: 'cancelar', h: 'Como cancelo ou troco de plano?', p: ['Para cancelar, entre no app e vá em Configurações > Assinatura. O link para cancelar fica no fim da página. O cancelamento interrompe as próximas cobranças e você continua com o plano até o fim do período já pago; depois a conta volta para o Grátis, com seu progresso guardado.', 'Para trocar de plano, use a mesma página. Upgrade vale na hora e os dias que restavam viram dias extras no plano novo. Downgrade vale a partir da próxima cobrança.', 'Arrependeu-se? Até 7 dias da primeira contratação você pode pedir o reembolso integral pelo formulário de contato (Código de Defesa do Consumidor, art. 49).'] },
        { id: 'conversar', h: 'Como funcionam as conversas por voz?', p: ['Em Conversar você escolhe uma Cena (aeroporto, cafeteria, entrevista…) e fala com o personagem. No fim recebe nota de 0 a 100 e correções. No Plus e no Pro há o tutor de leitura, a conversa livre e as cenas que você cria. A conversa usa 1 crédito de IA por minuto.'] },
        { id: 'status', h: 'O que são Aprendi, Revisar e Importante?', p: ['É como a palavra está para você. Revisar coloca a palavra na sua revisão; Aprendi tira da revisão e soma pontos; Importante destaca a palavra na lista para você voltar nela primeiro.'] },
        { id: 'explicacao', h: 'O que vem na explicação de uma palavra?', p: ['Um clique em Explicar com IA traz o significado, uma dica de uso, exemplos nas formas afirmativa, negativa e pergunta e uma pequena história usando a palavra.'] },
        { id: 'traducao', h: 'Por que só às vezes aparece o olho de tradução?', p: ['Tudo vem em inglês para você pensar no idioma. No nível Iniciante aparece o olho: ele troca o significado, a dica e a história para o português. Ao subir de nível, o olho some para incentivar a leitura direta.'] },
        { id: 'nivel', h: 'Como meu nível (Iniciante, Aprendiz…) é calculado?', p: ['Pelas palavras que você salva e pelos pontos que ganha estudando. Ao atingir as metas de um nível, você passa para o próximo.'] },
        { id: 'livros-privados', h: 'Os livros que eu envio ficam públicos?', p: ['Não. EPUBs e textos que você envia ficam só na sua conta.'] },
        { id: 'galeria', h: 'O que é a galeria?', p: ['Uma coleção de livros de domínio público prontos para estudar. As imagens de uma página geradas por um leitor ficam disponíveis para todos, se alguém já gerou a página, você não precisa gerar de novo.'] },
        { id: 'estilo', h: 'Como funciona o estilo das imagens?', p: ['Cada livro da galeria já vem com um estilo de ilustração padrão e um estilo de legenda. As imagens geradas no estilo padrão são compartilhadas com todos os leitores do livro e cada página contribuída vale 5 pontos.', 'Se você quiser um estilo próprio, troque na hora de ler: suas imagens daquele livro são zeradas e você começa uma coleção individual, que não é compartilhada com a comunidade.'] },
        { id: 'quadrinhos', h: 'Posso ter os quadrinhos do meu jeito?', p: ['Sim. Você pode mover e editar os balões só para você, ou trocar o estilo e gerar de novo. Se quiser, compartilhe sua versão; outros leitores podem usá-la e dar estrelas.'] },
        { id: 'notas', h: 'Como funcionam as notas?', p: ['No leitor, escolha o modo Nota e clique em qualquer palavra ou ponto do quadrinho. Suas notas ficam marcadas com um pin e reunidas na página Notas.'] },
        { id: 'perfil', h: 'Meu perfil é público?', p: ['Só se você quiser. Por padrão ele é privado; você escolhe o que mostrar em Configurações → Perfil.'] },
        { id: 'excluir-conta', h: 'Como excluo minha conta?', p: ['Escreva pelo formulário de contato (upoonly.com/contato) ou para contato@upoonly.com, usando o e-mail da conta, e apagamos seus dados pessoais.'] },
        { id: 'contato', h: 'Como falo com a equipe?', p: ['Pelo formulário em upoonly.com/contato. Você recebe uma confirmação por e-mail e respondemos em até 2 dias úteis.'] },
      ],
    },
    en: {
      title: 'Frequently asked questions',
      intro: 'Quick answers about how Upoonly works.',
      blocks: [
        { id: 'pagar', h: 'Is it free?', p: ['Yes. The Free plan includes audio reading, vocabulary, practice, 1 gift book and AI credits to try. Paid plans unlock the whole library, EPUB/PDF import, more credits, voice conversations and the tutor.'] },
        { id: 'creditos', h: 'What are AI credits?', p: ['Your monthly balance to generate new things with AI: illustrated page = 10 credits; explanation, story or mosaic image = 1. Community content is free. Credits renew each period and do not roll over.'] },
        { id: 'pix', h: 'Can I pay with Pix?', p: ['Yes, monthly or yearly, with Pix Automático: you authorise the recurring charge in your bank app at checkout and renewals happen on their own. To stop, cancel in Settings > Subscription or revoke the authorisation at your bank.'] },
        { id: 'cancelar', h: 'How do I cancel or change plans?', p: ['In the app, go to Settings > Subscription; the cancel link is at the bottom of the page. Future charges stop and you keep your plan until the end of the paid period.', 'Change plans on the same page: upgrades apply immediately and leftover days become extra days; downgrades apply from the next charge.', 'Changed your mind? Within 7 days of your first purchase you can request a full refund through the contact form.'] },
        { id: 'status', h: 'What do Learned, Review and Important mean?', p: ['How the word is for you. Review adds it to your review; Learned removes it and earns points; Important highlights it so you come back to it first.'] },
        { id: 'explicacao', h: 'What comes in a word explanation?', p: ['Explain with AI brings the meaning, a usage tip, affirmative, negative and question examples and a short story using the word.'] },
        { id: 'traducao', h: 'Why does the translation eye only appear sometimes?', p: ['Everything comes in English so you think in the language. At the Beginner level an eye switches the meaning, tip and story to your language; it goes away as you level up.'] },
        { id: 'nivel', h: 'How is my level (Beginner, Apprentice…) calculated?', p: ['From the words you save and the points you earn studying.'] },
        { id: 'livros-privados', h: 'Are my uploaded books public?', p: ['No. EPUBs and texts you upload stay in your account only.'] },
        { id: 'galeria', h: 'What is the gallery?', p: ['A collection of public-domain books ready to study. Page images generated by one reader are available to everyone.'] },
        { id: 'estilo', h: 'How does the image style work?', p: ['Every gallery book comes with a default illustration style and caption style. Images generated in the default style are shared with all readers of the book, and each contributed page is worth 5 points.', 'If you want your own style, switch it while reading: your images for that book are cleared and you start an individual collection that is not shared with the community.'] },
        { id: 'quadrinhos', h: 'Can I have comics my own way?', p: ['Yes. Edit balloons just for you, or change the style and generate again, and share your version if you like.'] },
        { id: 'notas', h: 'How do notes work?', p: ['In the reader, choose Note mode and click any word or comic spot. Notes show as pins and are gathered on the Notes page.'] },
        { id: 'perfil', h: 'Is my profile public?', p: ['Only if you want. It is private by default.'] },
        { id: 'excluir-conta', h: 'How do I delete my account?', p: ['Use the contact form (upoonly.com/contato) or email contato@upoonly.com from your account address and we delete your personal data.'] },
        { id: 'contato', h: 'How do I reach the team?', p: ['Through the form at upoonly.com/contato. You get an email confirmation and we reply within 2 business days.'] },
      ],
    },
  },
  conduct: {
    pt: {
      title: 'Código de conduta',
      intro: 'A comunidade do Upoonly reúne pessoas de todas as idades aprendendo inglês com livros. Estas regras valem para publicações, comentários, perfis, avaliações e imagens compartilhadas.',
      blocks: [
        { h: '1. Respeito acima de tudo', p: ['Trate todos com gentileza. Correções de inglês são bem-vindas quando feitas com cuidado; zombar do nível de alguém não é.', 'Discorde de ideias, não de pessoas. Não ataque, ridicularize nem persiga outros membros.'] },
        { h: '2. O que não é permitido', p: ['Discurso de ódio ou discriminação por raça, etnia, religião, origem, gênero, orientação sexual, deficiência ou idade.', 'Assédio, ameaças, intimidação, perseguição ou exposição de dados pessoais de outras pessoas (endereço, telefone, documentos, fotos sem autorização).', 'Conteúdo sexual, sexualização de qualquer pessoa e qualquer conteúdo envolvendo menores de forma imprópria. Lembre que há crianças e adolescentes na comunidade.', 'Violência gráfica, incentivo a automutilação, a suicídio ou a atividades ilegais.', 'Spam, propaganda não autorizada, golpes, links maliciosos e pedidos de dinheiro.', 'Conteúdo que viole direitos autorais, como trechos longos de livros protegidos ou imagens de terceiros sem permissão.', 'Fingir ser outra pessoa, a equipe do Upoonly ou uma instituição.', 'Usar a IA para gerar conteúdo que quebre estas regras.'] },
        { h: '3. Publicações e comentários', p: ['Publique sobre leitura, inglês e os livros da galeria. Mantenha o assunto do tópico e evite mensagens repetidas.', 'Spoilers de livros devem ser avisados no início da publicação.'] },
        { h: '4. Perfis', p: ['Nome de usuário, foto e bio devem seguir estas mesmas regras. Não use dados pessoais sensíveis nem os de outras pessoas.', 'Menores de 18 anos: evitem compartilhar nome completo, escola, cidade ou fotos pessoais.'] },
        { h: '5. Como denunciar', p: ['Use a opção Denunciar disponível em publicações, comentários e perfis. Também é possível escrever pelo formulário de contato com o assunto Denúncia, incluindo o link do conteúdo.', 'Denúncias são confidenciais: a pessoa denunciada não sabe quem denunciou. Analisamos cada caso e priorizamos os que envolvem crianças, ameaças ou exposição de dados.', 'Em caso de risco imediato a alguém, procure também as autoridades (190) ou, para crimes contra crianças, o Disque 100.'] },
        { h: '6. Sanções', p: ['Conforme a gravidade e a repetição, podemos: remover o conteúdo; enviar um aviso; restringir temporariamente publicações e comentários; suspender a conta; ou encerrá-la definitivamente.', 'Casos graves (exploração de menores, ameaças reais, golpes) levam ao encerramento imediato e podem ser comunicados às autoridades. Encerrar uma conta por violação não gera reembolso do período em curso, ressalvados os direitos previstos em lei.'] },
        { h: '7. Revisão de decisões', p: ['Se achar que uma remoção ou sanção foi um engano, escreva pelo formulário de contato em até 30 dias. Uma pessoa da equipe revisa o caso e responde.'] },
        { h: '8. Alterações', p: ['Podemos atualizar este código e avisaremos mudanças relevantes no app. Ele complementa os Termos de uso.'] },
      ],
    },
    en: {
      title: 'Code of conduct',
      intro: 'Upoonly’s community brings together people of all ages learning English through books. These rules apply to posts, comments, profiles, ratings and shared images.',
      blocks: [
        { h: '1. Respect first', p: ['Be kind. English corrections are welcome when made with care; mocking someone’s level is not. Disagree with ideas, not people.'] },
        { h: '2. Not allowed', p: ['Hate speech or discrimination; harassment, threats or sharing others’ personal data; sexual content or anything inappropriate involving minors; graphic violence or encouraging self-harm or illegal acts; spam, scams and malicious links; copyright infringement; impersonation; using AI to create content that breaks these rules.'] },
        { h: '3. Posts and comments', p: ['Post about reading, English and gallery books. Stay on topic and flag spoilers at the top.'] },
        { h: '4. Profiles', p: ['Usernames, photos and bios follow the same rules. Under-18s should avoid sharing full name, school, city or personal photos.'] },
        { h: '5. Reporting', p: ['Use Report on posts, comments and profiles, or the contact form with the subject Denúncia and a link. Reports are confidential. If someone is in immediate danger, also contact local authorities.'] },
        { h: '6. Sanctions', p: ['Depending on severity and repetition: content removal, warning, temporary restriction, suspension or permanent termination. Severe cases lead to immediate termination and may be reported to authorities.'] },
        { h: '7. Appeals', p: ['If you think a decision was a mistake, write through the contact form within 30 days and a person on the team will review it.'] },
        { h: '8. Changes', p: ['We may update this code and will announce relevant changes in the app. It complements the Terms of use.'] },
      ],
    },
  },
}

/** Só caminhos do próprio app ("/algo"), nunca "//outro-site" ou URLs completas. */
function internalPath(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null
}

/** Página de outro site que trouxe a pessoa até aqui (ex.: a landing), se houver. */
function externalReferrer(): string | null {
  try {
    if (!document.referrer) return null
    const ref = new URL(document.referrer)
    return ref.origin !== window.location.origin && /^https?:$/.test(ref.protocol) ? ref.href : null
  } catch { return null }
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const pt = useLanguage().locale === 'pt-BR'
  const navigate = useNavigate()
  const { session } = useAuth()
  const d = DOCS[doc][pt ? 'pt' : 'en']
  const location = useLocation()
  const hash = location.hash.slice(1)
  useEffect(() => { if (hash) document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [hash])
  const links: [LegalDoc, string][] = [['terms', pt ? 'Termos' : 'Terms'], ['privacy', pt ? 'Privacidade' : 'Privacy'], ['conduct', pt ? 'Conduta' : 'Conduct'], ['faq', 'FAQ']]

  // Destino fixo em vez de "voltar no histórico": o histórico falha em nova aba e ao alternar entre Termos/Privacidade/FAQ.
  const params = new URLSearchParams(location.search)
  const back = internalPath(params.get('back')) ?? internalPath((location.state as { from?: string } | null)?.from ?? null)
  const site = back ? null : externalReferrer()
  const openedInNewTab = params.get('tab') === '1'
  const carry = (() => {
    const keep = new URLSearchParams()
    if (back) keep.set('back', back)
    if (openedInNewTab) keep.set('tab', '1')
    const q = keep.toString()
    return q ? `?${q}` : ''
  })()
  const goBack = () => {
    if (site) { window.location.href = site; return }
    const dest = back ?? (session ? '/' : '/login')
    // Aberta em nova aba a partir do cadastro: fechar a aba devolve a pessoa ao formulário preenchido.
    if (openedInNewTab && window.history.length <= 1) {
      window.close()
      window.setTimeout(() => navigate(dest, { replace: true }), 150)
      return
    }
    navigate(dest, { replace: true })
  }
  const backLabel = site ? (pt ? 'Voltar ao site' : 'Back to site') : (pt ? 'Voltar' : 'Back')
  return (
    <div className="min-h-dvh px-5 py-10" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-3 mb-10">
          <button type="button" onClick={goBack}
            className="inline-flex items-center gap-1.5 h-8 px-2 -ml-2 rounded-md text-[13.5px] hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-text-secondary)' }}>
            <ArrowLeft className="w-4 h-4" />{backLabel}
          </button>
          <nav className="flex gap-1">
            {links.map(([id, label]) => (
              <Link key={id} to={`/${id === 'conduct' ? 'conduta' : id}${carry}`} replace state={location.state} className="h-8 px-2.5 inline-flex items-center rounded-md text-[13px]"
                style={{ backgroundColor: id === doc ? 'var(--theme-nav-active)' : undefined, color: id === doc ? 'var(--theme-text)' : 'var(--theme-text-secondary)' }}>{label}</Link>
            ))}
          </nav>
        </div>
        <h1 className="font-display text-[38px] leading-tight">{d.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>{d.intro}</p>
        {doc !== 'faq' && <p className="mt-2 text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Atualizado em' : 'Updated'} {new Date(`${UPDATED}T12:00:00`).toLocaleDateString(pt ? 'pt-BR' : 'en-US')}</p>}
        <div className="mt-10 space-y-8">
          {d.blocks.map(b => doc === 'faq' ? (
            <details key={b.h} id={b.id} open={!!b.id && hash === b.id} className="group scroll-mt-6 rounded-xl border px-5 py-4 transition-colors open:bg-[var(--ui-hover)] target:ring-2 target:ring-[var(--ui-focus)]" style={{ borderColor: 'var(--theme-border)' }}>
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-[15px] font-medium">
                {b.h}<span className="text-[18px] transition-transform group-open:rotate-45" style={{ color: 'var(--theme-text-secondary)' }}>+</span>
              </summary>
              {b.p.map((t, i) => <p key={i} className="mt-2 text-[14.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>{t}</p>)}
            </details>
          ) : (
            <section key={b.h} id={b.id} className="scroll-mt-6">
              <h2 className="text-[16px] font-semibold">{b.h}</h2>
              {b.p.map((t, i) => <p key={i} className="mt-2 text-[14.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>{t}</p>)}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
