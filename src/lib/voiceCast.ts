// Elenco de vozes do livro: cada personagem fala com uma voz fixa do gênero dele (e mais leve se
// for criança); a narração usa a voz escolhida pelo aluno. O aluno pode trocar a voz de qualquer um.
import type { Character } from '../../supabase/functions/_shared/comicEditorial'
import { KOKORO_VOICES } from '@/lib/kokoro/voices'

export type VoiceGroup = 'woman' | 'man' | 'girl' | 'boy' | 'other'

const FEMALE = /\b(woman|women|female|lady|ladies|girl|she|her|nurse|duchess|mother|mum|mom|wife|queen|princess|aunt|sister|daughter|niece|grandmother|mrs|miss|ms|madam|maid|countess|baroness|widow|bride|actress|waitress|heroine)\b/i
const MALE = /\b(man|men|male|gentleman|boy|he|his|duke|father|dad|husband|king|prince|uncle|brother|son|nephew|grandfather|mr|sir|lord|earl|baron|count|baker|blacksmith|groom|actor|waiter|hero|monk|priest)\b/i
const CHILD = /\b(child|children|kid|baby|toddler|infant|little|young boy|young girl|boy|girl|son|daughter|schoolboy|schoolgirl|\d\s?-?year-?old)\b/i
const ADULT_AGE = /\b(1[3-9]|[2-9]\d)\s?-?year-?old\b/i
// Animais e objetos animados: seguem o gênero quando a história deixa claro; filhotes = voz jovem.
const ANIMAL = /\b(dog|cat|horse|pony|bird|fox|wolf|bear|rabbit|bunny|hare|mouse|mice|rat|owl|dragon|lion|tiger|pig|cow|bull|sheep|goat|duck|goose|frog|toad|fish|whale|dolphin|monkey|ape|elephant|giraffe|deer|squirrel|hedgehog|badger|otter|snake|turtle|tortoise|spider|bee|butterfly|animal|creature|beast|robot|android|toy|doll|puppet|teapot|clock|candle|car|train|tree|ghost|spirit)\b/i
const ANIMAL_FEMALE = /\b(she|her|female|mare|hen|cow|ewe|doe|nanny|lioness|tigress|vixen|she-wolf|sow|queen|princess|mother|mama|lady|girl|miss|mrs|duchess)\b/i
const ANIMAL_MALE = /\b(he|his|male|stallion|rooster|cockerel|bull|ram|buck|billy|lion|tomcat|tom|boar|king|prince|father|papa|sir|mister|mr|boy|lord)\b/i
const YOUNG = /\b(puppy|pup|kitten|kitty|cub|foal|chick|duckling|calf|lamb|kid|piglet|bunny|fawn|joey|baby|little|young)\b/i

function animalGroup(name: string, looks: string): VoiceGroup {
  const all = `${name} ${looks}`
  const female = ANIMAL_FEMALE.test(name) || (ANIMAL_FEMALE.test(looks) && !ANIMAL_MALE.test(looks))
  const male = !female && (ANIMAL_MALE.test(name) || ANIMAL_MALE.test(looks))
  const young = YOUNG.test(all)
  if (female) return young ? 'girl' : 'woman'
  if (male) return young ? 'boy' : 'man'
  return 'other'
}

/** Gênero/idade a partir do nome e da descrição visual do personagem. */
export function voiceGroupOf(c: Character): VoiceGroup {
  const name = c.name.toLowerCase()
  const looks = c.visualDescription ?? ''
  const all = `${name} ${looks}`
  // Animal ou objeto animado: usa o gênero se a história deixar claro (she/he, mare, rooster…).
  const humanWords = /\b(woman|man|lady|gentleman|girl|boy|person|human)\b/i
  if (ANIMAL.test(name) || (ANIMAL.test(looks) && !humanWords.test(all))) return animalGroup(name, looks)
  const female = FEMALE.test(name) || (!MALE.test(name) && FEMALE.test(looks) && !MALE.test(looks))
  const male = !female && (MALE.test(name) || MALE.test(looks))
  const child = (CHILD.test(name) || (CHILD.test(looks) && !ADULT_AGE.test(looks))) && !/\b(mother|father|wife|husband|nurse|duke|duchess)\b/i.test(name)
  if (female) return child ? 'girl' : 'woman'
  if (male) return child ? 'boy' : 'man'
  return 'other'
}

// Três vozes no livro todo: narrador, feminina e masculina (só duas vozes extras para baixar).
// Mulheres e meninas usam a feminina; homens e meninos, a masculina (crianças um pouco mais rápidas).
// Sem gênero claro (animal/objeto), fala com a voz do narrador.
export const CHILD_SPEED = 1.08
const FEMALE_DEFAULTS = ['af_bella', 'bf_emma', 'af_heart', 'af_sarah']
const MALE_DEFAULTS = ['am_michael', 'bm_george', 'am_fenrir', 'bm_fable']

export type VoiceRole = 'female' | 'male' | 'narrator'
export type VoiceSettings = { femaleVoice?: string; maleVoice?: string; voiceRoles?: Record<string, VoiceRole> }
export type VoiceCast = Record<string, { voice: string; group: VoiceGroup; role: VoiceRole }>

export function defaultFemaleVoice(narrator: string | null) { return FEMALE_DEFAULTS.find(v => v !== narrator)! }
export function defaultMaleVoice(narrator: string | null) { return MALE_DEFAULTS.find(v => v !== narrator)! }

export function roleOf(group: VoiceGroup): VoiceRole {
  return group === 'woman' || group === 'girl' ? 'female' : group === 'man' || group === 'boy' ? 'male' : 'narrator'
}

export function buildVoiceCast(characters: Character[], narrator: string | null, settings: VoiceSettings = {}): VoiceCast {
  const valid = new Set(KOKORO_VOICES.map(v => v.id))
  const female = settings.femaleVoice && valid.has(settings.femaleVoice) ? settings.femaleVoice : defaultFemaleVoice(narrator)
  const male = settings.maleVoice && valid.has(settings.maleVoice) ? settings.maleVoice : defaultMaleVoice(narrator)
  const cast: VoiceCast = {}
  for (const c of characters) {
    if (!c.id) continue
    const group = voiceGroupOf(c)
    const role = settings.voiceRoles?.[c.id] ?? roleOf(group)
    cast[c.id] = { voice: role === 'female' ? female : role === 'male' ? male : (narrator ?? female), group, role }
  }
  return cast
}

export const GROUP_LABEL: Record<VoiceGroup, { pt: string; en: string }> = {
  woman: { pt: 'Mulher', en: 'Woman' },
  man: { pt: 'Homem', en: 'Man' },
  girl: { pt: 'Menina', en: 'Girl' },
  boy: { pt: 'Menino', en: 'Boy' },
  other: { pt: 'Outro / animal', en: 'Other / animal' },
}
