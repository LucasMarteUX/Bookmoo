import { askConfirm } from '@/components/ui/confirm'
// Peças pequenas da camada social, reaproveitadas no feed, no perfil, nas listas e na galeria.
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Ban, Check, Flag, Globe, Link2, Lock, MoreHorizontal, Star, UserCheck, UserMinus, Users, UserX, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LevelBadge } from '@/components/ui/level-badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from '@/components/ui/toast'
import type { Author, Relation } from '@/lib/communityProfile'
import {
  acceptFriendRequest, blockUser, errorText, removeFollower, removeFriendship, report, sendFriendRequest, unblockUser,
  type Audience, type ReportReason, type ReportTarget, type ReviewVisibility,
} from '@/lib/social'
import { cn } from '@/lib/utils'
import { FollowButton } from './FollowButton'

export const muted = { color: 'var(--theme-text-secondary)' }
export const cardStyle = { borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }

// ─── Estrelas (0,5 a 5) ───

/** Mostra a nota. Meia estrela recortada, sem imagens. */
export function RatingStars({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} role="img" aria-label={`${value.toLocaleString()} / 5`}>
      {[1, 2, 3, 4, 5].map(star => {
        const fill = Math.max(0, Math.min(1, value - (star - 1)))
        return (
          <span key={star} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0" style={{ width: size, height: size, color: 'var(--theme-border)' }} fill="currentColor" strokeWidth={0} />
            {fill > 0 && (
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star style={{ width: size, height: size, color: 'var(--pastel-amber-fg)' }} fill="currentColor" strokeWidth={0} />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

/** Escolher a nota: metade esquerda da estrela vale meia. Funciona por teclado (setas). */
export function RatingInput({ value, onChange, pt }: { value: number; onChange: (value: number) => void; pt: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value
  return (
    <div className="inline-flex items-center gap-3">
      <div role="slider" tabIndex={0} aria-label={pt ? 'Nota' : 'Rating'} aria-valuemin={0.5} aria-valuemax={5} aria-valuenow={value || undefined}
        className="inline-flex items-center gap-1 rounded-lg outline-offset-4"
        onKeyDown={e => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(5, (value || 0) + 0.5)) }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0.5, (value || 1) - 0.5)) }
        }}
        onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map(star => (
          <span key={star} className="relative w-8 h-8 cursor-pointer">
            <RatingStars value={Math.max(0, Math.min(1, shown - (star - 1)))} size={32} className="absolute inset-0 [&>span:not(:first-child)]:hidden" />
            <button type="button" aria-label={`${star - 0.5}`} className="absolute inset-y-0 left-0 w-1/2" tabIndex={-1}
              onMouseEnter={() => setHover(star - 0.5)} onClick={() => onChange(star - 0.5)} />
            <button type="button" aria-label={`${star}`} className="absolute inset-y-0 right-0 w-1/2" tabIndex={-1}
              onMouseEnter={() => setHover(star)} onClick={() => onChange(star)} />
          </span>
        ))}
      </div>
      <span className="text-[14px] tabular-nums font-medium w-8">{shown ? shown.toLocaleString(pt ? 'pt-BR' : 'en-US', { minimumFractionDigits: 1 }) : '–'}</span>
    </div>
  )
}

// ─── Audiência ───

export function audienceLabel(audience: Audience | ReviewVisibility, pt: boolean) {
  const labels: Record<string, [string, string]> = {
    public: ['Todos', 'Everyone'],
    followers: ['Seguidores', 'Followers'],
    friends: ['Amigos', 'Friends'],
    private: ['Só eu', 'Only me'],
  }
  return labels[audience][pt ? 0 : 1]
}

export function AudienceIcon({ audience, className }: { audience: Audience | ReviewVisibility; className?: string }) {
  const Icon = audience === 'public' ? Globe : audience === 'followers' ? Users : audience === 'friends' ? UserCheck : Lock
  return <Icon className={cn('w-3.5 h-3.5', className)} aria-hidden />
}

export function AudienceSelect<T extends Audience | ReviewVisibility>({ value, onChange, options, pt }: { value: T; onChange: (value: T) => void; options: T[]; pt: boolean }) {
  return (
    <label className="relative inline-flex items-center">
      <AudienceIcon audience={value} className="absolute left-3 pointer-events-none" />
      <select value={value} onChange={e => onChange(e.target.value as T)} aria-label={pt ? 'Quem pode ver' : 'Who can see'}
        className="h-8 rounded-full border pl-8 pr-3 text-[12.5px] outline-none cursor-pointer appearance-none"
        style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)' }}>
        {options.map(option => <option key={option} value={option}>{audienceLabel(option, pt)}</option>)}
      </select>
    </label>
  )
}

