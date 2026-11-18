// Personagens 2.5D do Bookmoo, tocados pelo LivLiv Player (https://github.com/livliv-dev/player, Apache-2.0).
// Os desenhos são NOSSOS: arquivos em public/characters/bookmoo/<pasta> (model.json + textures/), no formato LivLiv v4,
// sem licença de terceiros e sem marca d'água. Para acrescentar outro (homem, menina, menino): copie a pasta do rig para
// public/characters/bookmoo/<pasta> e inclua uma linha em CHARACTERS (a Bia, o Luck, a Yuno e o Yuri já estão).
import type { SpeakerVoice } from '@/lib/speakerVoice'

export type Character = {
  id: string
  /** Nome com que ela se apresenta na conversa. */
  name: string
  pt: string
  en: string
  /** Voz: gênero e tom (1 = natural; acima, mais jovem). A voz é uma das Kokoro instaladas. */
  voice: SpeakerVoice
  /** Pasta em public/characters/bookmoo. */
  folder: string
  /** Tem as camadas de gesto do corpo (gesto_enfase, gesto_explicativo...): o corpo acompanha a fala. */
  gestures?: boolean
  /** O corpo está no mesmo grupo da cabeça (Bia, Yuno, Yuri): o desenho gira inteiro, então a base é compensada. O Luck tem grupo próprio. */
  bodyInHead?: boolean
  /** Usa `model.app.json`: o rig aprovado (model.json, intacto) com o corpo e os gestos no grupo `body`, para o tronco inclinar
   *  como o do Luck (deforma suave para o lado, base fixa) em vez de girar o desenho inteiro como um pêndulo. */
  appModel?: boolean
  /** Quanto deslocar o desenho (fração da largura) por grau de inclinação para a base ficar parada. Medido em cada rig: o ponto
   *  de giro muda de um para outro (na Yuno fica acima da base, então o sinal é oposto). */
  basePerDeg?: number
  /** Quanto do corpo aparece no palco: abaixo de 1 afasta o enquadramento e mostra um pouco mais do corpo. */
  zoomK?: number
  /** Inclinação inicial da cabeça em graus (o encaixe aprovado da Yuno pede -4). */
  baseAngleZ?: number
  /** Mais jovem: indicada para assuntos infantis. */
  young?: boolean
}

const WOMAN: SpeakerVoice = { gender: 'female', pitch: 1 }
const MAN: SpeakerVoice = { gender: 'male', pitch: 1 }
// Yuno: voz feminina um pouco mais fina e jovem que a da Bia.
// Yuno: menina adolescente. Voz feminina mais leve (Bella/Nicole) e tom bem mais alto: com 1,14 soava como mulher adulta.
const TEEN: SpeakerVoice = { gender: 'female', pitch: 1.05, prefer: ['af_sky', 'af_nova', 'af_kore', 'af_bella'] }
// Yuri: voz masculina jovem e mais fina: as vozes mais leves primeiro (se estiverem instaladas), com mais tom que a Yuno.
// Yuri: menino adolescente. Com 1,2 a voz masculina ainda soava grossa; vai ao máximo do Kokoro (1,35) com a voz mais leve.
const TEEN_BOY: SpeakerVoice = { gender: 'male', pitch: 1.06, prefer: ['am_liam', 'am_puck', 'am_echo'] }

export const CHARACTERS: Character[] = [
  { id: 'bookmoo-mulher', name: 'Bia', pt: 'Mulher', en: 'Woman', voice: WOMAN, folder: 'mulher', zoomK: 0.9, gestures: true, appModel: true, baseAngleZ: 0 },
  { id: 'bookmoo-homem', name: 'Luck', pt: 'Homem', en: 'Man', voice: MAN, folder: 'homem', zoomK: 0.9, gestures: true, baseAngleZ: 0 },
  { id: 'bookmoo-yuno', name: 'Yuno', pt: 'Jovem', en: 'Teen', voice: TEEN, folder: 'yuno', gestures: true, appModel: true, baseAngleZ: -4, young: true },
  { id: 'bookmoo-yuri', name: 'Yuri', pt: 'Jovem', en: 'Teen', voice: TEEN_BOY, folder: 'yuri', gestures: true, appModel: true, baseAngleZ: 0, young: true },
]

export const DEFAULT_CHARACTER = 'bookmoo-mulher'
/** Sugerida nos assuntos infantis. */
export const YOUNG_CHARACTER = 'bookmoo-yuno'

export function characterById(id: string) { return CHARACTERS.find(c => c.id === id) }

/** O personagem a usar: o escolhido, ou o padrão se o salvo não existe mais (por exemplo, um de testes antigos). */
export function effectiveCharacterId(id: string | null | undefined) { return id && characterById(id) ? id : DEFAULT_CHARACTER }

const BASE = '/characters/bookmoo'
// Versão dos arquivos dos personagens: muda sempre que uma textura é trocada. A query vai junto com cada arquivo que o
// player busca, então o navegador não reaproveita a imagem antiga do cache.
const ASSET_REV = '20261124-webp'
export function characterModelUrl(id: string) {
  const c = characterById(effectiveCharacterId(id))!
  // Pacote WebP (web/): as mesmas texturas em resolução total, sem perda, ~30% menores para baixar. Gerado por
  // scripts/characters/webp-pack.sh a partir de model.app.json (Bia, Yuno, Yuri) ou model.json (Luck).
  return `${BASE}/${c.folder}/web/model.json?v=${ASSET_REV}`
}
export function characterAvatarUrl(id: string) { return `${BASE}/${characterById(effectiveCharacterId(id))!.folder}/avatar.webp` }
