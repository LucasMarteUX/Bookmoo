// Trechos de fala da página com a voz de quem fala (para a leitura trocar de voz nas aspas).
// Página com HQ: usa as falas do quadrinho, com o falante resolvido. Só texto: acha as aspas e usa as
// pistas de diálogo ("she said", nomes); sem personagem conhecido, "she"/"he" já escolhe a voz.
import type { Character, Dialogue, EditorialLayout } from '../../supabase/functions/_shared/comicEditorial'
import type { ComicLayout } from '@/lib/ai'
import { fullComicText } from '../../supabase/functions/_shared/comicText'
import { resolveSpeakers } from '@/lib/speakerResolution'
import { CHILD_SPEED, type VoiceCast } from '@/lib/voiceCast'

export type VoiceSpan = { start: number; end: number; voice: string; child?: boolean }

void CHILD_SPEED

/** Sem personagem conhecido: "she"/"he" na marcação escolhe a voz feminina/masculina do livro. */
function genericVoice(tag: string, voices: { female: string; male: string }): string | undefined {
  const lower = tag.toLowerCase()
  return /\b(she|her)\b/.test(lower) ? voices.female : /\b(he|his|him)\b/.test(lower) ? voices.male : undefined
}

export function speechSpans(text: string, layout: ComicLayout | undefined, characters: Character[], cast: VoiceCast, narrator: string | null, voices: { female: string; male: string }): VoiceSpan[] {
  if (!text) return []
  let lines: Dialogue[]
  if (layout && layout.v === 3) {
    const l = layout as EditorialLayout
    lines = resolveSpeakers(fullComicText(text, l.beats), l.beats, characters, text)
  } else {
    // Só texto: cada trecho entre aspas vira uma fala candidata.
    lines = [...text.matchAll(/[“"]([^”"]{1,600})[”"]/g)].map((m, i) => {
      const start = m.index! + 1
      return {
        id: `q${i}`, panelId: 'page', text: m[1], balloonType: 'speech' as const, attribution: 'ambiguous' as const,
        speakerId: null, speakerName: null, emotion: '', delivery: '', charStart: start, charEnd: start + m[1].length,
        sourceSentenceIds: [], targetAnchor: null, preferredPosition: 'top-left' as const, readingOrder: i,
      }
    })
    lines = resolveSpeakers(lines, [{ id: 'page', cast: characters.flatMap(c => c.id ? [c.id] : []) }], characters, text)
  }
  const spans: VoiceSpan[] = []
  for (const line of lines) {
    if (line.balloonType === 'caption') continue
    const who = line.speakerId ? cast[line.speakerId] : undefined
    const parts = line.sourceParts?.length ? line.sourceParts : [{ start: line.charStart, end: line.charEnd }]
    const voice = who?.voice ?? genericVoice(text.slice(parts[parts.length - 1].end, parts[parts.length - 1].end + 60), voices)
    if (!voice || voice === narrator) continue
    for (const part of parts) spans.push({ start: part.start, end: part.end, voice, child: who?.group === 'girl' || who?.group === 'boy' })
  }
  return spans.sort((a, b) => a.start - b.start)
}
