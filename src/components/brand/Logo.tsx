// Marca Upoonly em SVG. A cor vem de `currentColor`, então segue o tema (claro/escuro) pelo `color` do pai.
import { MARK_PATH, WORD_PATHS } from './paths'

type Props = { height?: number; className?: string; style?: React.CSSProperties; title?: string }

/** Logotipo completo (símbolo + "upoonly"). `height` em px; a largura acompanha a proporção. */
export function Logo({ height = 28, className, style, title = 'Upoonly' }: Props) {
  return (
    <svg viewBox="0 0 1885 434" height={height} width={(height * 1885) / 434} className={className} style={{ display: 'block', ...style }}
      role="img" aria-label={title} fill="currentColor">
      <path d={MARK_PATH} stroke="currentColor" strokeWidth={2} />
      {WORD_PATHS.map(d => <path key={d.slice(0, 24)} d={d} />)}
    </svg>
  )
}

/** Só o símbolo, para espaços pequenos (menu recolhido). */
export function LogoMark({ height = 32, className, style, title = 'Upoonly' }: Props) {
  return (
    <svg viewBox="-2 28 389 332" height={height} width={(height * 389) / 332} className={className} style={{ display: 'block', ...style }}
      role="img" aria-label={title} fill="currentColor">
      <path d={MARK_PATH} stroke="currentColor" strokeWidth={2} />
    </svg>
  )
}
