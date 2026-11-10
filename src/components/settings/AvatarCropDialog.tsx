import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

/** Recorte redondo: a pessoa arrasta a foto e aproxima até o rosto ficar no lugar. */
export function AvatarCropDialog({
  file, pt, onClose, onSave,
}: {
  file: File | null
  pt: boolean
  onClose: () => void
  onSave: (blob: Blob) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    if (!file) { setImage(null); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { setImage(img); setZoom(1); setOffset({ x: 0, y: 0 }) }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const size = 320
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, size, size)
    const base = Math.max(size / image.width, size / image.height) * zoom
    const w = image.width * base
    const h = image.height * base
    ctx.save()
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(image, (size - w) / 2 + offset.x, (size - h) / 2 + offset.y, w, h)
    ctx.restore()
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
    ctx.stroke()
  }, [image, zoom, offset])

  const save = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const out = document.createElement('canvas')
    out.width = 512
    out.height = 512
    const ctx = out.getContext('2d')
    if (!ctx) return
    ctx.drawImage(canvas, 0, 0, 512, 512)
    out.toBlob(blob => { if (blob) onSave(blob) }, 'image/jpeg', 0.9)
  }

  return (
    <Dialog open={!!file} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{pt ? 'Ajustar foto' : 'Adjust photo'}</DialogTitle>
        <p className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Arraste para posicionar. O círculo é o que as outras pessoas veem.' : 'Drag to position. The circle is what other people see.'}
        </p>
        <canvas
          ref={canvasRef}
          className="mx-auto rounded-full cursor-grab touch-none"
          style={{ width: 240, height: 240, backgroundColor: 'var(--theme-bg-secondary)' }}
          onPointerDown={e => {
            (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
            drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
          }}
          onPointerMove={e => {
            if (!drag.current) return
            setOffset({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y })
          }}
          onPointerUp={() => { drag.current = null }}
        />
        <label className="block text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Aproximar' : 'Zoom'}
          <input type="range" min={1} max={3} step={0.02} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-full mt-1" />
        </label>
        <button type="button" onClick={save} className="h-10 rounded-lg text-[14px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
          {pt ? 'Usar esta foto' : 'Use this photo'}
        </button>
      </DialogContent>
    </Dialog>
  )
}
