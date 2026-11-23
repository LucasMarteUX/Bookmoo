// O coelho do logotipo olhando a borboleta (mexe a cabeça, as orelhas e a patinha). `loop` continua animando.
import './rabbit-flight.css'

export function RabbitFlight({ width = 120, loop = false, className }: { width?: number; loop?: boolean; className?: string }) {
  return (
    <div className={`rabbit-flight ${className ?? ''}`} data-loop={loop} aria-hidden style={{ ['--rf-w' as string]: `${width}px` }}>
      <i className="fr fr-body" /><i className="fr fr-paw" />
      <span className="fr-head"><i className="fr fr-face" /><i className="fr fr-ears" /></span>
      <div className="flight-butterfly"><i /><b /></div>
    </div>
  )
}
