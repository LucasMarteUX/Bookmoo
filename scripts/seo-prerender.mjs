#!/usr/bin/env node
/**
 * SEO depois do `vite build`. O site é uma SPA: sem isto, toda página devolvia o mesmo index.html, com o título
 * e a descrição da home e o corpo vazio. Buscadores que não executam JavaScript e a maioria dos agentes de IA
 * (GPTBot, ClaudeBot, PerplexityBot…) não enxergavam nada de /tutores, /planos ou dos livros.
 *
 * Para cada página pública, gera `dist/<rota>.html` (servido sem o .html pelo `cleanUrls` da Vercel) com:
 *  - <title>, description, canonical, Open Graph e Twitter Card próprios;
 *  - dados estruturados (JSON-LD): Organization, WebSite, WebPage, e por página WebApplication/Offer,
 *    FAQPage, Book, ItemList e BreadcrumbList;
 *  - o texto principal da página em HTML semântico dentro do #root. O React substitui esse conteúdo ao montar
 *    (createRoot), então quem tem JavaScript nunca o vê; ele só aparece, depois de alguns segundos, se o
 *    JavaScript não rodar.
 * Também gera `dist/sitemap.xml` e `dist/llms-full.txt` (o resumo para agentes de IA fica em public/llms.txt).
 *
 * Os textos vêm das mesmas fontes do site (catálogo, tutores, planos, FAQ e documentos legais), lidas do código.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const SITE = 'https://www.upoonly.com'
const OG_DEFAULT = `${SITE}/og-cover.jpg`
const TODAY = new Date().toISOString().slice(0, 10)
const read = p => readFileSync(join(ROOT, p), 'utf8')

// ---------------------------------------------------------------- dados lidos do código do site
/** Avalia um literal JS (objeto/array só com strings e números) recortado de um arquivo do projeto. */
function literal(file, startMarker, open = '[') {
  const src = read(file)
  const at = src.indexOf(startMarker)
  if (at < 0) throw new Error(`marcador não encontrado em ${file}: ${startMarker}`)
  // Pula a anotação de tipo (`: Plan[]`, `: Record<…, { … }>`): o literal começa depois do "=".
  const eq = startMarker.trimEnd().endsWith(open) ? at + startMarker.length - 2 : src.indexOf('=', at)
  const begin = src.indexOf(open, eq)
  const close = open === '[' ? ']' : '}'
  let depth = 0, inStr = null, esc = false
  for (let i = begin; i < src.length; i++) {
    const c = src[i]
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === inStr) inStr = null; continue }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue }
    if (c === open) depth++
    else if (c === close && --depth === 0) return new Function(`return (${src.slice(begin, i + 1)})`)()
  }
  throw new Error(`literal sem fim em ${file}`)
}

const CATALOG = JSON.parse(read('src/site/catalog.json'))
const COVERS = literal('src/site/covers.ts', 'export const COVERS')
const SYNOPSIS = literal('src/site/pages/Books.tsx', 'const SYNOPSIS: Record<string, string> = {', '{')
const TUTORS = literal('src/site/content.ts', 'export const TUTORS: Tutor[] = [')
const PLANS = literal('src/lib/plans.ts', 'export const PLANS')
const DOCS = literal('src/pages/legal/LegalPage.tsx', 'export const DOCS', '{')

const inCatalog = new Set(CATALOG.map(b => b.slug))
const BOOKS = [...CATALOG, ...COVERS.filter(c => !inCatalog.has(c.slug))]
const coverUrl = slug => `${SITE}${inCatalog.has(slug) ? `/site/catalog/${slug}.webp` : `/site/covers/${slug}.webp`}`
const synopsis = b => SYNOPSIS[b.slug] ?? `${b.title}, de ${b.author}: um clássico de ${String(b.category).toLowerCase()} para ler em inglês com a página narrada, cada palavra explicada e um tutor para conversar sobre a história.`

const brl = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const ANNUAL_EXATO = { 4490: 43080 }
const annual = cents => ANNUAL_EXATO[cents] ?? Math.round(cents * 12 * 0.8)

