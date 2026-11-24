// Entrada suave ao rolar em todo o site: títulos, textos, imagens, cartões e botões sobem e aparecem quando entram
// na tela. Usa `translate` e `opacity` (não mexe no `transform` das animações do motion). Respeita "reduzir movimento".
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const TARGETS = [
  'h2', 'h3', '.journey-label', '.sc-kicker', '.st-kicker',
  'main p:not(.excerpt-word)', 'blockquote', 'figure', '.s-btn', '.sc-btn', '.chapter-options',
  '.books-item', '.shelf-print', '.sc-plan', '.next-index a', '.practice-options button', '.st-tutor-index button',
  '.folio-sample', '.practice-board', '.book-profile-tools li', '.sc-tile', '.sc-cast-card', '.s-card',
].join(',')
// Áreas com animação própria (abertura, cenas fixas que rolam por dentro, carrosséis).
const SKIP = '.book-prologue, .flight-intro, .garden-sequence, .reading-light-stage, .atelier-stage, .st-tutors-pin, .sc-gal, .s-marquee, .conversation-prelude, .public-header, .public-footer, dialog'

export function useScrollReveal() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const main = document.getElementById('conteudo')
    if (!main) return
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const el = e.target as HTMLElement
        el.dataset.rvIn = '1'
        io.unobserve(el)
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
    let frame = 0
    // Cada execução observa os seus (no modo estrito do React o efeito roda duas vezes).
    const seen = new WeakSet<HTMLElement>()
    const scan = () => {
      const vh = innerHeight
      main.querySelectorAll<HTMLElement>(TARGETS).forEach(el => {
        if (seen.has(el) || el.dataset.rvIn || el.closest(SKIP)) return
        // Um alvo dentro de outro alvo anima junto com o de fora.
        if (el.parentElement?.closest('[data-rv]')) return
        seen.add(el)
        el.dataset.rv = '1'
        // Escalona irmãos (cartões, itens de lista) para entrarem em sequência.
        const sibs = el.parentElement ? [...el.parentElement.children].filter(c => (c as HTMLElement).dataset?.rv) : []
        el.style.setProperty('--rv-d', `${Math.min(sibs.length - 1, 6) * 70}ms`)
        // O que já está na tela ao carregar entra também, mas sem esperar a rolagem.
        if (el.getBoundingClientRect().top < vh * 0.92) requestAnimationFrame(() => el.dataset.rvIn = '1')
        else io.observe(el)
      })
    }
    // A página carrega aos poucos (lazy): reescaneia quando o conteúdo muda.
    const mo = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(scan) })
    scan()
    mo.observe(main, { childList: true, subtree: true })
    return () => { io.disconnect(); mo.disconnect(); cancelAnimationFrame(frame) }
  }, [pathname])
}
