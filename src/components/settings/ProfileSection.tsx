import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useBookStore } from '@/store/useBookStore'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useXpStore, xpSummary } from '@/store/useXpStore'
import { readingProgress } from '@/lib/utils'
import { AvatarCropDialog } from './AvatarCropDialog'
import { loadOwnProfile, saveOwnProfile, type CommunityProfile, type EnglishLevel } from '@/lib/communityProfile'

const LEVELS: EnglishLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/** Cartão do perfil, separado da conta: foto com recorte, texto público e redes. */
export function ProfileSection({ pt }: { pt: boolean }) {
  const { user } = useAuth()
  const books = useBookStore(s => s.books)
  const words = useVocabularyStore(s => s.vocabularies.length)
  const events = useXpStore(s => s.events)
  const [profile, setProfile] = useState<CommunityProfile | null>(null)
  const [avatar, setAvatar] = useState<string | null>(user?.user_metadata?.avatar_url ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const held = useRef<string | null>(null)

  useEffect(() => {
    if (!user) return
    const stored = localStorage.getItem(`bookmoo-avatar-${user.id}`)
    const url = held.current || user.user_metadata?.avatar_url || stored || null
    setAvatar(url)
    void loadOwnProfile(user.id, url ?? undefined).then(setProfile)
  }, [user])

  if (!user || !profile) return null
  const { total, streak } = xpSummary(events)
  const field = 'w-full h-10 rounded-lg border px-3 text-[14px] outline-none bg-transparent'
  const style = { borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }

  const upload = async (blob: Blob) => {
    const preview = URL.createObjectURL(blob)
    held.current = preview
    setAvatar(preview)
    setFile(null)
    setMessage(null)
    if (!supabase) return
    setUploading(true)
    const path = `${user.id}/avatar.jpg`
    let bucket = 'avatars'
    let { error } = await supabase.storage.from(bucket).upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (error) {
      bucket = 'web'
      ;({ error } = await supabase.storage.from(bucket).upload(`avatars/${path}`, blob, { upsert: true, contentType: 'image/jpeg' }))
    }
    if (error) {
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      }).catch(() => preview)
      try { localStorage.setItem(`bookmoo-avatar-${user.id}`, dataUrl) } catch { /* foto grande demais para o aparelho */ }
      held.current = dataUrl
      setAvatar(dataUrl)
      setUploading(false)
      setMessage(pt ? 'A foto ficou neste aparelho.' : 'The photo is saved on this device.')
      return
    }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(bucket === 'web' ? `avatars/${path}` : path)
    const fresh = `${publicUrl}?v=${Date.now()}`
    await supabase.auth.updateUser({ data: { avatar_url: fresh } })
    try { localStorage.removeItem(`bookmoo-avatar-${user.id}`) } catch { /* ignore */ }
    held.current = fresh
    setAvatar(fresh)
    setUploading(false)
    setMessage(pt ? 'Foto atualizada.' : 'Photo updated.')
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    const reading = books
      .filter(book => book.progress > 0 && book.progress < 100)
      .slice(0, 6)
      .map(book => ({ title: book.title, progress: Math.round(readingProgress(book.currentPage, book.pages.length, book.totalPages)) }))
    try {
      await saveOwnProfile({ ...profile, reading, stats: { points: total, streak, words } })
      setMessage(profile.isPublic
        ? (pt ? 'Perfil público salvo.' : 'Public profile saved.')
        : (pt ? 'Perfil privado salvo. Só você vê.' : 'Private profile saved. Only you can see it.'))
    } catch {
      setMessage(pt ? 'Não consegui salvar o perfil agora.' : 'Could not save the profile right now.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="profile" className="scroll-mt-8">
      <div className="mb-3">
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--theme-text)' }}>{pt ? 'Perfil na comunidade' : 'Community profile'}</h2>
        <p className="mt-1 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Foto, nível de inglês e o que você quer mostrar. O perfil começa privado.' : 'Photo, English level and what you want to show. The profile starts private.'}
        </p>
      </div>
      <div className="rounded-2xl border p-5 sm:p-6 space-y-5" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden border shrink-0" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--pastel-lavender-bg)' }}>
            {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (
              <span className="grid place-items-center w-full h-full text-[24px] font-semibold" style={{ color: 'var(--pastel-lavender-fg)' }}>{(user.email ?? 'B').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <label className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border text-[13.5px] font-medium cursor-pointer" style={{ borderColor: 'var(--theme-border)' }}>
            <Camera className="w-4 h-4" />
            {uploading ? (pt ? 'Enviando…' : 'Uploading…') : (pt ? 'Escolher foto' : 'Choose photo')}
            <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={e => { const next = e.target.files?.[0]; if (next) setFile(next); e.currentTarget.value = '' }} />
          </label>
        </div>

        <label className="flex items-center justify-between gap-4 rounded-xl px-3 py-3" style={{ backgroundColor: 'var(--pastel-blue-bg)', color: 'var(--pastel-blue-fg)' }}>
          <span>
            <span className="block text-[14px] font-medium">{pt ? 'Perfil público' : 'Public profile'}</span>
            <span className="block text-[12.5px]" style={{ color: 'var(--pastel-blue-fg)', opacity: 0.8 }}>
              {pt ? 'Mostra nome, livros em leitura, nível e redes. O e-mail continua escondido.' : 'Shows name, books in progress, level and social links. Email stays hidden.'}
            </span>
          </span>
          <input type="checkbox" checked={profile.isPublic} onChange={e => setProfile({ ...profile, isPublic: e.target.checked })} className="w-4 h-4" />
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[12.5px] mb-1" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Nome na comunidade' : 'Community name'}</span>
            <input className={field} style={style} value={profile.username} maxLength={40} onChange={e => setProfile({ ...profile, username: e.target.value })} />
          </label>
          <label className="block">
            <span className="block text-[12.5px] mb-1" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Nível de inglês' : 'English level'}</span>
            <select className={field} style={style} value={profile.englishLevel} onChange={e => setProfile({ ...profile, englishLevel: e.target.value as EnglishLevel | '' })}>
              <option value="">{pt ? 'Não dizer' : 'Skip'}</option>
              {LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="block text-[12.5px] mb-1" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Sobre você' : 'About you'}</span>
          <textarea className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none resize-none bg-transparent" style={style} rows={3} maxLength={280} value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} />
        </label>
        <div className="grid sm:grid-cols-3 gap-3">
          {([
            ['instagram', 'Instagram', profile.instagram],
            ['x', 'X', profile.x],
            ['website', pt ? 'Site' : 'Website', profile.website],
          ] as const).map(([key, label, value]) => (
            <label key={key} className="block">
              <span className="block text-[12.5px] mb-1" style={{ color: 'var(--theme-text-secondary)' }}>{label}</span>
              <input className={field} style={style} value={value} onChange={e => setProfile({ ...profile, [key]: e.target.value })} placeholder={key === 'website' ? 'https://' : '@'} />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={saving} className="h-9 px-4 rounded-lg text-[13.5px] font-medium disabled:opacity-60" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {saving ? (pt ? 'Salvando…' : 'Saving…') : (pt ? 'Salvar perfil' : 'Save profile')}
          </button>
          {message && <p className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{message}</p>}
        </div>
      </div>
      <AvatarCropDialog file={file} pt={pt} onClose={() => setFile(null)} onSave={blob => { void upload(blob) }} />
    </section>
  )
}
