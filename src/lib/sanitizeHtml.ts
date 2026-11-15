// Filtro de HTML por lista de permissão, para texto formatado que o próprio usuário edita (anotações).
// Só passam tags de formatação simples; atributos são descartados (exceto href seguro nos links).
const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'BR', 'P', 'DIV', 'SPAN', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'CODE', 'A'])
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'LINK', 'META'])

export function sanitizeHtml(input: string): string {
  if (!input) return ''
  const doc = new DOMParser().parseFromString(`<body>${input}</body>`, 'text/html')
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (DROP_WITH_CONTENT.has(child.tagName.toUpperCase())) { child.remove(); continue }
      if (!ALLOWED.has(child.tagName)) {
        walk(child)
        child.replaceWith(...Array.from(child.childNodes)) // mantém o texto, tira a tag
        continue
      }
      for (const attr of Array.from(child.attributes)) {
        const ok = child.tagName === 'A' && attr.name === 'href' && /^(https?:|mailto:)/i.test(attr.value.trim())
        if (!ok) child.removeAttribute(attr.name)
      }
      if (child.tagName === 'A') { child.setAttribute('rel', 'noopener noreferrer nofollow'); child.setAttribute('target', '_blank') }
      walk(child)
    }
  }
  walk(doc.body)
  return doc.body.innerHTML
}