// ─── Amizade ───

/** Adicionar amigo → pedido enviado → amigos. Pedido recebido mostra aceitar e recusar. */
export function FriendButton({ userId, state, pt, onChange, size = 'md' }: {
  userId: string
  state: Relation['friend']
  pt: boolean
  onChange?: (state: Relation['friend']) => void
  size?: 'sm' | 'md'
}) {
  const { user } = useAuth()
  const [current, setCurrent] = useState(state)
  const [busy, setBusy] = useState(false)
  useEffect(() => setCurrent(state), [state])
  if (!user || user.id === userId) return null
  const height = size === 'sm' ? 'h-8 px-3 text-[12.5px]' : 'h-9 px-4 text-[13.5px]'

  const run = async (next: Relation['friend'], action: () => Promise<void>, confirmText?: string) => {
    if (confirmText && !await askConfirm(confirmText)) return
    const previous = current
    setCurrent(next); setBusy(true)
    try { await action(); onChange?.(next) } catch (err) { setCurrent(previous); toast(errorText(err, pt), { tone: 'error' }) } finally { setBusy(false) }
  }

  if (current === 'incoming') {
    return (
      <span className="inline-flex gap-1.5">
        <button type="button" disabled={busy} onClick={() => { void run('friends', () => acceptFriendRequest(user.id, userId)) }}
          className={cn('inline-flex items-center gap-1.5 rounded-full font-medium', height)} style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
          <Check className="w-3.5 h-3.5" />{pt ? 'Aceitar amizade' : 'Accept'}
        </button>
        <button type="button" disabled={busy} aria-label={pt ? 'Recusar' : 'Decline'} onClick={() => { void run('none', () => removeFriendship(user.id, userId)) }}
          className={cn('inline-flex items-center rounded-full border', size === 'sm' ? 'h-8 px-2' : 'h-9 px-2.5')} style={{ borderColor: 'var(--theme-border)' }}>
          <X className="w-4 h-4" />
        </button>
      </span>
    )
  }
  const config = {
    none: { label: pt ? 'Adicionar amigo' : 'Add friend', icon: <UserCheck className="w-3.5 h-3.5" />, act: () => run('outgoing', () => sendFriendRequest(user.id, userId)) },
    outgoing: { label: pt ? 'Amizade pedida' : 'Request sent', icon: <Check className="w-3.5 h-3.5" />, act: () => run('none', () => removeFriendship(user.id, userId), pt ? 'Cancelar o pedido de amizade?' : 'Cancel the friend request?') },
    friends: { label: pt ? 'Amigos' : 'Friends', icon: <UserCheck className="w-3.5 h-3.5" />, act: () => run('none', () => removeFriendship(user.id, userId), pt ? 'Desfazer a amizade?' : 'Remove this friend?') },
  }[current]
  return (
    <button type="button" disabled={busy} onClick={() => { void config.act() }}
      className={cn('inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap transition-colors', height)}
      style={{ borderColor: 'var(--theme-border)', backgroundColor: current === 'friends' ? 'var(--pastel-green-bg)' : 'var(--theme-card-bg)', color: current === 'friends' ? 'var(--pastel-green-fg)' : 'var(--theme-text)' }}>
      {config.icon}{config.label}
    </button>
  )
}

// ─── Linha de pessoa (seguidores, amigos, notificações, busca) ───

