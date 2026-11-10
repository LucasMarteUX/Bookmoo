import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'

export type StoryPin = {
  id: string
  bookId: string
  page: number
  kind: 'word' | 'comic'
  wordIndex?: number
  quote?: string
  x?: number
  y?: number
  note: string
  createdAt: number
}

type PinState = {
  pins: StoryPin[]
  setPins: (pins: StoryPin[]) => void
  upsertLocal: (pin: StoryPin) => void
  removeLocal: (id: string) => void
}

export const usePinStore = create<PinState>()(
  persist(
    (set) => ({
      pins: [],
      setPins: (pins) => set({ pins }),
      upsertLocal: (pin) => set(state => ({
        pins: state.pins.some(item => item.id === pin.id)
          ? state.pins.map(item => item.id === pin.id ? pin : item)
          : [...state.pins, pin],
      })),
      removeLocal: (id) => set(state => ({ pins: state.pins.filter(item => item.id !== id) })),
    }),
    { name: 'bookmoo-pins' },
  ),
)

function rowOf(pin: StoryPin, userId: string) {
  return {
    id: pin.id,
    user_id: userId,
    book_id: pin.bookId,
    page: pin.page,
    kind: pin.kind,
    word_index: pin.wordIndex ?? null,
    quote: pin.quote ?? null,
    x: pin.x ?? null,
    y: pin.y ?? null,
    note: pin.note,
  }
}

function pinOf(row: Record<string, unknown>): StoryPin {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    page: Number(row.page) || 0,
    kind: row.kind === 'comic' ? 'comic' : 'word',
    wordIndex: typeof row.word_index === 'number' ? row.word_index : undefined,
    quote: typeof row.quote === 'string' ? row.quote : undefined,
    x: typeof row.x === 'number' ? row.x : undefined,
    y: typeof row.y === 'number' ? row.y : undefined,
    note: typeof row.note === 'string' ? row.note : '',
    createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
  }
}

export async function loadPins(userId: string) {
  if (!supabase) return
  const { data, error } = await supabase.from('story_pins').select('*').eq('user_id', userId)
  if (error || !data) return
  usePinStore.getState().setPins(data.map(row => pinOf(row)))
}

export async function savePin(pin: Omit<StoryPin, 'id' | 'createdAt'> & { id?: string }, userId: string | undefined) {
  const saved: StoryPin = {
    ...pin,
    id: pin.id ?? uuidv4(),
    createdAt: usePinStore.getState().pins.find(item => item.id === pin.id)?.createdAt ?? Date.now(),
  }
  usePinStore.getState().upsertLocal(saved)
  if (supabase && userId) {
    await supabase.from('story_pins').upsert(rowOf(saved, userId), { onConflict: 'id' })
  }
  return saved
}

export async function deletePin(id: string, userId: string | undefined) {
  usePinStore.getState().removeLocal(id)
  if (supabase && userId) await supabase.from('story_pins').delete().eq('id', id).eq('user_id', userId)
}