// ---------------------------------------------------------------- HTML
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const p = t => `<p>${esc(t)}</p>`
const list = items => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`
const a = (href, text) => `<a href="${href}">${esc(text)}</a>`
const section = (h, ...body) => `<section><h2>${esc(h)}</h2>${body.join('')}</section>`

const NAV = [['/', 'Início'], ['/leitor', 'Leitor'], ['/tutores', 'Tutores'], ['/biblioteca', 'Biblioteca'], ['/livros', 'Livros'],
  ['/ilustracoes', 'Ilustrações'], ['/pratica', 'Prática'], ['/evolucao', 'Evolução'], ['/prova', 'Prova de proficiência'], ['/planos', 'Planos'], ['/sobre', 'Sobre']]
const FOOT = [['/faq', 'Perguntas frequentes'], ['/contato', 'Contato'], ['/terms', 'Termos de uso'], ['/privacy', 'Privacidade'], ['/conduta', 'Código de conduta'], ['/signup', 'Criar conta grátis']]

function body(h1, inner) {
  return `<div id="seo-prerender"><header><a href="/"><strong>Upoonly</strong></a><nav aria-label="Navegação principal">${NAV.map(([h, t]) => a(h, t)).join(' · ')}</nav></header>`
    + `<main><h1>${esc(h1)}</h1>${inner}</main>`
    + `<footer><nav aria-label="Ajuda">${FOOT.map(([h, t]) => a(h, t)).join(' · ')}</nav><p>Upoonly · Aprenda inglês dentro dos livros · contato@upoonly.com</p></footer></div>`
}

// ---------------------------------------------------------------- dados estruturados
const ORG = { '@type': 'Organization', '@id': `${SITE}/#org`, name: 'Upoonly', url: `${SITE}/`, logo: `${SITE}/pwa-512x512.png`, email: 'contato@upoonly.com', description: 'Plataforma para aprender inglês lendo clássicos, com áudio, ilustrações por IA e tutores de conversação.' }
const WEBSITE = { '@type': 'WebSite', '@id': `${SITE}/#site`, name: 'Upoonly', url: `${SITE}/`, inLanguage: 'pt-BR', publisher: { '@id': `${SITE}/#org` } }
const paidPlans = PLANS.filter(pl => pl.priceCents > 0)
const OFFERS = [
  { '@type': 'Offer', name: 'Plano Grátis', price: '0', priceCurrency: 'BRL', url: `${SITE}/planos` },
  ...paidPlans.flatMap(pl => [
    { '@type': 'Offer', name: `Plano ${pl.name} mensal`, price: (pl.priceCents / 100).toFixed(2), priceCurrency: 'BRL', url: `${SITE}/planos`,
      priceSpecification: { '@type': 'UnitPriceSpecification', price: (pl.priceCents / 100).toFixed(2), priceCurrency: 'BRL', billingDuration: 'P1M' } },
    { '@type': 'Offer', name: `Plano ${pl.name} anual`, price: (annual(pl.priceCents) / 100).toFixed(2), priceCurrency: 'BRL', url: `${SITE}/planos`,
      priceSpecification: { '@type': 'UnitPriceSpecification', price: (annual(pl.priceCents) / 100).toFixed(2), priceCurrency: 'BRL', billingDuration: 'P1Y' } },
  ]),
]
const APP = {
  '@type': 'WebApplication', '@id': `${SITE}/#app`, name: 'Upoonly', url: `${SITE}/`, applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web, iOS, Android', inLanguage: 'pt-BR', image: OG_DEFAULT,
  description: 'Leia clássicos em inglês com narração, karaokê, explicação de cada palavra no contexto, ilustrações geradas por IA, prática de fala e ditado e tutores de IA que conversam por voz sobre o livro.',
  educationalUse: 'Aprendizado de inglês como segunda língua', audience: { '@type': 'EducationalAudience', educationalRole: 'student' },
  offers: { '@type': 'AggregateOffer', priceCurrency: 'BRL', lowPrice: '0', highPrice: (Math.max(...paidPlans.map(pl => pl.priceCents)) / 100).toFixed(2), offerCount: OFFERS.length, offers: OFFERS },
  publisher: { '@id': `${SITE}/#org` },
}
const crumbs = items => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SITE}${path}` })) })

// ---------------------------------------------------------------- páginas
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const bookLink = b => `${a(`/livro/${b.slug}`, b.title)} — ${esc(b.author)} (${esc(b.level)}, ${esc(b.category)})`
const featureList = [
  'Leitor com narração natural e karaokê: a palavra acende no momento em que é dita.',
  'Toque em qualquer palavra para ver pronúncia, tradução e exemplo no contexto da história.',
  'Ilustrações e quadrinhos gerados por IA para cada página, em 16 estilos ou no seu.',
  'Tutores de IA (Bia, Luck, Yuno e Yuri) que conversam por voz sobre o livro e lembram de você.',
  'Cenas da vida real para praticar conversação: café, aeroporto, entrevista.',
  'Prática de fala com nota de pronúncia, ditado, questionário e revisão espaçada de vocabulário.',
  'Raio-X do seu inglês, metas, sequência de estudo e prova de proficiência com estimativa CEFR.',
  'Mais de 100 clássicos com nível indicado do A1 ao C2, e importação dos seus EPUBs e PDFs.',
]
const planHtml = PLANS.map(pl => `<article><h3>${esc(pl.name)} — ${pl.priceCents ? `${brl(pl.priceCents)}/mês ou ${brl(annual(pl.priceCents))}/ano` : 'grátis'}</h3>`
  + p(`${pl.tagline.pt}. ${pl.credits.toLocaleString('pt-BR')} créditos de IA por mês.`)
  + list(pl.benefits.map(b => esc(b.pt))) + '</article>').join('')

const faqBlocks = DOCS.faq.pt.blocks
const legal = key => DOCS[key].pt.blocks.map(b => section(b.h, ...b.p.map(p))).join('')

/** Rota → título, descrição, h1, conteúdo e JSON-LD extra. */
const PAGES = [
  { path: '/', title: 'Upoonly · Aprenda inglês dentro dos livros', h1: 'Aprenda inglês dentro dos livros',
    description: 'Leia clássicos em inglês com áudio, ilustrações feitas por IA e um tutor que conversa com você sobre o livro. Comece de graça, sem cartão.',
    html: p('O Upoonly é um leitor para aprender inglês lendo histórias de verdade. Você ouve a página narrada, toca numa palavra para entender o sentido, vê a cena ilustrada e conversa em voz alta com um tutor de IA sobre o que acabou de ler.')
      + section('O que você encontra', list(featureList.map(esc)))
      + section('Comece de graça', p('No plano Grátis você ganha um livro da galeria de presente, lê com áudio, salva vocabulário e conversa com a tutora Bia. Nos planos pagos, a biblioteca inteira é liberada.'), p(a('/planos', 'Ver os planos') + ' · ' + a('/signup', 'Criar conta grátis')))
      + section('Alguns livros da biblioteca', list(BOOKS.slice(0, 12).map(bookLink))),
    ld: [APP] },
  { path: '/leitor', title: 'Leitor de inglês com áudio e karaokê · Upoonly', h1: 'Um leitor que ensina enquanto você lê',
    description: 'Leia clássicos em inglês com narração natural, karaokê, explicação de cada palavra no contexto e a gramática da página em português.',
    html: p('Mais de 100 clássicos com narração natural. A palavra acende no momento em que é dita, e um toque explica qualquer uma no contexto da história.')
      + section('Recursos do leitor', list(['Narração com karaokê: escolha a voz e a velocidade.', 'Toque na palavra: pronúncia, tradução e exemplo, sem sair da página.', 'Decifrar a página: a gramática da página explicada em português.', 'Leitura confortável: temas Dia, Tarde e Noite, fontes e sons ambientes.', 'Notas e marcações em qualquer palavra ou quadro.'].map(esc))) },
  { path: '/tutores', title: 'Tutores de IA para conversar em inglês · Upoonly', h1: 'Quatro tutores para conversar em inglês',
    description: 'Conheça Bia, Luck, Yuno e Yuri: tutores de IA que conversam por voz sobre o livro, corrigem com calma e lembram do que vocês já falaram.',
    html: p('Cada tutor tem um ritmo, um jeito de corrigir e um assunto preferido. Escolha quem combina com você e troque quando quiser: todos lembram do que vocês já conversaram.')
      + TUTORS.map(t => section(`${t.name} — ${t.role}`, p(t.about), p(`Jeito de falar: ${t.style ?? ''} ${t.voice}`), t.fits ? `<p>Combina com:</p>${list(t.fits.map(esc))}` : '', p(`Narra por padrão: ${t.when}`))).join('')
      + section('Planos', p('No Grátis e no Essencial a conversa no leitor é com a Bia. Plus e Pro liberam os quatro tutores e a conversa livre.'), p(a('/planos', 'Comparar planos'))) },
  { path: '/biblioteca', title: 'Biblioteca de clássicos em inglês por nível · Upoonly', h1: 'Mais de 100 clássicos em inglês',
    description: 'Mais de 100 clássicos em inglês com capa nova e nível indicado do A1 ao C2, e importação dos seus próprios EPUBs e PDFs.',
    html: p('Livros de domínio público prontos para estudar, com capa nova, nível indicado e narração. Você também pode importar seus EPUBs e PDFs, que ficam só na sua conta.')
      + LEVELS.map(l => { const bs = BOOKS.filter(b => b.level === l); return bs.length ? section(`Nível ${l}`, list(bs.slice(0, 8).map(bookLink)), p(a('/livros', `Ver todos os livros ${l}`))) : '' }).join('') },
  { path: '/livros', title: 'Livros em inglês do A1 ao C2 · Upoonly', h1: 'Os livros da biblioteca',
    description: `Os ${BOOKS.length} clássicos da biblioteca do Upoonly, com nível indicado do A1 ao C2: infantil, aventura, fantasia, mistério, romance e poesia.`,
    html: LEVELS.map(l => { const bs = BOOKS.filter(b => b.level === l); return bs.length ? section(`Nível ${l} (${bs.length} livros)`, list(bs.map(bookLink))) : '' }).join(''),
    ld: [{ '@type': 'ItemList', name: 'Livros da biblioteca do Upoonly', numberOfItems: BOOKS.length,
      itemListElement: BOOKS.map((b, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/livro/${b.slug}`, name: b.title })) }] },
  { path: '/ilustracoes', title: 'Ilustrações e quadrinhos por IA para cada página · Upoonly', h1: 'A mesma cena, no seu traço',
    description: 'Cada página do livro pode virar ilustração ou quadrinho gerado por IA, em 16 estilos ou no seu: aquarela, mangá, noir e muito mais.',
    html: p('Escolha um estilo e veja a página que você está lendo virar imagem. As ilustrações no estilo padrão de cada livro ficam disponíveis para todos os leitores; as do seu estilo são só suas.')
      + section('Como funciona', list(['16 estilos prontos ou um estilo próprio a partir de uma referência.', 'Página ilustrada ou em quadrinhos, com balões editáveis.', 'O que a comunidade já gerou não gasta créditos.'].map(esc))) },
  { path: '/pratica', title: 'Prática de fala, ditado e vocabulário em inglês · Upoonly', h1: 'Pratique com o livro que você está lendo',
    description: 'Pratique fala com nota de pronúncia, ditado, questionário e revisão de vocabulário com as frases do livro que você está lendo.',
    html: section('Modos de prática', list(['Fala: leia em voz alta e receba a porcentagem de acerto e as palavras para treinar.', 'Ditado: ouça e escreva a frase.', 'Desafio: questionário sobre a página.', 'Vocabulário: as palavras salvas voltam na hora certa para revisão.', 'Cenas: conversas por voz em situações do dia a dia.'].map(esc))) },
  { path: '/evolucao', title: 'Raio-X do seu inglês e evolução · Upoonly', h1: 'Veja seu inglês evoluir',
    description: 'Raio-X do seu inglês com IA, metas, sequência de estudo e estatísticas de leitura, fala e vocabulário.',
    html: p('O Raio-X analisa suas leituras, práticas e conversas e mostra pontos fortes, dificuldades e um plano de estudo. No Grátis e no Essencial sai um por mês; no Plus, toda semana; no Pro, sob demanda.')
      + section('Acompanhe', list(['Nível do Iniciante ao avançado, calculado pelas palavras e pelos pontos.', 'Sequência de dias de estudo e metas.', 'Histórias de reforço feitas para as suas dificuldades.'].map(esc))) },
  { path: '/recursos', title: 'Todos os recursos do Upoonly', h1: 'Tudo o que o Upoonly faz',
    description: 'Leitor com áudio, ilustrações por IA, tutores de conversação, prática de fala, evolução, biblioteca de clássicos e prova de proficiência.',
    html: list(featureList.map(esc)) + p([['/leitor', 'Leitor'], ['/ilustracoes', 'Ilustrações'], ['/tutores', 'Tutores'], ['/pratica', 'Prática'], ['/evolucao', 'Evolução'], ['/biblioteca', 'Biblioteca'], ['/prova', 'Prova']].map(([h, t]) => a(h, t)).join(' · ')) },
  { path: '/planos', title: 'Planos e preços · Upoonly', h1: 'Escolha como quer ler',
    description: `Plano Grátis, Essencial (${brl(2490)}/mês), Plus (${brl(4490)}/mês) e Pro (${brl(8990)}/mês). No anual, 20% de desconto. Cartão em até 12x ou Pix Automático.`,
    html: p('O primeiro livro é seu no plano Grátis. Nos planos pagos, você abre toda a galeria e recebe novos créditos de IA a cada mês. No anual, você paga 20% menos.')
      + planHtml
      + section('Pagamento', p('Cartão de crédito, com o anual em até 12 vezes, ou Pix Automático. Cancele quando quiser em Configurações > Assinatura; o acesso continua até o fim do período pago. Até 7 dias da primeira compra, reembolso integral.')),
    ld: [APP] },
  { path: '/prova', title: 'Prova de proficiência em inglês com estimativa CEFR · Upoonly', h1: 'Prova de proficiência em inglês',
    description: 'Avaliação de leitura, escuta, escrita e fala no formato das provas internacionais, com relatório e estimativa de nível CEFR no plano Pro.',
    html: p('Uma prova completa em quatro partes, com relatório detalhado e estimativa do nível CEFR (A1 a C2).')
      + section('As quatro partes', list(['Leitura: complete palavras e interprete textos do cotidiano e acadêmicos.', 'Escuta: conversas, avisos e aulas curtas; cada áudio toca uma vez.', 'Escrita: monte frases, escreva um e-mail e defenda uma ideia.', 'Fala: repita frases e responda em voz alta às perguntas de uma entrevista.'].map(esc))) },
  { path: '/sobre', title: 'Sobre o Upoonly', h1: 'Sobre o Upoonly',
    description: 'O Upoonly nasceu para ensinar inglês do jeito que a gente aprende a gostar de ler: dentro das histórias, com áudio, imagens e conversa.',
    html: p('Acreditamos que se aprende uma língua vivendo as histórias escritas nela. Por isso o Upoonly junta clássicos com narração, ilustrações e tutores que conversam sobre o que você leu.') + p(a('/contato', 'Fale com a gente')) },
  { path: '/contato', title: 'Contato · Upoonly', h1: 'Escreva para a gente',
    description: 'Fale com a equipe do Upoonly: dúvidas sobre a conta, assinatura, sugestões de livros e parcerias com escolas. Respondemos em até 2 dias úteis.',
    html: p('Dúvidas sobre a conta, assinatura, sugestões de livros ou parcerias com escolas: use o formulário desta página ou escreva para contato@upoonly.com. Respondemos em até 2 dias úteis.') },
  { path: '/faq', title: 'Perguntas frequentes · Upoonly', h1: DOCS.faq.pt.title, description: 'Respostas sobre planos, créditos de IA, cancelamento, Pix, livros, tutores, ilustrações e privacidade no Upoonly.',
    html: faqBlocks.map(b => section(b.h, ...b.p.map(p))).join(''),
    ld: [{ '@type': 'FAQPage', mainEntity: faqBlocks.map(b => ({ '@type': 'Question', name: b.h, acceptedAnswer: { '@type': 'Answer', text: b.p.join(' ') } })) }] },
  { path: '/terms', title: 'Termos de uso · Upoonly', h1: DOCS.terms.pt.title, description: 'Termos de uso do Upoonly: conta, livros, ilustrações, planos, assinatura, cancelamento, reembolso e comunidade.', html: p(DOCS.terms.pt.intro) + legal('terms') },
  { path: '/privacy', title: 'Política de privacidade · Upoonly', h1: DOCS.privacy.pt.title, description: 'Como o Upoonly trata seus dados pessoais conforme a LGPD: bases legais, operadores, direitos do titular e retenção.', html: p(DOCS.privacy.pt.intro) + legal('privacy') },
  { path: '/conduta', title: 'Código de conduta · Upoonly', h1: DOCS.conduct.pt.title, description: 'Regras da comunidade do Upoonly para publicações, comentários e perfis, como denunciar e as sanções.', html: p(DOCS.conduct.pt.intro) + legal('conduct') },
  { path: '/signup', title: 'Criar conta grátis · Upoonly', h1: 'Crie sua conta grátis', description: 'Crie sua conta no Upoonly e ganhe um livro clássico de presente para aprender inglês lendo. Sem cartão.',
    html: p('Crie a conta com e-mail ou Google e escolha seu primeiro livro da galeria, que fica com você para sempre.') + p(a('/login', 'Já tenho conta')) },
  { path: '/login', title: 'Entrar · Upoonly', h1: 'Entrar no Upoonly', description: 'Entre na sua conta do Upoonly para continuar lendo e conversando em inglês.', html: p(a('/signup', 'Ainda não tem conta? Crie grátis')) },
]

