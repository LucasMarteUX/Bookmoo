// Contexto do tutor flutuante (a bolinha que fica em todas as telas):
// - book: o livro aberto agora (a conversa fala dele); sem livro, é uma conversa livre para tirar dúvidas.
// - focus: telas que pedem atenção total (teste de nível em andamento) escondem o tutor enquanto estiverem ativas.
import { create } from 'zustand'
import type { Book } from '@/store/useBookStore'

type TutorDock = {
  book: Book | null
  focus: number
  /** Um chat com tutor aberto em tela cheia no celular: a tab bar sai para o chat ir até embaixo. */
  chatOpen: boolean
  setChatOpen: (open: boolean) => void
  setBook: (book: Book | null) => void
  enterFocus: () => () => void
}

export const useTutorDock = create<TutorDock>((set) => ({
  book: null,
  focus: 0,
  chatOpen: false,
  setChatOpen: (chatOpen) => set({ chatOpen }),
  setBook: (book) => set({ book }),
  enterFocus: () => {
    set(s => ({ focus: s.focus + 1 }))
    let done = false
    return () => { if (!done) { done = true; set(s => ({ focus: Math.max(0, s.focus - 1) })) } }
  },
}))
