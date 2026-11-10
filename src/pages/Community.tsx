import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLanguage } from '@/store/useLanguage'
import { listCatalog, type CatalogBook } from '@/lib/catalog'
import { listPublicProfiles, loadPublicProfile, type CommunityProfile } from '@/lib/communityProfile'

export function Community() {
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const [people, setPeople] = useState<CommunityProfile[]>([])
  const [books, setBooks] = useState<CatalogBook[]>([])
  useEffect(() => {
    void listPublicProfiles().then(setPeople)
    void listCatalog().then(setBooks).catch(() => {})
  }, [])

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="font-display text-[34px] leading-none">{pt ? 'Comunidade' : 'Community'}</h1>
      <p className="mt-2 max-w-xl text-[14.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
        {pt
          ? 'Quem deixou o perfil aberto e os livros da galeria. Grupos, chamadas e aulas ficam para depois.'
          : 'People who opened their profile, and the gallery books. Groups, calls and classes come later.'}
      </p>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">{pt ? 'Estudando agora' : 'Studying now'}</h2>
        {people.length === 0 && (
          <p className="mt-3 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Ninguém com perfil público ainda. O seu fica em Configurações.' : 'No public profiles yet. Yours lives in Settings.'}
          </p>
        )}
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          {people.map(person => (
            <Link key={person.userId} to={`/profile/${person.userId}`} className="rounded-2xl border p-4" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-10 h-10 rounded-full text-sm font-semibold" style={{ backgroundColor: 'var(--theme-pastel-1)', color: 'var(--theme-pastel-text)' }}>
                  {(person.username || 'B').charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="font-medium">{person.username || (pt ? 'Leitor' : 'Reader')}</p>
                  {person.englishLevel && <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Inglês' : 'English'} {person.englishLevel}</p>}
                </div>
              </div>
              {person.reading[0] && <p className="mt-3 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Lendo' : 'Reading'} {person.reading[0].title}</p>}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[15px] font-semibold">{pt ? 'Livros para começar' : 'Books to start with'}</h2>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {books.slice(0, 8).map(book => (
            <Link key={book.id} to={`/gallery/${book.id}`} className="w-40 shrink-0 rounded-2xl border p-3" style={{ borderColor: 'var(--theme-border)' }}>
              <div className="aspect-[3/4] rounded-lg mb-2" style={{ backgroundColor: 'var(--theme-pastel-2)' }} />
              <p className="text-[13.5px] font-medium leading-snug">{book.title}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

export function PublicProfile() {
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const { userId } = useParams()
  const [profile, setProfile] = useState<CommunityProfile | null | undefined>(undefined)
  useEffect(() => {
    if (!userId) return
    void loadPublicProfile(userId).then(setProfile)
  }, [userId])
  if (profile === undefined) return null
  if (!profile) return <p className="max-w-xl mx-auto" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Este perfil é privado.' : 'This profile is private.'}</p>
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="font-display text-[34px] leading-none">{profile.username || (pt ? 'Leitor' : 'Reader')}</h1>
      {profile.englishLevel && <p className="mt-2 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Inglês' : 'English'} {profile.englishLevel}</p>}
      {profile.bio && <p className="mt-4 text-[15px] leading-relaxed">{profile.bio}</p>}
      <div className="mt-6 flex gap-6 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
        {profile.stats.points != null && <span>{profile.stats.points} {pt ? 'pontos' : 'points'}</span>}
        {profile.stats.streak != null && <span>{profile.stats.streak} {pt ? 'dias' : 'days'}</span>}
        {profile.stats.words != null && <span>{profile.stats.words} {pt ? 'palavras' : 'words'}</span>}
      </div>
      {profile.reading.length > 0 && (
        <ul className="mt-6 space-y-2">
          {profile.reading.map(book => (
            <li key={book.title} className="rounded-xl px-3 py-2 text-[14px]" style={{ backgroundColor: 'var(--theme-pastel-3)', color: 'var(--theme-pastel-text)' }}>
              {book.title} · {book.progress}%
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 flex flex-wrap gap-3 text-[13.5px]">
        {profile.instagram && <span>Instagram {profile.instagram}</span>}
        {profile.x && <span>X {profile.x}</span>}
        {profile.website && <a href={profile.website} className="underline">{profile.website}</a>}
      </div>
    </div>
  )
}