export function UserListItem({ person, pt, subtitle, action }: { person: Author; pt: boolean; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-4 sm:px-5 py-3.5 flex items-center gap-3">
      <Link to={`/u/${person.handle}`} className="shrink-0"><Avatar src={person.avatarUrl} name={person.name || person.handle} size={44} /></Link>
      <Link to={`/u/${person.handle}`} className="min-w-0 flex-1 leading-tight">
        <span className="flex items-center gap-2">
          <span className="font-medium truncate">{person.name || person.handle}</span>
          <LevelBadge id={person.level} pt={pt} variant="compact" className="border" />
        </span>
        <span className="block text-[12.5px] truncate" style={muted}>@{person.handle}</span>
        {subtitle && <span className="block mt-0.5 text-[12.5px] truncate" style={muted}>{subtitle}</span>}
      </Link>
      {action}
    </div>
  )
}

/** Botões de relação usados em listas: seguir (e pedido), sem nada para si mesma. */
export function RelationActions({ person, relation, isMe, pt }: { person: Author; relation: Relation; isMe: boolean; pt: boolean }) {
  if (isMe) return null
  return <FollowButton userId={person.userId} following={relation.following} pending={relation.followPending} pt={pt} size="sm" />
}

// ─── Denúncia ───

const REASONS: [ReportReason, string, string][] = [
  ['spam', 'Spam ou propaganda', 'Spam or advertising'],
  ['harassment', 'Assédio ou intimidação', 'Harassment or bullying'],
  ['hate', 'Discurso de ódio', 'Hate speech'],
  ['sexual', 'Conteúdo sexual', 'Sexual content'],
  ['violence', 'Violência ou ameaça', 'Violence or threats'],
  ['copyright', 'Direitos autorais', 'Copyright'],
  ['other', 'Outro motivo', 'Something else'],
]

