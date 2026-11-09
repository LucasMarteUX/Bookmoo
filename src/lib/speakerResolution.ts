// Descobre quem fala nas falas que a IA deixou "ambíguas", com as mesmas pistas que um leitor usa:
// 1) a marcação de diálogo ao redor ("she suggested", "Nurse answered", "the duke said");
// 2) fala partida pela marcação ("Maybe," she suggested, "he just…") = mesma pessoa;
// 3) quadro com um único personagem; 4) conversa a dois: alterna com quem falou antes.
import type { Character, Dialogue, VisualBeat } from '../../supabase/functions/_shared/comicEditorial'

type Gender = 'female' | 'male' | null
const STOP = new Set(['of', 'the', 'and', 'de', 'da', 'do', 'von', 'van', 'group', 'baby', 'toddler', 'young', 'old', 'at', 'feast', 'aristocrats', 'wife'])
const FEMALE = /\b(woman|women|female|lady|girl|she|her|nurse|duchess|mother|wife|queen|princess|aunt|sister|daughter|mrs|miss|madam|maid|countess)\b/i
const MALE = /\b(man|men|male|gentleman|boy|he|his|duke|father|husband|king|prince|uncle|brother|son|mr|sir|lord|earl|baker|blacksmith|count)\b/i

function genderOf(c: Character): Gender {
  const name = c.name.toLowerCase()
  if (FEMALE.test(name)) return 'female'
  if (MALE.test(name)) return 'male'
  const looks = c.visualDescription ?? ''
  const f = FEMALE.test(looks), m = MALE.test(looks)
  return f && !m ? 'female' : m && !f ? 'male' : null
}

const tokens = (c: Character) => c.name.toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-zà-ÿ']+/).filter(t => t.length >= 3 && !STOP.has(t))

/** Trecho de narração logo depois / antes da fala (fora das aspas, até o fim da frase). */
function tagAfter(text: string, end: number) {
  const rest = text.slice(end, end + 90)
  const stop = rest.search(/[“"«]|[.!?](\s|$)/)
  return (stop >= 0 ? rest.slice(0, stop + 1) : rest).replace(/^[\s”"»,]+/, '')
}
function tagBefore(text: string, start: number) {
  const head = text.slice(Math.max(0, start - 90), start)
  const cut = Math.max(head.lastIndexOf('”'), head.lastIndexOf('"'), head.search(/[.!?]\s[^.!?]*$/) >= 0 ? head.search(/[.!?]\s[^.!?]*$/) + 1 : -1)
  return head.slice(cut + 1)
}

function speakerFromTag(tag: string, cast: Character[]): Character | null {
  const lower = tag.toLowerCase()
  const byName = cast.filter(c => tokens(c).some(t => new RegExp(`\\b${t.replace(/[^a-zà-ÿ']/g, '')}\\b`).test(lower)))
  if (byName.length === 1) return byName[0]
  const pronoun = /\bshe\b|\bher\b/.test(lower) ? 'female' : /\bhe\b|\bhis\b|\bhim\b/.test(lower) ? 'male' : null
  if (pronoun) {
    const match = cast.filter(c => genderOf(c) === pronoun)
    if (match.length === 1) return match[0]
  }
  return null
}

export function resolveSpeakers(lines: Dialogue[], beats: Pick<VisualBeat, 'id' | 'cast'>[], characters: Character[], text: string): Dialogue[] {
  const byId = new Map(characters.filter(c => c.id).map(c => [c.id!, c]))
  const sorted = [...lines].sort((a, b) => a.charStart - b.charStart)
  const out = new Map<string, Dialogue>()
  const assign = (line: Dialogue, c: Character) => out.set(line.id, { ...line, speakerId: c.id!, speakerName: c.name, attribution: 'confirmed' })
  const speech = (l: Dialogue) => l.balloonType !== 'caption'
  const castOf = (panelId: string) => (beats.find(b => b.id === panelId)?.cast ?? []).flatMap(id => byId.get(id) ?? [])
  const current = (l: Dialogue) => out.get(l.id) ?? l

  // Passadas 1–3: marcação de diálogo, fala partida e quadro de um personagem só.
  sorted.forEach((line, i) => {
    if (!speech(line) || (line.speakerId && line.attribution !== 'ambiguous')) return
    const cast = castOf(line.panelId)
    const parts = line.sourceParts?.length ? line.sourceParts : [{ start: line.charStart, end: line.charEnd }]
    const start = parts[0].start, end = parts[parts.length - 1].end
    // A narração logo antes só vale como pista se não houver outra fala colada antes dela
    // ("I don't know," Nurse answered. "What have you done…" — a marcação é da fala anterior).
    const prev = sorted.slice(0, i).reverse().find(speech)
    const beforeIsOwn = !prev || start - prev.charEnd > 110
    const fromTag = speakerFromTag(tagAfter(text, end), cast) ?? (beforeIsOwn ? speakerFromTag(tagBefore(text, start), cast) : null)
    if (fromTag) { assign(line, fromTag); return }
    // "Maybe," she suggested, "he just…": a fala seguinte, logo depois da marcação, é da mesma pessoa.
    if (prev && /,\s*$/.test(text.slice(prev.charStart, prev.charEnd)) && start - prev.charEnd < 60) {
      const tag = text.slice(prev.charEnd, start)
      // Fala partida de verdade: a marcação também termina em vírgula ("…she suggested, “he just…").
      const who = /,\s*[“"«]?\s*$/.test(tag) ? speakerFromTag(tag, cast) : null
      if (who) { assign(line, who); if (!current(prev).speakerId) assign(prev, who); return }
    }
    if (cast.length === 1) assign(line, cast[0])
  })

  // Passada 4: conversa a dois sem pista — alterna com quem falou por último no quadro.
  for (const line of sorted) {
    const now = current(line)
    if (!speech(now) || now.speakerId) continue
    const cast = castOf(line.panelId)
    if (cast.length !== 2) continue
    const before = sorted.filter(l => l.charStart < line.charStart && l.panelId === line.panelId).map(current).reverse().find(l => speech(l) && l.speakerId)
    if (!before) continue
    const other = cast.find(c => c.id !== before.speakerId)
    if (other) assign(line, other)
  }
  return lines.map(line => out.get(line.id) ?? line)
}
