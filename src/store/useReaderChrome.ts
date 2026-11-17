import { create } from 'zustand'

/**
 * Leitura imersiva no celular (como Kindle e Apple Books): ao ler, as barras somem e só o texto fica.
 * Um toque mostra ou esconde os controles. As barras marcadas com data-chrome obedecem às classes
 * que este estado coloca no <html> (ver index.css). Nada aqui é salvo, exceto a preferência das bordas.
 */
const EDGE_KEY = 'reader:edge-tap'

function readEdge() {
  try { return localStorage.getItem(EDGE_KEY) !== '0' } catch { return true }
}

interface ReaderChromeState {
  /** Leitor aberto no celular, no modo leitura. */
  immersive: boolean
  /** Controles visíveis. */
  visible: boolean
  /** Tocar nas bordas da tela vira a página (o centro mostra os controles). */
  edgeTap: boolean
  setImmersive: (on: boolean) => void
  show: () => void
  hide: () => void
  toggle: () => void
  setEdgeTap: (on: boolean) => void
}

function apply(immersive: boolean, visible: boolean) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('reader-immersive', immersive)
  root.classList.toggle('reader-chrome-hidden', immersive && !visible)
}

export const useReaderChrome = create<ReaderChromeState>((set, get) => ({
  immersive: false,
  visible: true,
  edgeTap: readEdge(),
  setImmersive: (on) => {
    // Ao entrar, começa mostrando os controles por um instante (a pessoa vê onde estão).
    set({ immersive: on, visible: true })
    apply(on, true)
  },
  show: () => { if (get().visible) return; set({ visible: true }); apply(get().immersive, true) },
  hide: () => { if (!get().visible || !get().immersive) return; set({ visible: false }); apply(get().immersive, false) },
  toggle: () => { const next = !get().visible; set({ visible: next }); apply(get().immersive, next) },
  setEdgeTap: (on) => {
    try { localStorage.setItem(EDGE_KEY, on ? '1' : '0') } catch { /* sem armazenamento */ }
    set({ edgeTap: on })
  },
}))
