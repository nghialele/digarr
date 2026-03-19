import { useNavigate } from 'react-router-dom'

export type GenreCardProps = {
  name: string
  slug: string
  artistCount: number
}

// Stable hue from genre name -- same hash as ArtistThumb
function genreHue(name: string): number {
  return Math.abs([...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360)
}

export function GenreCard({ name, slug, artistCount }: GenreCardProps) {
  const navigate = useNavigate()
  const hue = genreHue(name)

  return (
    <button
      type="button"
      onClick={() => navigate(`/genres/${slug}`)}
      className="bg-surface border border-border rounded-lg p-4 text-left hover:border-accent/60 transition-colors group w-full"
      style={{ borderTopColor: `hsl(${hue}, 45%, 45%)`, borderTopWidth: '3px' }}
    >
      <p
        className="text-sm font-semibold text-text group-hover:text-accent transition-colors truncate"
        title={name}
      >
        {name}
      </p>
      <p className="text-xs text-muted mt-1">
        {artistCount} artist{artistCount !== 1 ? 's' : ''}
      </p>
    </button>
  )
}
