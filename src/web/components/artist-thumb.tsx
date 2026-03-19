import { useState } from 'react'

// ---------------------------------------------------------------------------
// ArtistThumb
// ---------------------------------------------------------------------------

/**
 * Artist avatar: shows the image if available, falls back to a colored
 * two-letter placeholder derived from the artist name.
 *
 * size -- grid unit (Tailwind style, multiplied by 4 to get px). Default: 10.
 */
export function ArtistThumb({
  name,
  imageUrl,
  size = 10,
}: {
  name: string
  imageUrl?: string | null
  size?: number
}) {
  const [imgError, setImgError] = useState(false)
  const px = size * 4
  const hue = Math.abs([...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360)

  if (imageUrl && !imgError) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="rounded-md shrink-0 object-cover bg-bg"
        style={{ width: `${px}px`, height: `${px}px` }}
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div
      className="rounded-md shrink-0 flex items-center justify-center font-bold text-bg"
      style={{
        width: `${px}px`,
        height: `${px}px`,
        background: `hsl(${hue}, 40%, 45%)`,
        fontSize: `${Math.max(size * 1.5, 12)}px`,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}