for (const b of BOOKS) {
  const desc = synopsis(b)
  PAGES.push({
    path: `/livro/${b.slug}`, title: `${b.title} em inglês (${b.level}) · Upoonly`, h1: b.title, image: coverUrl(b.slug), imageAlt: `Capa de ${b.title}`,
    description: desc.length > 300 ? desc.slice(0, 297).replace(/\s+\S*$/, '') + '…' : desc,
    html: p(`${b.author} · ${b.category} · nível ${b.level}`) + p(desc)
      + section('Leia no Upoonly', p('Com a página narrada, cada palavra explicada no contexto, ilustrações por IA e um tutor para conversar sobre a história.'), p(a('/signup', 'Começar grátis') + ' · ' + a('/livros', 'Ver todos os livros'))),
    breadcrumb: [['Início', '/'], ['Livros', '/livros'], [b.title, `/livro/${b.slug}`]],
    ld: [{ '@type': 'Book', name: b.title, author: { '@type': 'Person', name: b.author }, inLanguage: 'en', genre: b.category, image: coverUrl(b.slug),
      educationalLevel: `CEFR ${b.level}`, url: `${SITE}/livro/${b.slug}`, description: desc, isAccessibleForFree: true }],
  })
}

// ---------------------------------------------------------------- gravação
const template = readFileSync(join(DIST, 'index.html'), 'utf8')
const setMeta = (html, attr, key, value) => {
  const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`)
  return re.test(html) ? html.replace(re, `$1${esc(value)}$2`) : html.replace('</head>', `    <meta ${attr}="${key}" content="${esc(value)}" />\n  </head>`)
}

function render(page) {
  const url = `${SITE}${page.path === '/' ? '/' : page.path}`
  // Prévia de link sempre com o banner em JPG: o WhatsApp nem sempre mostra .webp. A capa do livro vai no JSON-LD e no sitemap.
  const image = OG_DEFAULT
  let html = template
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`)
  html = setMeta(html, 'name', 'description', page.description)
  html = html.replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`)
  html = setMeta(html, 'property', 'og:url', url)
  html = setMeta(html, 'property', 'og:title', page.title)
  html = setMeta(html, 'property', 'og:description', page.description)
  html = setMeta(html, 'property', 'og:image', image)
  html = setMeta(html, 'property', 'og:image:alt', 'Upoonly: aprenda inglês dentro dos livros. Uma leitora com tablet numa pintura clássica.')
  if (page.path.startsWith('/livro/')) html = setMeta(html, 'property', 'og:type', 'book')
  html = setMeta(html, 'name', 'twitter:title', page.title)
  html = setMeta(html, 'name', 'twitter:description', page.description)
  html = setMeta(html, 'name', 'twitter:image', image)
  const graph = [ORG, WEBSITE,
    { '@type': 'WebPage', '@id': `${url}#page`, url, name: page.title, description: page.description, inLanguage: 'pt-BR', isPartOf: { '@id': `${SITE}/#site` },
      primaryImageOfPage: page.image ?? image, dateModified: TODAY },
    crumbs(page.breadcrumb ?? (page.path === '/' ? [['Início', '/']] : [['Início', '/'], [page.h1, page.path]])),
    ...(page.ld ?? [])]
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')
  html = html.replace('</head>', `    <script type="application/ld+json">${ld}</script>\n  </head>`)
  html = html.replace('<div id="root"></div>', `<div id="root">${body(page.h1, page.html)}</div>`)
  return html
}

