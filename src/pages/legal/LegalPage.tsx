// Termos de uso, política de privacidade e perguntas frequentes (rotas públicas).
// Texto-modelo inicial: recomenda-se revisão jurídica antes de uso comercial.
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { useAuth } from '@/contexts/AuthContext'

export type LegalDoc = 'terms' | 'privacy' | 'faq'
type Block = { h: string; p: string[]; id?: string }

const UPDATED = '2026-11-15'

const DOCS: Record<LegalDoc, { pt: { title: string; intro: string; blocks: Block[] }; en: { title: string; intro: string; blocks: Block[] } }> = {
  terms: {
    pt: {
      title: 'Termos de uso',
      intro: 'Ao criar uma conta ou usar o Bookmoo, você concorda com estes termos. Se não concordar, não use o serviço.',
      blocks: [
        { h: '1. O serviço', p: ['O Bookmoo é uma plataforma para aprender inglês lendo livros: leitura com áudio, vocabulário, prática de fala e ditado, ilustrações geradas por IA, galeria de livros, coleções e recursos de comunidade.'] },
        { h: '2. Sua conta, idade e data de nascimento', id: 'conta', p: ['Você é responsável pela sua conta e por manter sua senha segura. Avise-nos se suspeitar de uso indevido.', 'No cadastro pedimos sua data de nascimento. Ela serve para mostrar apenas os livros adequados à sua faixa etária e para aplicar as regras de proteção de crianças e adolescentes. Informar uma data falsa viola estes termos.', 'Menores de 18 anos devem usar o Bookmoo com o conhecimento de um responsável. Para menores de 12 anos é necessário o consentimento específico de um responsável legal para o tratamento dos dados (LGPD, art. 14).'] },
        { h: '3. Faixa etária dos livros', id: 'faixa-etaria', p: ['Cada livro da galeria mostra uma faixa etária indicada, e ao passar o mouse sobre o selo você vê as outras faixas de referência usadas. Trata-se de uma orientação editorial do Bookmoo, feita a partir de fontes públicas e do conteúdo da obra (temas, linguagem e violência). Não é uma classificação indicativa oficial do governo.', 'Livros acima da sua faixa etária não são exibidos. Responsáveis podem pedir ajustes pelo contato abaixo.'] },
        { h: '4. Livros que você envia (EPUB e PDF)', id: 'livros', p: ['Os EPUBs e PDFs que você envia ficam somente na sua biblioteca. Eles não vão para a galeria, não são compartilhados com a comunidade e não aparecem em coleções. De um PDF o Bookmoo aproveita apenas o texto; imagens e figuras são ignoradas.', 'É proibido enviar EPUB ou PDF protegido pela lei de propriedade intelectual sem autorização de quem detém os direitos (por exemplo, livros comprados, cópias piratas ou materiais com DRM). Envie somente conteúdo de sua autoria, em domínio público ou que você tenha permissão para usar.', 'Ao salvar um livro você confirma, em uma caixa de seleção, que o conteúdo é de sua autoria, está em domínio público ou tem autorização para uso, e que você responde por essa declaração. Podemos remover conteúdo e suspender contas que violem esta regra.'] },
        { h: '5. Galeria, coleções e direitos autorais', id: 'galeria', p: ['A galeria reúne obras em domínio público. Antes de publicar, verificamos a obra, a tradução, as ilustrações, a capa e o arquivo da edição (por exemplo, edições do Standard Ebooks, que dedica suas contribuições ao domínio público, e do Project Gutenberg). Uma obra pode estar em domínio público em um país e não em outro: quando a situação é incerta, não publicamos.', 'Coleções agrupam livros que já estão na galeria, sem duplicá-los. O texto dos livros é o original; não o reescrevemos nem resumimos.', 'Se você é titular de direitos e acredita que algo na galeria viola seus direitos, escreva para o contato abaixo com a identificação da obra e do trecho; analisaremos e removeremos quando cabível.'] },
        { h: '6. Ilustrações geradas por IA', id: 'ilustracoes', p: ['Cada livro da galeria tem um estilo de ilustração padrão e um estilo padrão para o texto das legendas. As imagens geradas no estilo padrão são compartilhadas com todos os leitores do livro, e quem contribui ajuda a comunidade e ganha 5 pontos por página.', 'Você pode criar um estilo próprio na hora de ler. Nesse caso as imagens que você já gerou são zeradas e você começa uma coleção individual, que não é compartilhada com a comunidade. Alterações de estilo, de balões e de legendas valem só para você. Incentivamos que você ajude gerando imagens no estilo padrão.', 'As imagens são geradas por modelos de IA (OpenAI) e podem conter imprecisões. Cada geração nova consome créditos de IA do seu plano; páginas que a comunidade já gerou não consomem créditos.'] },
        { h: '6-A. Planos, créditos e minutos', id: 'planos', p: ['O Bookmoo tem o plano Grátis e os planos pagos Essencial, Plus e Pro, com benefícios descritos na página de planos. A partir do Essencial, toda a biblioteca da galeria é liberada, assim como a importação de EPUB e PDF.', 'Cada plano inclui, por período, uma quantidade de créditos de IA (ilustrações, explicações, histórias, imagens) e de minutos de conversa por voz. Créditos e minutos renovam a cada período, não acumulam para o período seguinte, não têm valor monetário e não são reembolsáveis separadamente. O custo de cada operação aparece no app antes do uso.', 'No plano Grátis você ganha 1 livro da galeria de presente, que fica com você para sempre. Ele pode ser trocado uma única vez nos primeiros 7 dias. Os créditos do Grátis exigem e-mail confirmado.'] },
        { h: '6-B. Assinatura, cobrança e cancelamento', id: 'assinatura', p: ['A assinatura é mensal, com renovação automática, cobrada pelo nosso parceiro de pagamentos (Zouti). O plano só é liberado após a confirmação do pagamento. Preços em reais, com impostos inclusos.', 'Upgrade: vale na hora e inicia um novo ciclo de cobrança no mesmo dia; o que sobrou do plano anterior vira créditos bônus no novo ciclo. Mudança para um plano menor e cancelamento valem no fim do período já pago, sem reembolso proporcional.', 'Direito de arrependimento: até 7 dias da primeira compra você pode pedir reembolso integral (Código de Defesa do Consumidor, art. 49); o acesso pago termina quando o estorno é processado.', 'Se uma renovação não for aprovada, você mantém o acesso por 3 dias para regularizar. Depois disso, a conta volta para o Grátis. Ao voltar para o Grátis, seu progresso, notas e vocabulário são preservados; os livros da galeria (exceto o presente) ficam travados até uma nova assinatura. Contestações de pagamento (chargeback) encerram o acesso imediatamente.', 'Menores de 18 anos só assinam com autorização de um responsável; menores de 12 não podem assinar.'] },
        { h: '6-C. Conversas por voz, tutor e análise de perfil', id: 'conversa', p: ['Nas Cenas, na conversa livre e no Tutor de leitura, sua fala é transformada em texto no seu aparelho (ou pelo serviço de reconhecimento do navegador) e só o texto é enviado à IA. Não gravamos seu áudio. As notas e correções são orientações pedagógicas geradas por IA e podem conter imprecisões.', 'Cenas criadas por você passam por moderação automática e não podem envolver conteúdo sexual, discriminatório, violento ou imitar pessoas reais.'] },
        { h: '7. O que é compartilhado e o que é só seu', id: 'compartilhado', p: ['São compartilhados com a comunidade: textos de explicação gerados por IA, histórias, imagens do mosaico de vocabulário e imagens geradas no estilo padrão de livros da galeria.', 'Ficam somente com você: suas notas, seu progresso, suas configurações, os livros que você envia e as imagens em estilo próprio.'] },
        { h: '8. Comunidade', p: ['Seja respeitoso. Não publique conteúdo ilegal, ofensivo ou que viole direitos de terceiros. Denúncias são analisadas e podemos remover conteúdo ou suspender contas. Seu perfil é privado até você torná-lo público.'] },
        { h: '9. Pontos e gamificação', p: ['Pontos, sequências e estrelas não têm valor monetário e podem ser ajustados para evitar abuso. Contribuições no estilo padrão podem render pontos conforme as regras vigentes.'] },
        { h: '10. Encerramento', p: ['Você pode excluir sua conta a qualquer momento nas Configurações. Podemos suspender contas que violem estes termos.'] },
        { h: '11. Responsabilidade', p: ['O serviço é oferecido "como está". Faremos o possível para mantê-lo disponível e seguro, mas não garantimos funcionamento ininterrupto nem a exatidão de conteúdo gerado por IA.'] },
        { h: '12. Alterações e lei aplicável', p: ['Podemos atualizar estes termos e avisaremos mudanças relevantes no app. Aplica-se a lei brasileira.'] },
      ],
    },
    en: {
      title: 'Terms of use',
      intro: 'By creating an account or using Bookmoo, you agree to these terms. If you do not agree, do not use the service.',
      blocks: [
        { h: '1. The service', p: ['Bookmoo is a platform to learn English by reading books: audio reading, vocabulary, speaking and dictation practice, AI-generated illustrations, a book gallery, collections and community features.'] },
        { h: '2. Your account, age and date of birth', id: 'conta', p: ['You are responsible for your account and for keeping your password safe. Tell us if you suspect misuse.', 'At sign-up we ask for your date of birth. It is used to show only books suitable for your age and to apply child-protection rules. Giving a false date breaks these terms.', 'Users under 18 must use Bookmoo with a guardian’s knowledge. Under 12, a legal guardian’s specific consent to data processing is required.'] },
        { h: '3. Book age ratings', id: 'faixa-etaria', p: ['Each gallery book shows a suggested age; hover the badge to see the other reference ages. This is Bookmoo’s editorial guidance, built from public sources and the work’s content (themes, language, violence). It is not an official government rating.', 'Books above your age range are not shown. Guardians can ask for adjustments via the contact below.'] },
        { h: '4. Books you upload (EPUB and PDF)', id: 'livros', p: ['EPUBs and PDFs you upload stay in your library only. They are not added to the gallery, not shared with the community and not placed in collections. From a PDF, Bookmoo uses only the text; images and figures are ignored.', 'Uploading an EPUB or PDF protected by intellectual-property law without the rightsholder’s permission is forbidden (for example purchased books, pirated copies or DRM material). Upload only content you wrote, that is in the public domain, or that you are allowed to use.', 'When saving a book you confirm, in a checkbox, that the content is your own, in the public domain or authorized for use, and that you are responsible for this declaration. We may remove content and suspend accounts that break this rule.'] },
        { h: '5. Gallery, collections and copyright', id: 'galeria', p: ['The gallery contains public-domain works. Before publishing we check the work, the translation, the illustrations, the cover and the edition file (for example Standard Ebooks editions, whose contributions are dedicated to the public domain, and Project Gutenberg). A work can be public domain in one country and not in another: when the situation is unclear, we do not publish.', 'Collections group books already in the gallery without duplicating them. Book text is the original; we do not rewrite or summarize it.', 'If you hold rights and believe something in the gallery infringes them, write to the contact below identifying the work and passage; we will review and remove it when appropriate.'] },
        { h: '6. AI-generated illustrations', id: 'ilustracoes', p: ['Every gallery book has a default illustration style and a default caption text style. Images generated in the default style are shared with all readers of the book, and contributors help the community and earn 5 points per page.', 'You can create your own style while reading. When you do, the images you generated are cleared and you start an individual collection that is not shared with the community. Changes to style, balloons and captions apply only to you. We encourage you to help by generating images in the default style.', 'Images are generated by AI models (OpenAI) and may contain inaccuracies. Each new generation uses AI credits from your plan; pages the community already generated are free.'] },
        { h: '6-A. Plans, credits and minutes', id: 'planos', p: ['Bookmoo has a Free plan and the paid plans Essencial, Plus and Pro. From Essencial up, the whole gallery and EPUB/PDF import are unlocked.', 'Each plan includes AI credits and voice-conversation minutes per period. They renew each period, do not roll over, have no monetary value and are not refundable separately.', 'On Free you get 1 gallery book as a gift, yours forever, swappable once within 7 days. Free credits require a confirmed email.'] },
        { h: '6-B. Subscription, billing and cancellation', id: 'assinatura', p: ['Subscriptions are monthly with automatic renewal, billed by our payment partner (Zouti). Plans unlock only after payment is confirmed.', 'Upgrades apply immediately and start a new billing cycle; what is left of the previous plan becomes bonus credits. Downgrades and cancellations take effect at the end of the paid period, without prorated refunds.', 'You may request a full refund within 7 days of your first purchase. If a renewal fails you keep access for 3 days. Back on Free, your progress, notes and vocabulary are kept and gallery books (except your gift) lock until you subscribe again. Chargebacks end access immediately.', 'Under-18s need a guardian’s permission to subscribe; under-12s cannot subscribe.'] },
        { h: '6-C. Voice conversations, tutor and profile analysis', id: 'conversa', p: ['Your speech is turned into text on your device (or by your browser’s speech service) and only the text is sent to the AI. We do not record your audio. Scores and corrections are AI-generated guidance and may be inaccurate.', 'Scenes you create are moderated and cannot involve sexual, hateful or violent content or impersonate real people.'] },
        { h: '7. What is shared and what is yours alone', id: 'compartilhado', p: ['Shared with the community: AI-generated explanation texts, stories, vocabulary mosaic images and images generated in the default style of gallery books.', 'Yours alone: your notes, progress, settings, the books you upload and images in your own style.'] },
        { h: '8. Community', p: ['Be respectful. Do not post illegal or offensive content or content that infringes others’ rights. Reports are reviewed and we may remove content or suspend accounts. Your profile is private until you make it public.'] },
        { h: '9. Points', p: ['Points, streaks and stars have no monetary value and may be adjusted to prevent abuse. Contributions in the default style may earn points under the current rules.'] },
        { h: '10. Termination', p: ['You can delete your account at any time in Settings. We may suspend accounts that break these terms.'] },
        { h: '11. Liability', p: ['The service is provided "as is". We do our best to keep it available and safe but do not guarantee uninterrupted operation or the accuracy of AI-generated content.'] },
        { h: '12. Changes and governing law', p: ['We may update these terms and will announce relevant changes in the app. Brazilian law applies.'] },
      ],
    },
  },
  privacy: {
    pt: {
      title: 'Política de privacidade',
      intro: 'Explicamos quais dados coletamos, por que e como você controla cada um, conforme a LGPD.',
      blocks: [
        { h: 'Dados que coletamos', p: ['Conta: e-mail, nome, foto (opcional), data de nascimento e data de aceite destes termos.', 'Estudo: livros que você envia, páginas lidas, vocabulário, notas, sessões de prática, pontos e tempo de estudo.', 'Perfil (opcional): nome de usuário, bio e o que você escolher mostrar. Contribuições: imagens, textos e avaliações que você gera ou publica.'] },
        { h: 'Para que usamos', p: ['Oferecer o serviço (salvar seu progresso, sincronizar entre aparelhos), gerar estatísticas para você e manter a plataforma segura.', 'A data de nascimento é usada para mostrar livros adequados à sua faixa etária e aplicar regras de proteção de crianças e adolescentes. Não a usamos para publicidade.', 'Não vendemos seus dados e não usamos seu conteúdo para publicidade.'] },
        { h: 'Crianças e adolescentes', p: ['Para menores de 12 anos, o tratamento de dados depende de consentimento específico de um responsável legal (LGPD, art. 14). Menores de 18 anos devem usar o app com ciência dos responsáveis, que podem pedir revisão ou exclusão dos dados pelo contato abaixo.'] },
        { h: 'Seus livros enviados', p: ['EPUBs e PDFs que você envia ficam apenas na sua biblioteca. Não são publicados na galeria, nem compartilhados com a comunidade ou com outros usuários. De PDFs usamos só o texto. Ao salvar, registramos a sua declaração de que o conteúdo é seu, de domínio público ou autorizado; livros protegidos por direitos autorais sem permissão são proibidos.'] },
        { h: 'IA, pagamentos e e-mails', p: ['Os textos que você pede para explicar, as páginas para ilustrar e as transcrições das suas conversas por voz são enviados à OpenAI (operadora de IA), que os trata conforme a política dela. Não guardamos o áudio da sua voz; guardamos a transcrição das conversas, que você pode apagar.', 'Os dados de pagamento (cartão, Pix) ficam com a Zouti, nosso parceiro de pagamentos; guardamos apenas o status, o valor e as datas das cobranças. Para a análise de perfil usamos seu vocabulário, suas práticas e os erros das conversas. E-mails transacionais são enviados pela Resend.', 'Explicações, histórias, imagens do mosaico e imagens geradas no estilo padrão de livros da galeria são compartilhadas com a comunidade. Notas e imagens em estilo próprio não são.'] },
        { h: 'O que fica público', p: ['Seu perfil é privado por padrão. Se você o tornar público, outras pessoas veem o que você escolheu mostrar (estatísticas, livros da galeria que está lendo, versões compartilhadas e avaliações).'] },
        { h: 'Voz e microfone', p: ['As vozes de leitura e o reconhecimento de fala rodam no seu aparelho. O áudio da prática de fala não é enviado ao servidor.'] },
        { h: 'Seus direitos', p: ['Você pode confirmar o tratamento, acessar, corrigir, exportar, anonimizar ou excluir seus dados e revogar consentimentos a qualquer momento nas Configurações ou pelo contato abaixo (LGPD, art. 18).'] },
        { h: 'Retenção e segurança', p: ['Mantemos os dados enquanto a conta existir. Ao excluir a conta, os dados pessoais são apagados; imagens já compartilhadas na galeria podem permanecer sem identificação. Usamos criptografia em trânsito e controles de acesso.'] },
        { h: 'Contato', p: ['Dúvidas sobre privacidade, pedidos de titulares e de responsáveis: lucasmarteux@gmail.com.'] },
      ],
    },
    en: {
      title: 'Privacy policy',
      intro: 'What data we collect, why, and how you control it.',
      blocks: [
        { h: 'Data we collect', p: ['Account: email, name, optional photo, date of birth and terms acceptance date.', 'Study: books you upload, pages read, vocabulary, notes, practice sessions, points and study time.', 'Profile (optional): username, bio and what you choose to show. Contributions: images, texts and reviews you generate or publish.'] },
        { h: 'How we use it', p: ['To provide the service, sync across devices, show your stats and keep the platform safe.', 'Date of birth is used to show age-appropriate books and apply child-protection rules. We do not use it for advertising.', 'We never sell your data.'] },
        { h: 'Children and teens', p: ['For users under 12, data processing depends on a legal guardian’s specific consent. Users under 18 should use the app with a guardian’s knowledge; guardians can request review or deletion via the contact below.'] },
        { h: 'Books you upload', p: ['EPUBs and PDFs you upload stay in your library only. They are not published to the gallery or shared with the community or other users. From PDFs we use only the text. When saving, we record your declaration that the content is yours, public domain or authorized; copyrighted books without permission are forbidden.'] },
        { h: 'AI, payments and emails', p: ['Texts you ask to explain, pages to illustrate and transcripts of your voice conversations are sent to OpenAI (our AI processor). We do not store your voice audio; we keep conversation transcripts, which you can delete.', 'Payment data stays with Zouti, our payment partner; we only keep status, amount and dates. Profile analysis uses your vocabulary, practice and conversation mistakes. Transactional emails are sent via Resend.', 'Explanations, stories, vocabulary mosaic images and images generated in the default style of gallery books are shared with the community. Notes and images in your own style are not.'] },
        { h: 'What is public', p: ['Your profile is private by default. If you make it public, others see only what you choose to show.'] },
        { h: 'Voice and microphone', p: ['Reading voices and speech recognition run on your device. Speech-practice audio is not sent to the server.'] },
        { h: 'Your rights', p: ['You can confirm processing, access, correct, export, anonymize or delete your data and withdraw consent at any time in Settings or via the contact below.'] },
        { h: 'Retention and security', p: ['We keep data while the account exists. When you delete your account personal data is erased; images already shared in the gallery may remain without identification. We use encryption in transit and access controls.'] },
        { h: 'Contact', p: ['Privacy questions and requests from data subjects and guardians: lucasmarteux@gmail.com.'] },
      ],
    },
  },
  faq: {
    pt: {
      title: 'Perguntas frequentes',
      intro: 'Respostas rápidas sobre como o Bookmoo funciona.',
      blocks: [
        { id: 'pagar', h: 'Preciso pagar para usar?', p: ['Não. No plano Grátis você lê com áudio, salva vocabulário, pratica, ganha 1 livro da galeria de presente e créditos de IA para experimentar. Nos planos Essencial, Plus e Pro você libera a biblioteca inteira, importa EPUB/PDF e ganha mais créditos, conversas por voz e o tutor.'] },
        { id: 'creditos', h: 'O que são créditos de IA?', p: ['É o saldo mensal para gerar coisas novas com IA: página ilustrada = 10 créditos; explicação, história ou imagem do mosaico = 1. O que a comunidade já gerou é grátis. Os créditos renovam a cada período e não acumulam. O saldo fica sempre visível na barra lateral.'] },
        { id: 'presente', h: 'Como funciona o livro-presente?', p: ['No Grátis você escolhe 1 livro da galeria e ele é seu para sempre. Pode trocar uma única vez nos primeiros 7 dias. Os outros livros aparecem com o selo Premium: dá para ver e ler a amostra.'] },
        { id: 'cancelar', h: 'Como cancelo ou troco de plano?', p: ['Em Minha assinatura. O cancelamento vale no fim do período pago. Upgrade vale na hora, com novo ciclo no mesmo dia e o que sobrou do plano atual vira créditos bônus. Até 7 dias da primeira compra você pode pedir reembolso integral.'] },
        { id: 'conversar', h: 'Como funcionam as conversas por voz?', p: ['Em Conversar você escolhe uma Cena (aeroporto, cafeteria, entrevista…) e fala com o personagem. No fim recebe nota de 0 a 100 e correções. No Plus e no Pro há o tutor de leitura, a conversa livre e as cenas que você cria. Cada plano tem minutos de conversa por mês.'] },
        { id: 'status', h: 'O que são Aprendi, Revisar e Importante?', p: ['É como a palavra está para você. Revisar coloca a palavra na sua revisão; Aprendi tira da revisão e soma pontos; Importante destaca a palavra na lista para você voltar nela primeiro.'] },
        { id: 'explicacao', h: 'O que vem na explicação de uma palavra?', p: ['Um clique em Explicar com IA traz o significado, uma dica de uso, exemplos nas formas afirmativa, negativa e pergunta e uma pequena história usando a palavra.'] },
        { id: 'traducao', h: 'Por que só às vezes aparece o olho de tradução?', p: ['Tudo vem em inglês para você pensar no idioma. No nível A1 aparece o olho: ele troca o significado, a dica e a história para o português. Ao subir de nível, o olho some para incentivar a leitura direta.'] },
        { id: 'nivel', h: 'Como meu nível (A1, A2…) é calculado?', p: ['Pelas palavras que você salva e pelos pontos que ganha estudando. Ao atingir as metas de um nível, você passa para o próximo.'] },
        { id: 'livros-privados', h: 'Os livros que eu envio ficam públicos?', p: ['Não. EPUBs e textos que você envia ficam só na sua conta.'] },
        { id: 'galeria', h: 'O que é a galeria?', p: ['Uma coleção de livros de domínio público prontos para estudar. As imagens de uma página geradas por um leitor ficam disponíveis para todos — se alguém já gerou a página, você não precisa gerar de novo.'] },
        { id: 'estilo', h: 'Como funciona o estilo das imagens?', p: ['Cada livro da galeria já vem com um estilo de ilustração padrão e um estilo de legenda. As imagens geradas no estilo padrão são compartilhadas com todos os leitores do livro e cada página contribuída vale 5 pontos.', 'Se você quiser um estilo próprio, troque na hora de ler: suas imagens daquele livro são zeradas e você começa uma coleção individual, que não é compartilhada com a comunidade.'] },
        { id: 'quadrinhos', h: 'Posso ter os quadrinhos do meu jeito?', p: ['Sim. Você pode mover e editar os balões só para você, ou trocar o estilo e gerar de novo. Se quiser, compartilhe sua versão; outros leitores podem usá-la e dar estrelas.'] },
        { id: 'notas', h: 'Como funcionam as notas?', p: ['No leitor, escolha o modo Nota e clique em qualquer palavra ou ponto do quadrinho. Suas notas ficam marcadas com um pin e reunidas na página Notas.'] },
        { id: 'perfil', h: 'Meu perfil é público?', p: ['Só se você quiser. Por padrão ele é privado; você escolhe o que mostrar em Configurações → Perfil.'] },
        { id: 'excluir-conta', h: 'Como excluo minha conta?', p: ['Escreva para lucasmarteux@gmail.com pelo e-mail da conta e apagamos seus dados pessoais.'] },
      ],
    },
    en: {
      title: 'Frequently asked questions',
      intro: 'Quick answers about how Bookmoo works.',
      blocks: [
        { id: 'pagar', h: 'Is it free?', p: ['Yes. The Free plan includes audio reading, vocabulary, practice, 1 gift book and AI credits to try. Paid plans unlock the whole library, EPUB/PDF import, more credits, voice conversations and the tutor.'] },
        { id: 'creditos', h: 'What are AI credits?', p: ['Your monthly balance to generate new things with AI: illustrated page = 10 credits; explanation, story or mosaic image = 1. Community content is free. Credits renew each period and do not roll over.'] },
        { id: 'cancelar', h: 'How do I cancel or change plans?', p: ['In My subscription. Cancellation applies at the end of the paid period. Upgrades apply immediately. Full refund within 7 days of your first purchase.'] },
        { id: 'status', h: 'What do Learned, Review and Important mean?', p: ['How the word is for you. Review adds it to your review; Learned removes it and earns points; Important highlights it so you come back to it first.'] },
        { id: 'explicacao', h: 'What comes in a word explanation?', p: ['Explain with AI brings the meaning, a usage tip, affirmative, negative and question examples and a short story using the word.'] },
        { id: 'traducao', h: 'Why does the translation eye only appear sometimes?', p: ['Everything comes in English so you think in the language. At level A1 an eye switches the meaning, tip and story to your language; it goes away as you level up.'] },
        { id: 'nivel', h: 'How is my level (A1, A2…) calculated?', p: ['From the words you save and the points you earn studying.'] },
        { id: 'livros-privados', h: 'Are my uploaded books public?', p: ['No. EPUBs and texts you upload stay in your account only.'] },
        { id: 'galeria', h: 'What is the gallery?', p: ['A collection of public-domain books ready to study. Page images generated by one reader are available to everyone.'] },
        { id: 'estilo', h: 'How does the image style work?', p: ['Every gallery book comes with a default illustration style and caption style. Images generated in the default style are shared with all readers of the book, and each contributed page is worth 5 points.', 'If you want your own style, switch it while reading: your images for that book are cleared and you start an individual collection that is not shared with the community.'] },
        { id: 'quadrinhos', h: 'Can I have comics my own way?', p: ['Yes. Edit balloons just for you, or change the style and generate again — and share your version if you like.'] },
        { id: 'notas', h: 'How do notes work?', p: ['In the reader, choose Note mode and click any word or comic spot. Notes show as pins and are gathered on the Notes page.'] },
        { id: 'perfil', h: 'Is my profile public?', p: ['Only if you want. It is private by default.'] },
        { id: 'excluir-conta', h: 'How do I delete my account?', p: ['Email lucasmarteux@gmail.com from your account address and we delete your personal data.'] },
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
  const links: [LegalDoc, string][] = [['terms', pt ? 'Termos' : 'Terms'], ['privacy', pt ? 'Privacidade' : 'Privacy'], ['faq', 'FAQ']]

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
              <Link key={id} to={`/${id}${carry}`} replace state={location.state} className="h-8 px-2.5 inline-flex items-center rounded-md text-[13px]"
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
