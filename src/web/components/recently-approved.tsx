import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Skeleton } from './ui/skeleton'

// ---------------------------------------------------------------------------
// RecentlyApproved
// ---------------------------------------------------------------------------

type RecentlyApprovedProps = {
  recs: Array<{
    id: number
    artist: { name: string; imageUrl?: string | null; genres?: string[] | null }
  }>
  loading: boolean
}

function Tile({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const [imgError, setImgError] = useState(false)
  const hue = Math.abs([...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360)

  return (
    <Link to="/discover" className="aspect-square rounded-lg overflow-hidden relative group block">
      {imageUrl && !imgError ? (
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="w-full h-full"
          style={{ background: `hsl(${hue}, 40%, 45%)` }}
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
        <p className="text-white text-xs font-medium truncate">{name}</p>
      </div>
    </Link>
  )
}

export function RecentlyApproved({ recs, loading }: RecentlyApprovedProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    )
  }

  if (recs.length === 0) {
    return (
      <div className="grid grid-cols-3 gap-1.5 min-h-[200px]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-bg border border-border" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {recs.slice(0, 6).map((rec) => (
        <Tile key={rec.id} name={rec.artist.name} imageUrl={rec.artist.imageUrl} />
      ))}
      {Array.from({ length: Math.max(0, 6 - recs.length) }).map((_, i) => (
        <div key={`empty-${i}`} className="aspect-square rounded-lg bg-bg border border-border" />
      ))}
    </div>
  )
}
