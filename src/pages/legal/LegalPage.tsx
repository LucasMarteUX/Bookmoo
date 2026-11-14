// Termos de uso, política de privacidade e perguntas frequentes (rotas públicas).
// Texto-modelo inicial: recomenda-se revisão jurídica antes de uso comercial.
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'

export type LegalDoc = 'terms' | 'privacy' | 'faq'
type Block = { h: string; p: string[]; id?: string }

const UPDATED = '2026-11-13'

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
        { h: '6. Ilustrações geradas por IA', id: 'ilustracoes', p: ['Cada livro da galeria tem um estilo de ilustração padrão e um estilo padrão para o texto das legendas. As imagens geradas no estilo padrão são compartilhadas com todos os leitores do livro, e quem contribui ajuda a comunidade e ganha 5 pontos por página.', 'Você pode criar um estilo próprio na hora de ler. Nesse caso as imagens que você já gerou são zeradas e você começa uma coleção individual, que não é compartilhada com a comunidade. Alterações de estilo, de balões e de legendas valem só para você. Incentivamos que você ajude gerando imagens no estilo padrão.', 'As imagens são geradas por modelos de IA com a sua chave (OpenAI ou Gemini) e podem conter imprecisões. Os custos são cobrados pelo provedor diretamente na sua conta.'] },
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
        { h: '6. AI-generated illustrations', id: 'ilustracoes', p: ['Every gallery book has a default illustration style and a default caption text style. Images generated in the default style are shared with all readers of the book, and contributors help the community and earn 5 points per page.', 'You can create your own style while reading. When you do, the images you generated are cleared and you start an individual collection that is not shared with the community. Changes to style, balloons and captions apply only to you. We encourage you to help by generating images in the default style.', 'Images are generated by AI models with your own key (OpenAI or Gemini) and may contain inaccuracies. Costs are billed by the provider to your account.'] },
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
        { h: 'Chaves e conteúdo de IA', p: ['Suas chaves da OpenAI ou do Gemini são guardadas cifradas no servidor e nunca voltam para o navegador. Os textos que você pede para explicar e as páginas para ilustrar são enviados ao provedor escolhido, que os trata conforme a política dele.', 'Explicações, histórias, imagens do mosaico e imagens geradas no estilo padrão de livros da galeria são compartilhadas com a comunidade. Notas e imagens em estilo próprio não são.'] },
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
        { h: 'AI keys and content', p: ['Your OpenAI or Gemini keys are stored encrypted on the server and never sent back to the browser. Texts you ask to explain and pages to illustrate are sent to the chosen provider, which processes them under its own policy.', 'Explanations, stories, vocabulary mosaic images and images generated in the default style of gallery books are shared with the community. Notes and images in your own style are not.'] },
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
        { id: 'pagar', h: 'Preciso pagar para usar?', p: ['A leitura, as vozes, o vocabulário e a prática são gratuitos. Recursos de IA (explicações, histórias e imagens) usam a sua própria chave da OpenAI ou do Gemini, cobrada pelo provedor.'] },
        { id: 'chave-ia', h: 'Como conecto minha chave de IA?', p: ['Em Configurações → Conexões de IA. A chave fica cifrada no servidor e só é usada para os seus pedidos.'] },
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
        { id: 'pagar', h: 'Is it free?', p: ['Reading, voices, vocabulary and practice are free. AI features use your own OpenAI or Gemini key, billed by the provider.'] },
        { id: 'chave-ia', h: 'How do I connect my AI key?', p: ['In Settings → AI connections. The key is encrypted on the server and used only for your requests.'] },
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

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const pt = useLanguage().locale === 'pt-BR'
  const navigate = useNavigate()
  const d = DOCS[doc][pt ? 'pt' : 'en']
  const hash = useLocation().hash.slice(1)
  useEffect(() => { if (hash) document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [hash])
  const links: [LegalDoc, string][] = [['terms', pt ? 'Termos' : 'Terms'], ['privacy', pt ? 'Privacidade' : 'Privacy'], ['faq', 'FAQ']]
  return (
    <div className="min-h-dvh px-5 py-10" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-3 mb-10">
          <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="inline-flex items-center gap-1.5 h-8 px-2 -ml-2 rounded-md text-[13.5px] hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-text-secondary)' }}>
            <ArrowLeft className="w-4 h-4" />{pt ? 'Voltar' : 'Back'}
          </button>
          <nav className="flex gap-1">
            {links.map(([id, label]) => (
              <Link key={id} to={`/${id}`} className="h-8 px-2.5 inline-flex items-center rounded-md text-[13px]"
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
