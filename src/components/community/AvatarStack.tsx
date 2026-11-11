import { Avatar } from '@/components/ui/avatar'
import type { Author } from '@/lib/communityProfile'

/** Rostinhos sobrepostos de quem está lendo. */
export function AvatarStack({ people, size = 22 }: { people: Author[]; size?: number }) {
  if (!people.length) return null
  return (
    <span className="inline-flex items-center">
      {people.slice(0, 3).map((person, i) => (
        <span key={person.userId} className="rounded-full p-[1.5px]" style={{ backgroundColor: 'var(--theme-card-bg)', marginLeft: i ? -size / 3 : 0, zIndex: 3 - i }}>
          <Avatar src={person.avatarUrl} name={person.name || person.handle} size={size} />
        </span>
      ))}
    </span>
  )
}