export function ReportDialog({ target, open, onOpenChange, pt, onDone }: { target: ReportTarget | null; open: boolean; onOpenChange: (open: boolean) => void; pt: boolean; onDone?: () => void }) {
  const { user } = useAuth()
  const [reason, setReason] = useState<ReportReason>('spam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setReason('spam'); setDetails('') } }, [open])

  const send = async () => {
    if (!user || !target) return
    setBusy(true)
    try {
      await report(user.id, target, reason, details)
      toast(pt ? 'Denúncia enviada. Obrigado por cuidar da comunidade.' : 'Report sent. Thanks for looking out.', { tone: 'success' })
      onOpenChange(false)
      onDone?.()
    } catch (err) {
      toast(errorText(err, pt), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{pt ? 'Denunciar' : 'Report'}</DialogTitle>
          <DialogDescription>{pt ? 'A equipe do Bookmoo revisa cada denúncia. Quem foi denunciado não sabe quem denunciou.' : 'The Bookmoo team reviews every report. The person is not told who reported.'}</DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-1.5" role="radiogroup">
          {REASONS.map(([id, ptLabel, enLabel]) => (
            <label key={id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors hover:bg-[var(--ui-hover)]"
              style={reason === id ? { backgroundColor: 'var(--theme-bg-secondary)' } : undefined}>
              <input type="radio" name="report-reason" checked={reason === id} onChange={() => setReason(id)} />
              <span className="text-[14px]">{pt ? ptLabel : enLabel}</span>
            </label>
          ))}
        </div>
        <textarea value={details} onChange={e => setDetails(e.target.value)} maxLength={500} rows={3}
          placeholder={pt ? 'Detalhes (opcional)' : 'Details (optional)'}
          className="mt-3 w-full rounded-xl border px-3 py-2 text-[14px] bg-transparent outline-none resize-none" style={{ borderColor: 'var(--theme-border)' }} />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="h-9 px-4 rounded-full border text-[13.5px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Cancelar' : 'Cancel'}</button>
          <button type="button" disabled={busy} onClick={() => { void send() }} className="h-9 px-4 rounded-full text-[13.5px] font-medium disabled:opacity-60"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Enviar denúncia' : 'Send report'}</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Menu ⋯ ───

export function MenuItem({ onClick, to, icon, danger, children }: { onClick?: () => void; to?: string; icon: ReactNode; danger?: boolean; children: ReactNode }) {
  const className = 'w-full h-9 px-2.5 flex items-center gap-2.5 rounded-lg text-[13.5px] text-left transition-colors hover:bg-[var(--ui-hover)]'
  const style = { color: danger ? 'var(--color-destructive)' : 'var(--theme-text)' }
  return to
    ? <Link to={to} className={className} style={style}>{icon}{children}</Link>
    : <button type="button" onClick={onClick} className={className} style={style}>{icon}{children}</button>
}

export function MoreMenu({ label, children, size = 'md' }: { label: string; children: ReactNode; size?: 'sm' | 'md' }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} className={cn('grid place-items-center rounded-full transition-colors hover:bg-[var(--ui-hover)]', size === 'sm' ? 'w-8 h-8' : 'w-9 h-9')} style={muted}>
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5" style={{ backgroundColor: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)' }}>
        {children}
      </PopoverContent>
    </Popover>
  )
}

/** Menu do perfil de outra pessoa: copiar link, remover seguidor, bloquear e denunciar. */
export function ProfileMenu({ person, relation, pt, onChange }: { person: Author; relation: Relation; pt: boolean; onChange: () => void }) {
  const { user } = useAuth()
  const [reporting, setReporting] = useState(false)
  if (!user || user.id === person.userId) return null
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/u/${person.handle}`); toast(pt ? 'Link do perfil copiado.' : 'Profile link copied.', { tone: 'success' }) } catch { /* sem permissão */ }
  }
  const block = async () => {
    if (relation.blockedByMe) {
      await unblockUser(user.id, person.userId).catch(err => toast(errorText(err, pt), { tone: 'error' }))
      toast(pt ? 'Pessoa desbloqueada.' : 'Unblocked.', { tone: 'success' })
    } else {
      if (!await askConfirm(pt ? `Bloquear @${person.handle}? Vocês deixam de se seguir e de ser amigos, e não poderão interagir.` : `Block @${person.handle}? You stop following each other and cannot interact.`)) return
      await blockUser(user.id, person.userId).catch(err => toast(errorText(err, pt), { tone: 'error' }))
      toast(pt ? 'Pessoa bloqueada.' : 'Blocked.', { tone: 'success' })
    }
    onChange()
  }
  const remove = async () => {
    if (!await askConfirm(pt ? `Remover @${person.handle} dos seus seguidores?` : `Remove @${person.handle} from your followers?`)) return
    await removeFollower(user.id, person.userId).catch(err => toast(errorText(err, pt), { tone: 'error' }))
    onChange()
  }
  return (
    <>
      <MoreMenu label={pt ? 'Mais opções' : 'More options'}>
        <MenuItem onClick={() => { void copy() }} icon={<Link2 className="w-4 h-4" />}>{pt ? 'Copiar link do perfil' : 'Copy profile link'}</MenuItem>
        {relation.followsMe && <MenuItem onClick={() => { void remove() }} icon={<UserMinus className="w-4 h-4" />}>{pt ? 'Remover seguidor' : 'Remove follower'}</MenuItem>}
        <MenuItem onClick={() => setReporting(true)} icon={<Flag className="w-4 h-4" />}>{pt ? 'Denunciar perfil' : 'Report profile'}</MenuItem>
        <MenuItem onClick={() => { void block() }} icon={relation.blockedByMe ? <UserX className="w-4 h-4" /> : <Ban className="w-4 h-4" />} danger={!relation.blockedByMe}>
          {relation.blockedByMe ? (pt ? 'Desbloquear' : 'Unblock') : (pt ? 'Bloquear' : 'Block')}
        </MenuItem>
      </MoreMenu>
      <ReportDialog open={reporting} onOpenChange={setReporting} pt={pt} target={{ type: 'profile', profileId: person.userId }} />
    </>
  )
}

/** Barra fina de progresso, usada na meta, na estante e nos cartões de leitura. */
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1.5 rounded-full overflow-hidden', className)} style={{ backgroundColor: 'var(--theme-bg-secondary)' }}
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
      <div className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: 'var(--theme-text)' }} />
    </div>
  )
}
