// Marca Upoonly em SVG, a mesma da home do site. A cor vem de `currentColor`, então segue o tema (claro/escuro) pelo `color` do pai.
import { MARK_PATH, WORD_PATHS } from './paths'

type Props = { height?: number; className?: string; style?: React.CSSProperties; title?: string }

/** Logotipo completo (coelho e borboleta + "upoonly"). `height` em px; a largura acompanha a proporção. */
export function Logo({ height = 28, className, style, title = 'Upoonly' }: Props) {
  return (
    <svg viewBox="0 0 1904 625" height={height} width={(height * 1904) / 625} className={className} style={{ display: 'block', ...style }}
      role="img" aria-label={title} fill="currentColor">
      <path d={MARK_PATH} />
      {WORD_PATHS.map(d => <path key={d.slice(0, 24)} d={d} />)}
    </svg>
  )
}

/** Só o símbolo (coelho e borboleta), para espaços pequenos (menu recolhido). */
export function LogoMark({ height = 32, className, style, title = 'Upoonly' }: Props) {
  return (
    <svg viewBox="0 0 541 625" height={height} width={(height * 541) / 625} className={className} style={{ display: 'block', ...style }}
      role="img" aria-label={title} fill="currentColor">
      <path d={MARK_PATH} />
    </svg>
  )
}
