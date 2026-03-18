import { useCallback, useEffect, useState } from 'react'
import { getStoredToken } from './api'

export function useFetch<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetcher()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}

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
