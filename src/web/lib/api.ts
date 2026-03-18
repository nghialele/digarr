const BASE = '/api'

const AUTH_TOKEN_KEY = 'digarr-auth-token'

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setStoredToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown,
  ) {
    super(`API Error ${status}`)
  }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getStoredToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    headers: { ...headers, ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    if (res.status === 401) {
      clearStoredToken()
      window.location.reload()
      throw new ApiError(res.status, { error: 'Session expired' })
    }
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, error)
  }
  return res.json() as Promise<T>
}

// Auth
export const getAuthStatus = () => fetchApi<{ required: boolean }>('/auth/status')

// Setup
export const getSetupStatus = () => fetchApi<{ setupComplete: boolean }>('/setup/status')
export const completeSetup = (config: Record<string, unknown>) =>
  fetchApi('/setup/complete', { method: 'POST', body: JSON.stringify(config) })

// Settings
export const getSettings = () => fetchApi<Record<string, unknown>>('/settings')
export const updateSettings = (partial: Record<string, unknown>) =>
  fetchApi('/settings', { method: 'PATCH', body: JSON.stringify(partial) })
export const testService = (service: string, config: Record<string, unknown>) =>
  fetchApi<{ success: boolean; message: string }>(`/settings/test/${service}`, {
    method: 'POST',
    body: JSON.stringify(config),
  })

// Pipeline
export const triggerPipeline = () => fetchApi('/pipeline/run', { method: 'POST' })
export const getPipelineStatus = () =>
  fetchApi<{ running: boolean; stage?: string; message?: string; lastRun?: unknown }>(
    '/pipeline/status',
  )
export const rescanArtists = () =>
  fetchApi<{ updated: number; total: number }>('/pipeline/rescan', { method: 'POST' })

// Recommendations
export const getRecommendations = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
  return fetchApi<{ items: unknown[]; total: number }>(`/recommendations${qs}`)
}
export const updateRecommendation = (id: number, body: Record<string, unknown>) =>
  fetchApi(`/recommendations/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
export const bulkAction = (ids: number[], action: string) =>
  fetchApi('/recommendations/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) })

// Batches
export const getBatches = () => fetchApi<unknown[]>('/batches')
export const getBatch = (id: number) => fetchApi<unknown>(`/batches/${id}`)

// Artists
export const getArtist = (id: number) => fetchApi<unknown>(`/artists/${id}`)

// Listening
export const getRecentListens = () =>
  fetchApi<{
    tracks: Array<{
      artist: string
      track: string
      source: string
      imageUrl?: string
      mbid?: string
    }>
  }>('/listening/recent')

// Quick discover
export const quickDiscover = (artistName: string) =>
  fetchApi<{ message: string }>('/pipeline/quick-discover', {
    method: 'POST',
    body: JSON.stringify({ artistName }),
  })

// Lidarr
export const getLidarrStats = () =>
  fetchApi<{ artists: number; monitored: number }>('/lidarr/stats')
export const getLidarrProfiles = () =>
  fetchApi<Array<{ id: number; name: string }>>('/lidarr/profiles')
export const getLidarrMetadataProfiles = () =>
  fetchApi<Array<{ id: number; name: string }>>('/lidarr/metadataprofiles')
export const getLidarrRootFolders = () =>
  fetchApi<Array<{ id: number; path: string; freeSpace?: number }>>('/lidarr/rootfolders')
export const addToLidarr = (body: Record<string, unknown>) =>
  fetchApi('/lidarr/add', { method: 'POST', body: JSON.stringify(body) })
