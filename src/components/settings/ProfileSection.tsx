import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Camera, Check, Eye, EyeOff, ExternalLink, ImagePlus, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { toast } from '@/components/ui/toast'
import { errorText, loadBlocked, unblockUser } from '@/lib/social'
import { BANNERS, DEFAULT_BANNER } from '@/lib/banners'
import { ProfileBanner } from '@/components/community/ProfileBanner'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { AvatarCropDialog } from './AvatarCropDialog'
import { announceAvatar } from '@/hooks/useMyAvatar'
import { ProfileView } from '@/components/community/ProfileView'
import {
  BIO_MAX, cleanHandle, GOAL_MAX, HANDLE_PATTERN, loadOwnProfile, loadProfileView, NO_RELATION, ProfileSaveError, removeCover, saveAvatarUrl, saveOwnProfile, uploadCover,
  type Author, type OwnProfile, type ProfileView as View,
} from '@/lib/communityProfile'

const remote = (url: unknown) => typeof url === 'string' && /^https?:\/\//.test(url) ? url : undefined

/** Cartão do perfil, separado da conta: foto, @, texto público, redes e o que mostrar. */
export function ProfileSection({ pt }: { pt: boolean }) {
  const { user } = useAuth()
  const location = useLocation()
  const [profile, setProfile] = useState<OwnProfile | null>(null)
  const [avatar, setAvatar] = useState<string | null>(user?.user_metadata?.avatar_url ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(false)
  const [server, setServer] = useState<View | null>(null)
  const [savedHandle, setSavedHandle] = useState('')
  const [coverBusy, setCoverBusy] = useState(false)
  const held = useRef<string | null>(null)
  const section = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!user) return
    const stored = localStorage.getItem(`bookmoo-avatar-${user.id}`)
    void loadOwnProfile(user.id).then(own => {
      const url = held.current || own.avatarUrl || user.user_metadata?.avatar_url || stored || null
      setAvatar(url)
      setProfile({ ...own, avatarUrl: own.avatarUrl ?? remote(user.user_metadata?.avatar_url) })
      setSavedHandle(own.handle)
    })
  }, [user])

  useEffect(() => {
    if (profile && location.hash === '#profile') section.current?.scrollIntoView({ block: 'start' })
  }, [!!profile, location.hash])

  useEffect(() => {
    if (preview) void loadProfileView('me').then(setServer)
  }, [preview])

  if (!user || !profile) return null
  const field = 'w-full h-10 rounded-lg border px-3 text-[14px] outline-none bg-transparent'
  const style = { borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }
  const set = (patch: Partial<OwnProfile>) => { setProfile({ ...profile, ...patch }); setMessage(null) }
  const handleOk = !profile.handle || HANDLE_PATTERN.test(profile.handle)

  const upload = async (blob: Blob) => {
    const local = URL.createObjectURL(blob)
    held.current = local
    setAvatar(local)
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
      }).catch(() => local)
      try { localStorage.setItem(`bookmoo-avatar-${user.id}`, dataUrl) } catch { /* foto grande demais para o aparelho */ }
      held.current = dataUrl
      setAvatar(dataUrl)
      announceAvatar(dataUrl)
      setUploading(false)
      setMessage({ tone: 'error', text: pt ? 'A foto ficou só neste aparelho. A comunidade continua vendo a inicial.' : 'The photo stayed on this device. The community still sees your initial.' })
      return
    }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(bucket === 'web' ? `avatars/${path}` : path)
    const fresh = `${publicUrl}?v=${Date.now()}`
    await supabase.auth.updateUser({ data: { avatar_url: fresh } })
    await saveAvatarUrl(user.id, fresh)
    try { localStorage.removeItem(`bookmoo-avatar-${user.id}`) } catch { /* ignore */ }
    held.current = fresh
    setAvatar(fresh)
    announceAvatar(fresh)
    setProfile(current => current && { ...current, avatarUrl: fresh })
    setUploading(false)
    setMessage({ tone: 'ok', text: pt ? 'Foto atualizada.' : 'Photo updated.' })
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await saveOwnProfile(profile)
      setSavedHandle(profile.handle)
      if (preview) void loadProfileView('me').then(setServer)
      setMessage({
        tone: 'ok',
        text: profile.isPublic
          ? (pt ? 'Perfil público salvo.' : 'Public profile saved.')
          : (pt ? 'Perfil fechado salvo. Só quem você aprovar vê suas leituras.' : 'Closed profile saved. Only people you approve see your reading.'),
      })
    } catch (err) {
      const code = err instanceof ProfileSaveError ? err.code : 'unknown'
      const text: Record<ProfileSaveError['code'], string> = pt ? {
        handle_required: 'Para abrir o perfil, escolha um @.',
        handle_invalid: 'O @ precisa ter de 3 a 20 letras, números, ponto ou _.',
        handle_taken: 'Esse @ já é de outra pessoa.',
        not_migrated: 'O banco ainda não tem os campos novos do perfil.',
        image: 'Use uma imagem JPEG, PNG ou WebP de até 15 MB.',
        offline: 'Sem conexão com o servidor.',
        unknown: 'Não consegui salvar o perfil agora.',
      } : {
        handle_required: 'Pick a handle to open your profile.',
        handle_invalid: 'The handle needs 3 to 20 letters, numbers, dots or underscores.',
        handle_taken: 'That handle belongs to someone else.',
        not_migrated: 'The database does not have the new profile fields yet.',
        image: 'Use a JPEG, PNG or WebP image up to 15 MB.',
        offline: 'No connection to the server.',
        unknown: 'Could not save the profile right now.',
      }
      setMessage({ tone: 'error', text: text[code] })
    } finally {
      setSaving(false)
    }
  }

  // Prévia: o que está no formulário, com resultados e estante vindos do servidor.
  const draft: View = {
    userId: user.id,
    handle: profile.handle,
    name: profile.name,
    bio: profile.bio,
    goal: profile.goal,
    avatarUrl: avatar ?? undefined,
    banner: profile.banner || undefined,
    coverUrl: profile.coverUrl,
    level: server?.level ?? 'A1',
    leveled: server?.leveled ?? false,
    isPublic: profile.isPublic,
    isOwner: true,
    restricted: false,
    relation: NO_RELATION,
    joinedAt: server?.joinedAt,
    followers: server?.followers ?? 0,
    following: server?.following ?? 0,
    friends: server?.friends ?? 0,
    posts: server?.posts ?? 0,
    reviews: server?.reviews ?? 0,
    booksRead: server?.booksRead ?? 0,
    booksReading: server?.booksReading ?? 0,
    booksWant: server?.booksWant ?? 0,
    readingGoal: server?.readingGoal,
    show: { shelf: profile.showShelf, stats: profile.showStats, socials: profile.showSocials, studying: profile.showStudying },
    socials: profile.socials,
    stats: server?.stats,
    shelf: server?.shelf,
    studying: server?.studying,
  }

  return (
    <section id="profile" ref={section} className="scroll-mt-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--theme-text)' }}>{pt ? 'Perfil na comunidade' : 'Community profile'}</h2>
          <p className="mt-1 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Foto, @, bio e o que você quer mostrar. O perfil começa privado.' : 'Photo, handle, bio and what you want to show. The profile starts private.'}
          </p>
        </div>
        {savedHandle && (
          <Link to={`/u/${savedHandle}`} className="shrink-0 inline-flex items-center gap-1 text-[13px] underline" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Abrir perfil' : 'Open profile'}<ExternalLink className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      <div className="rounded-2xl border p-5 sm:p-6 space-y-5" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden border shrink-0" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--pastel-lavender-bg)' }}>
            {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (
              <span className="grid place-items-center w-full h-full text-[24px] font-semibold" style={{ color: 'var(--pastel-lavender-fg)' }}>{(profile.name || user.email || 'B').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <label className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border text-[13.5px] font-medium cursor-pointer" style={{ borderColor: 'var(--theme-border)' }}>
            <Camera className="w-4 h-4" />
            {uploading ? (pt ? 'Enviando…' : 'Uploading…') : (pt ? 'Escolher foto' : 'Choose photo')}
            <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={e => { const next = e.target.files?.[0]; if (next) setFile(next); e.currentTarget.value = '' }} />
          </label>
        </div>

        <div>
          <p className="block text-[12.5px] mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Capa do perfil' : 'Profile cover'}</p>
          <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: 'var(--theme-border)' }}>
            {profile.coverUrl
              ? <img src={profile.coverUrl} alt="" className="w-full h-28 sm:h-36 object-cover" />
              : <ProfileBanner id={profile.banner} className="h-28 sm:h-36" />}
            <div className="absolute right-2 bottom-2 flex gap-1.5">
              <label className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-[12.5px] font-medium cursor-pointer" style={{ backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)' }}>
                <ImagePlus className="w-3.5 h-3.5" />{coverBusy ? (pt ? 'Enviando…' : 'Uploading…') : (profile.coverUrl ? (pt ? 'Trocar capa' : 'Change cover') : (pt ? 'Enviar capa' : 'Upload cover'))}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={coverBusy} onChange={e => {
                  const next = e.target.files?.[0]; e.currentTarget.value = ''
                  if (!next) return
                  setCoverBusy(true)
                  void uploadCover(user.id, next)
                    .then(url => { setProfile(current => current && { ...current, coverUrl: url }); toast(pt ? 'Capa atualizada.' : 'Cover updated.', { tone: 'success' }) })
                    .catch(err => setMessage({ tone: 'error', text: err instanceof ProfileSaveError && err.code === 'image' ? (pt ? 'Use uma imagem JPEG, PNG ou WebP de até 15 MB.' : 'Use a JPEG, PNG or WebP image up to 15 MB.') : (pt ? 'Não consegui enviar a capa.' : 'Could not upload the cover.') }))
                    .finally(() => setCoverBusy(false))
                }} />
              </label>
              {profile.coverUrl && (
                <button type="button" aria-label={pt ? 'Remover capa' : 'Remove cover'} className="h-8 w-8 grid place-items-center rounded-full" style={{ backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)' }}
                  onClick={() => { void removeCover(user.id).then(() => setProfile(current => current && { ...current, coverUrl: undefined })) }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-[11.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Sem capa própria, o perfil usa o modelo escolhido abaixo.' : 'Without your own cover, the profile uses the style below.'}</p>
        </div>

        <fieldset>
          <legend className="block text-[12.5px] mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Modelo de capa' : 'Cover style'}</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BANNERS.map(item => {
              const on = (profile.banner || DEFAULT_BANNER.id) === item.id
              return (
                <button key={item.id} type="button" onClick={() => set({ banner: item.id })} aria-pressed={on} aria-label={pt ? item.pt : item.en}
                  className="relative rounded-xl overflow-hidden text-left outline-offset-2"
                  style={{ boxShadow: on ? '0 0 0 2px var(--theme-text)' : '0 0 0 1px var(--theme-border)' }}>
                  <ProfileBanner id={item.id} compact className="h-14" />
                  <span className="absolute left-2 bottom-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-card-bg) 85%, transparent)' }}>
                    {pt ? item.pt : item.en}
                  </span>
                  {on && <Check className="absolute right-1.5 top-1.5 w-4 h-4 rounded-full p-0.5" style={{ backgroundColor: 'var(--theme-text)', color: 'var(--theme-bg)' }} />}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[12.5px] mb-1" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Nome na comunidade' : 'Community name'}</span>
            <input className={field} style={style} value={profile.name} maxLength={40} onChange={e => set({ name: e.target.value })} />
          </label>
          <label className="block">
            <span className="block text-[12.5px] mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
              {pt ? 'Seu @' : 'Your handle'}{profile.isPublic && <span aria-hidden> *</span>}
            </span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>@</span>
              <input className={`${field} pl-7`} style={{ ...style, borderColor: handleOk ? 'var(--theme-border)' : 'var(--color-destructive)' }}
                value={profile.handle} placeholder={pt ? 'seu.nome' : 'your.name'} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                aria-invalid={!handleOk} onChange={e => set({ handle: cleanHandle(e.target.value) })} />
            </div>
            <span className="block mt-1 text-[11.5px]" style={{ color: handleOk ? 'var(--theme-text-secondary)' : 'var(--color-destructive)' }}>
              {profile.handle ? `bookmoo.app/u/${profile.handle}` : (pt ? '3 a 20 caracteres: letras, números, ponto ou _' : '3 to 20 characters: letters, numbers, dot or _')}
            </span>
          </label>
        </div>
        <label className="block">
          <span className="flex justify-between text-[12.5px] mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
            <span>{pt ? 'Sobre você' : 'About you'}</span><span className="tabular-nums">{profile.bio.length}/{BIO_MAX}</span>
          </span>
          <textarea className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none resize-none bg-transparent" style={style} rows={3} maxLength={BIO_MAX} value={profile.bio} onChange={e => set({ bio: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-[12.5px] mb-1" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Seu objetivo com o inglês' : 'Your English goal'}</span>
          <input className={field} style={style} value={profile.goal} maxLength={GOAL_MAX} placeholder={pt ? 'Ex.: ler Harry Potter no original' : 'E.g. read Harry Potter in English'} onChange={e => set({ goal: e.target.value })} />
        </label>
        <div className="grid sm:grid-cols-3 gap-3">
          {([
            ['instagram', 'Instagram', '@'],
            ['x', 'X', '@'],
            ['website', pt ? 'Site' : 'Website', 'https://'],
          ] as const).map(([key, label, placeholder]) => (
            <label key={key} className="block">
              <span className="block text-[12.5px] mb-1" style={{ color: 'var(--theme-text-secondary)' }}>{label}</span>
              <input className={field} style={style} value={profile.socials[key]} placeholder={placeholder}
                onChange={e => set({ socials: { ...profile.socials, [key]: e.target.value } })} />
            </label>
          ))}
        </div>

        <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--theme-border)' }}>
          <Toggle checked={profile.isPublic} onChange={isPublic => set({ isPublic })} strong
            title={pt ? 'Perfil aberto' : 'Open profile'}
            hint={pt ? 'Aberto: aparece na Comunidade e qualquer leitor segue na hora. Fechado: só nome, foto e @ aparecem; as pessoas pedem para seguir e você aprova.' : 'Open: shows up in the Community and anyone can follow. Closed: only name, photo and handle show; people request to follow and you approve.'} />
          <div>
            <Toggle checked={profile.showStats} onChange={showStats => set({ showStats })}
              title={pt ? 'Resultados' : 'Results'} hint={pt ? 'Pontos, sequência, palavras e o mapa de estudo.' : 'Points, streak, words and the study map.'} />
            <Toggle checked={profile.showShelf} onChange={showShelf => set({ showShelf })}
              title={pt ? 'Estante' : 'Shelf'} hint={pt ? 'O que você está lendo e já leu. Livros que você enviou mostram só título e autor.' : 'What you read and are reading. Books you uploaded show only title and author.'} />
            <Toggle checked={profile.showStudying} onChange={showStudying => set({ showStudying })}
              title={pt ? 'Palavras que estou estudando' : 'Words I am studying'} hint={pt ? 'As últimas palavras em revisão.' : 'Your latest words in review.'} />
            <Toggle checked={profile.showSocials} onChange={showSocials => set({ showSocials })}
              title={pt ? 'Redes sociais' : 'Social links'} hint={pt ? 'Instagram, X e site.' : 'Instagram, X and website.'} />
          </div>
        </div>

        <div>
          <p className="block text-[12.5px] mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Publicar automaticamente na timeline' : 'Share automatically on the timeline'}</p>
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--theme-border)' }}>
            <Toggle checked={profile.shareReading} onChange={shareReading => set({ shareReading, shareProgress: shareReading && profile.shareProgress })}
              title={pt ? 'Quando começo e termino um livro' : 'When I start and finish a book'} hint={pt ? 'Uma publicação por livro. Desligar esconde as que já foram feitas.' : 'One post per book. Turning off hides the ones already made.'} />
            <div className={profile.shareReading ? '' : 'opacity-50'}>
              <Toggle checked={profile.shareProgress} disabled={!profile.shareReading} onChange={shareProgress => set({ shareProgress })}
                title={pt ? 'Meu progresso (25%, 50% e 75%)' : 'My progress (25%, 50% and 75%)'} hint={pt ? 'No máximo três atualizações por livro, sem spam.' : 'At most three updates per book.'} />
            </div>
            <Toggle checked={profile.shareGoals} onChange={shareGoals => set({ shareGoals })}
              title={pt ? 'Quando atinjo minha meta do ano' : 'When I reach my yearly goal'} hint={pt ? 'Uma publicação por ano.' : 'One post per year.'} />
          </div>
        </div>
        <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Seu nível de inglês aparece como A1 até você fazer o teste de nivelamento, que vem em breve. O e-mail nunca aparece.' : 'Your English level shows as A1 until you take the placement test, coming soon. Your email never shows.'}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={saving || !handleOk} className="h-9 px-4 rounded-lg text-[13.5px] font-medium disabled:opacity-60" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {saving ? (pt ? 'Salvando…' : 'Saving…') : (pt ? 'Salvar perfil' : 'Save profile')}
          </button>
          <button type="button" onClick={() => setPreview(value => !value)} aria-pressed={preview} className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border text-[13.5px]" style={{ borderColor: 'var(--theme-border)' }}>
            {preview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {preview ? (pt ? 'Fechar prévia' : 'Close preview') : (pt ? 'Ver como os outros veem' : 'See it as others do')}
          </button>
          {message && <p className="text-[13px]" style={{ color: message.tone === 'error' ? 'var(--color-destructive)' : 'var(--theme-text-secondary)' }}>{message.text}</p>}
        </div>
      </div>

      {preview && (
        <div className="mt-4 rounded-2xl border border-dashed p-3 sm:p-4" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)' }}>
          <p className="mb-3 text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
            {profile.isPublic
              ? (pt ? 'Prévia com o que está no formulário. Salve para valer.' : 'Preview of the form as it is. Save to apply.')
              : (pt ? 'Perfil fechado: quem não foi aprovado vê só o cabeçalho. Abaixo, o que as pessoas aprovadas veem.' : 'Closed profile: people not approved see only the header. Below is what approved people see.')}
          </p>
          <ProfileView view={draft} pt={pt} asVisitor />
        </div>
      )}
      <BlockedPeople pt={pt} />
      <AvatarCropDialog file={file} pt={pt} onClose={() => setFile(null)} onSave={blob => { void upload(blob) }} />
    </section>
  )
}

function Toggle({ checked, onChange, title, hint, disabled, strong }: { checked: boolean; onChange: (value: boolean) => void; title: ReactNode; hint: ReactNode; disabled?: boolean; strong?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 px-3.5 py-3 border-b last:border-b-0 cursor-pointer"
      style={{ borderColor: 'var(--theme-border)', backgroundColor: strong ? 'var(--pastel-blue-bg)' : undefined, color: strong ? 'var(--pastel-blue-fg)' : undefined }}>
      <span>
        <span className="block text-[14px] font-medium">{title}</span>
        <span className="block text-[12.5px]" style={{ opacity: 0.75 }}>{hint}</span>
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} className="w-4 h-4 shrink-0" />
    </label>
  )
}

/** Pessoas bloqueadas, com desbloqueio. */
function BlockedPeople({ pt }: { pt: boolean }) {
  const { user } = useAuth()
  const [people, setPeople] = useState<Author[] | null>(null)
  useEffect(() => { void loadBlocked().then(setPeople) }, [])
  if (!user || !people || people.length === 0) return null
  return (
    <div className="mt-4 rounded-2xl border p-5" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
      <h3 className="text-[14px] font-semibold">{pt ? 'Pessoas bloqueadas' : 'Blocked people'}</h3>
      <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Elas não veem seu perfil nem interagem com você.' : 'They cannot see your profile or interact with you.'}</p>
      <ul className="mt-3 space-y-2">
        {people.map(person => (
          <li key={person.userId} className="flex items-center gap-3">
            <Avatar src={person.avatarUrl} name={person.name || person.handle} size={34} />
            <span className="min-w-0 flex-1 text-[13.5px] truncate">{person.name || person.handle} <span style={{ color: 'var(--theme-text-secondary)' }}>@{person.handle}</span></span>
            <button type="button" className="h-8 px-3 rounded-full border text-[12.5px]" style={{ borderColor: 'var(--theme-border)' }}
              onClick={() => { void unblockUser(user.id, person.userId).then(() => setPeople(current => (current ?? []).filter(other => other.userId !== person.userId))).catch(err => toast(errorText(err, pt), { tone: 'error' })) }}>
              {pt ? 'Desbloquear' : 'Unblock'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