let count = 0
for (const page of PAGES) {
  const html = render(page)
  if (page.path === '/') writeFileSync(join(DIST, 'index.html'), html)
  else { const file = join(DIST, `${page.path.slice(1)}.html`); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, html) }
  count++
}

// Sitemap: páginas do site primeiro, depois os livros. Login e cadastro não entram.
const priority = path => path === '/' ? '1.0' : path.startsWith('/livro/') ? '0.6' : ['/planos', '/livros', '/tutores', '/leitor', '/biblioteca'].includes(path) ? '0.9' : ['/terms', '/privacy', '/conduta'].includes(path) ? '0.3' : '0.7'
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`
  + PAGES.filter(pg => !['/login', '/signup'].includes(pg.path)).map(pg => `  <url><loc>${SITE}${pg.path}</loc><lastmod>${TODAY}</lastmod><priority>${priority(pg.path)}</priority>${pg.image ? `<image:image><image:loc>${pg.image}</image:loc></image:image>` : ''}</url>`).join('\n')
  + '\n</urlset>\n'
writeFileSync(join(DIST, 'sitemap.xml'), sitemap)

// llms-full.txt: o conteúdo de referência inteiro, em texto, para agentes de IA.
const md = [
  '# Upoonly — conteúdo completo', '', '> Plataforma brasileira para aprender inglês lendo clássicos, com narração, ilustrações por IA, prática de fala e tutores de IA que conversam por voz sobre o livro. Site: https://www.upoonly.com', '',
  '## Recursos', ...featureList.map(f => `- ${f}`), '',
  '## Planos', ...PLANS.map(pl => `- **${pl.name}**: ${pl.priceCents ? `${brl(pl.priceCents)}/mês ou ${brl(annual(pl.priceCents))}/ano (20% de desconto no anual)` : 'grátis'}; ${pl.credits} créditos de IA por mês. ${pl.benefits.map(b => b.pt).join('; ')}.`),
  '- Pagamento: cartão de crédito (anual em até 12x, juros por conta de quem assina) ou Pix Automático. Cancelamento a qualquer momento; reembolso integral em até 7 dias da primeira compra.', '',
  '## Tutores', ...TUTORS.map(t => `- **${t.name}** (${t.role}): ${t.about} Jeito de falar: ${t.style ?? t.voice} Combina com: ${(t.fits ?? []).join(', ')}.`), '',
  '## Perguntas frequentes', ...faqBlocks.flatMap(b => [`### ${b.h}`, ...b.p, '']),
  `## Livros (${BOOKS.length})`, ...BOOKS.map(b => `- [${b.title}](${SITE}/livro/${b.slug}) — ${b.author}; ${b.category}; nível ${b.level}`), '',
  '## Páginas', ...PAGES.filter(pg => !pg.path.startsWith('/livro/')).map(pg => `- [${pg.title}](${SITE}${pg.path}): ${pg.description}`), '',
].join('\n')
writeFileSync(join(DIST, 'llms-full.txt'), md)

console.log(`seo-prerender: ${count} páginas, sitemap com ${PAGES.length - 2} URLs, llms-full.txt (${Math.round(md.length / 1024)} KB)`)
