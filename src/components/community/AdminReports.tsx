import { askConfirm } from '@/components/ui/confirm'
// Fila de denúncias da área admin: ver o conteúdo, ocultar, apagar ou arquivar.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { toast } from '@/components/ui/toast'
import { errorText, loadAdminReports, resolveReport, timeAgo, type AdminReport } from '@/lib/social'
import { muted } from './social-ui'

const REASON: Record<string, [string, string]> = {
  spam: ['Spam', 'Spam'], harassment: ['Assédio', 'Harassment'], hate: ['Ódio', 'Hate'], sexual: ['Sexual', 'Sexual'],
  violence: ['Violência', 'Violence'], copyright: ['Direitos autorais', 'Copyright'], other: ['Outro', 'Other'],
}

export function AdminReports({ pt }: { pt: boolean }) {
  const [status, setStatus] = useState<'open' | 'actioned' | 'dismissed'>('open')
  const [items, setItems] = useState<AdminReport[] | null>(null)
  const reload = () => loadAdminReports(status).then(setItems)
  useEffect(() => { setItems(null); void reload() }, [status])

  const act = async (item: AdminReport, action: 'dismiss' | 'hide' | 'delete') => {
    if (action === 'delete' && !await askConfirm(pt ? 'Apagar este conteúdo para sempre?' : 'Delete this content for good?')) return
    try { await resolveReport(item.id, action); await reload() } catch (err) { toast(errorText(err, pt), { tone: 'error' }) }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{pt ? 'Denúncias da comunidade' : 'Community reports'}</h2>
        <div className="flex p-0.5 rounded-lg" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} role="tablist">
          {(['open', 'actioned', 'dismissed'] as const).map(key => (
            <button key={key} type="button" role="tab" aria-selected={status === key} onClick={() => setStatus(key)} className="h-7 px-2.5 rounded-md text-[12.5px] font-medium"
              style={{ backgroundColor: status === key ? 'var(--theme-card-bg)' : 'transparent', color: status === key ? 'var(--theme-text)' : 'var(--theme-text-secondary)' }}>
              {{ open: pt ? 'Abertas' : 'Open', actioned: pt ? 'Resolvidas' : 'Actioned', dismissed: pt ? 'Arquivadas' : 'Dismissed' }[key]}
            </button>
          ))}
        </div>
      </div>
      {items === null
        ? <div className="mt-3 h-24 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
        : items.length === 0
          ? <p className="mt-3 text-[13.5px]" style={muted}>{pt ? 'Nenhuma denúncia aqui.' : 'No reports here.'}</p>
          : <ul className="mt-3 space-y-2">
              {items.map(item => (
                <li key={item.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
                  <div className="flex items-center gap-3">
                    <Avatar src={item.targetAuthor.avatarUrl} name={item.targetAuthor.name || item.targetAuthor.handle} size={32} />
                    <p className="min-w-0 flex-1 text-[13.5px]">
                      <Link to={`/u/${item.targetAuthor.handle}`} className="font-medium hover:underline">@{item.targetAuthor.handle}</Link>
                      <span style={muted}> · {{ post: pt ? 'publicação' : 'post', comment: pt ? 'comentário' : 'comment', profile: pt ? 'perfil' : 'profile' }[item.type]} · {REASON[item.reason]?.[pt ? 0 : 1]} · {timeAgo(item.at, pt)}</span>
                    </p>
                    {item.hidden && <span className="text-[12px] rounded-full px-2 py-0.5" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{pt ? 'oculta' : 'hidden'}</span>}
                  </div>
                  {item.content && <p className="mt-2 text-[14px] leading-snug line-clamp-4 whitespace-pre-line">{item.content}</p>}
                  {item.imageUrl && <img src={item.imageUrl} alt="" className="mt-2 w-40 aspect-[4/3] object-cover rounded-lg" />}
                  {item.details && <p className="mt-2 text-[12.5px]" style={muted}>{pt ? 'Detalhes de quem denunciou: ' : 'Reporter details: '}{item.details}</p>}
                  {status === 'open' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.postId && <Link to={`/post/${item.postId}`} className="h-8 px-3 inline-flex items-center rounded-full border text-[12.5px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Abrir' : 'Open'}</Link>}
                      {item.type === 'post' && !item.hidden && <button type="button" onClick={() => { void act(item, 'hide') }} className="h-8 px-3 rounded-full border text-[12.5px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Ocultar' : 'Hide'}</button>}
                      {item.type !== 'profile' && <button type="button" onClick={() => { void act(item, 'delete') }} className="h-8 px-3 rounded-full border text-[12.5px]" style={{ borderColor: 'var(--theme-border)', color: 'var(--color-destructive)' }}>{pt ? 'Apagar' : 'Delete'}</button>}
                      <button type="button" onClick={() => { void act(item, 'dismiss') }} className="h-8 px-3 rounded-full text-[12.5px]" style={muted}>{pt ? 'Arquivar' : 'Dismiss'}</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>}
    </section>
  )
}
