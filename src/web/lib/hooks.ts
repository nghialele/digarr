import { useEffect, useState } from 'react'
import { getStoredToken } from './api'

export function useSSE(url: string) {
  const [data, setData] = useState<unknown>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // EventSource doesn't support custom headers, so pass token as query param
    const token = getStoredToken()
    const separator = url.includes('?') ? '&' : '?'
    const authedUrl = token ? `${url}${separator}token=${encodeURIComponent(token)}` : url
    const source = new EventSource(authedUrl)
    source.onopen = () => setConnected(true)
    source.onmessage = (e) => setData(JSON.parse(e.data as string) as unknown)
    source.onerror = () => setConnected(false)
    return () => source.close()
  }, [url])

  return { data, connected }
}
