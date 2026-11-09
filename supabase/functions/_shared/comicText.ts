import { evenGroups, sentenceSpans } from './comic.ts'
import type { Dialogue } from './comicEditorial.ts'

type TextBeat = { id: string; sourceSentenceIds: number[]; dialogue: Dialogue[] }

/** Cover the source around verbatim balloons with narrator captions, including dialogue tags. */
export function fullComicText(text: string, beats: TextBeat[]): Dialogue[] {
  const spans = sentenceSpans(text)
  const aligned = beats.flatMap(beat => beat.sourceSentenceIds)
  const groups = aligned.length === spans.length && aligned.every((id, i) => id === i)
    && beats.every(beat => beat.sourceSentenceIds.length)
    ? beats.map(beat => [beat.sourceSentenceIds[0], beat.sourceSentenceIds.at(-1)!])
    : spans.length && beats.length ? evenGroups(spans, text, beats.length) : []
  const speech = beats.flatMap(beat => beat.dialogue).filter(line => {
    if (line.balloonType === 'caption') return false
    const parts = line.sourceParts ?? [{ start: line.charStart, end: line.charEnd }]
    return parts.length > 0 && parts.every(({ start, end }) => start >= 0 && start < end && end <= text.length)
      && parts.map(({ start, end }) => text.slice(start, end)).join(' ') === line.text
  })
  const spoken = speech.flatMap(line => line.sourceParts ?? [{ start: line.charStart, end: line.charEnd }])
    .sort((a, b) => a.start - b.start)
  const captions: Dialogue[] = []
  const addCaption = (id: string, from: number, to: number, insideSpeech: boolean) => {
    const source = text.slice(from, to)
    const leading = source.match(insideSpeech ? /^[\s“”«»",]+/u : /^\s+/u)?.[0].length ?? 0
    const trailing = source.match(insideSpeech ? /[\s“”«"]+$/u : /\s+$/u)?.[0].length ?? 0
    const start = from + leading, end = to - trailing
    if (end <= start || !/[^\s“”«»"]/u.test(text.slice(start, end))) return
    captions.push({
      id: `${id}-narration-${start}`, panelId: id, text: text.slice(start, end), balloonType: 'caption',
      attribution: 'narration', speakerId: null, speakerName: null, emotion: '', delivery: '',
      charStart: start, charEnd: end, sourceSentenceIds: [], targetAnchor: null,
      preferredPosition: insideSpeech ? 'bottom-right' : 'top-left', readingOrder: 0,
    })
  }
  for (const [i, beat] of beats.entries()) {
    if (!groups[i] && (i > 0 || groups.length)) continue
    const start = i === 0 ? 0 : spans[groups[i][0]][0]
    const next = groups[i + 1]
    const end = next ? spans[next[0]][0] : text.length
    let cursor = start
    for (const part of spoken) {
      if (part.end <= cursor) continue
      if (part.start >= end) break
      if (part.start > cursor) addCaption(beat.id, cursor, part.start, true)
      cursor = Math.max(cursor, part.end)
    }
    if (cursor < end) addCaption(beat.id, cursor, end, cursor > start)
  }
  return [...speech, ...captions].sort((a, b) => a.charStart - b.charStart)
    .map((line, readingOrder) => ({ ...line, readingOrder }))
}
