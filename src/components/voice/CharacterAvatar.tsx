// Avatar da tutora: a Bia ou o Luck do Bookmoo (personagem 2.5D, ver lib/livliv/characters) ou, se ela não puder ser mostrada
// (sem WebGL2, arquivos que não carregaram, contexto perdido), o desenho vetorial de sempre, sem interromper a conversa.
import { useEffect, useState, type ComponentProps } from 'react'
import { TutorAvatar } from '@/components/voice/TutorAvatar'
import { LivLivAvatar, type HeadBox } from '@/components/voice/LivLivAvatar'
import { useAvatarSettings } from '@/store/useAvatarSettings'
import { characterAvatarUrl, effectiveCharacterId } from '@/lib/livliv/characters'
import { isMobileDevice } from '@/lib/deviceVoice'
import { pickNext, POKES, type ReactionLine } from '@/lib/tutorReactions'

type Props = Omit<ComponentProps<typeof TutorAvatar>, 'onPoke'> & {
  /** Força o personagem (as cenas usam o de mesmo gênero da persona); sem isso vale o escolhido pela pessoa. */
  characterId?: string
  /** Toque: com o personagem 2.5D vem a reação já escolhida (rosto e frase combinam); no vetorial, sorteia uma. */
  onPoke?: (line: ReactionLine) => void
  /** Esta instância fala (as falas do app tocam por ela). Só uma por tela. */
  voice?: boolean
  /** Palco: ocupa o espaço todo do pai (tela de conversa). O vetorial fica centrado e grande. */
  stage?: boolean
  /** Posição da cabeça do personagem LivLiv (para o balão de fala). O vetorial não informa. */
  onHead?: (head: HeadBox | null) => void
}

export function CharacterAvatar({ voice = false, stage = false, onHead, onPoke, characterId: forced, ...props }: Props) {
  const engine = useAvatarSettings(s => s.engine)
  const chosen = useAvatarSettings(s => s.characterId)
  const characterId = effectiveCharacterId(forced ?? chosen)
  const [failed, setFailed] = useState<string | null>(null)
  // Outro personagem: tenta o LivLiv de novo.
  useEffect(() => { setFailed(null) }, [characterId])

  const vector = engine !== 'livliv' || failed === characterId
  useEffect(() => { if (vector) onHead?.(null) }, [vector]) // eslint-disable-line react-hooks/exhaustive-deps
  if (vector) {
    const vectorProps = { ...props, onPoke: () => onPoke?.(pickNext(POKES, null)) }
    return stage ? <div className="absolute inset-0 grid place-items-center"><TutorAvatar {...vectorProps} /></div> : <TutorAvatar {...vectorProps} />
  }
  // Celular: um avatar pequeno e mudo (botão da tutora, ícones) vira a foto do personagem. Cada personagem animado carrega
  // ~130 MB de texturas na placa de vídeo; no celular isso, somado ao resto da página, derrubava o navegador.
  const size = props.size ?? 220
  if (!stage && !voice && size <= 72 && isMobileDevice()) {
    return <img src={characterAvatarUrl(characterId)} alt="" width={size} height={size} className="rounded-full object-cover select-none" style={{ width: size, height: size }} draggable={false} />
  }
  return (
    <LivLivAvatar characterId={characterId} state={props.state} speakingText={props.speakingText} size={props.size} mood={props.mood} wave={props.wave}
      followPointer={props.followPointer} onPoke={onPoke} voice={voice} stage={stage} onHead={onHead} onFail={() => setFailed(characterId)} />
  )
}
