// Conversas do chat flutuante, uma por tutor (como num app de mensagens): as últimas mensagens de cada um ficam guardadas
// no aparelho e voltam ao abrir o chat. `active` é o tutor da conversa aberta (o chat pode falar com qualquer um, sem
// trocar o tutor escolhido para o resto do app).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ChatMessage = { role: 'user' | 'ai'; text: string; at: number; via?: 'text' | 'voice' | 'call' }

const KEEP = 60
/** bookId das palavras salvas nas conversas com os tutores fora de um livro (o vocabulário mostra a origem). */
export const TUTOR_CHAT_BOOK = 'tutor-chat'

type TutorChats = {
  active: string | null
  chats: Record<string, ChatMessage[]>
  setActive: (id: string | null) => void
  add: (tutorId: string, msg: ChatMessage) => void
  clear: (tutorId: string) => void
}

export const useTutorChats = create<TutorChats>()(persist((set) => ({
  active: null,
  chats: {},
  setActive: (active) => set({ active }),
  add: (tutorId, msg) => set(s => ({ chats: { ...s.chats, [tutorId]: [...(s.chats[tutorId] ?? []), msg].slice(-KEEP) } })),
  clear: (tutorId) => set(s => ({ chats: { ...s.chats, [tutorId]: [] } })),
}), { name: 'bookmoo-tutor-chats' }))
