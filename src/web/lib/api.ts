import type { GenreInfo } from '../../core/genre/types'

export type LibraryArtist = {
  id: number
  mbid: string
  name: string
  disambiguation: string | null
  genres: string[] | null
  imageUrl: string | null
}

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

// Fired when any fetchApi call gets 401 -- AuthGate listens and shows login
export const AUTH_EXPIRED_EVENT = 'digarr:auth-expired'

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
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
      throw new ApiError(res.status, { error: 'Session expired' })
    }
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, error)
  }
  return res.json() as Promise<T>
}

// Auth
export type AuthStatus = {
  required: boolean
  hasUsers: boolean
  oidcEnabled?: boolean
  proxyAuthEnabled?: boolean
  proxyAuth?: boolean
  token?: string
  userId?: number
}
export const getAuthStatus = () => fetchApi<AuthStatus>('/auth/status')

export type AuthResponse = {
  user: { id: number; username: string; isAdmin: boolean }
  token: string
}
export const loginUser = (username: string, password: string) =>
  fetchApi<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
export const registerUser = (username: string, password: string) =>
  fetchApi<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
export type UserProfile = { id: number; username: string; isAdmin: boolean }
export const getCurrentUser = () => fetchApi<UserProfile>('/auth/me')
export const changePassword = (currentPassword: string, newPassword: string) =>
  fetchApi<{ ok: boolean; token?: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })

export const logoutUser = () => fetchApi<{ ok: boolean }>('/auth/logout', { method: 'POST' })

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
export const testWebhook = () =>
  fetchApi<{ success: boolean; message: string }>('/settings/test-webhook', { method: 'POST' })

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
export const approveRecommendation = (
  id: number,
  options?: { monitorOption?: string; selectedAlbumIds?: string[] },
) => updateRecommendation(id, { status: 'approved', ...options })
export const bulkAction = (ids: number[], action: string) =>
  fetchApi('/recommendations/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) })

// Albums
export type ReleaseGroup = {
  id: string
  title: string
  type: string
  firstReleaseDate?: string
}
export const getAlbums = (mbid: string) =>
  fetchApi<ReleaseGroup[]>(`/albums/${encodeURIComponent(mbid)}`)

// Batches
export const getBatches = () => fetchApi<unknown[]>('/batches')
export const getBatch = (id: number) => fetchApi<unknown>(`/batches/${id}`)

// Artists
export const getArtist = (id: number) => fetchApi<unknown>(`/artists/${id}`)

// Listening
export const getRecentListens = (range = 'month', limit = 5) => {
  const qs = new URLSearchParams({ range, limit: String(limit) })
  return fetchApi<{
    tracks: Array<{
      artist: string
      track: string
      source: string
      imageUrl?: string
      mbid?: string
    }>
  }>(`/listening/recent?${qs}`)
}

// Quick discover
export const quickDiscover = (artistName: string) =>
  fetchApi<{ message: string }>('/pipeline/quick-discover', {
    method: 'POST',
    body: JSON.stringify({ artistName }),
  })

// Analytics
export type AnalyticsOverview = {
  totalRecs: number
  approvalRate: number
  avgScore: number
  totalBatches: number
}
export type AnalyticsBatch = {
  id: number
  createdAt: string
  status: string
  stats: unknown
  total: number
  approved: number
  rejected: number
  pending: number
}
export type AnalyticsGenre = {
  genre: string
  count: number
  approved: number
  approvalRate: number
}
export type AnalyticsSource = {
  source: string
  count: number
  avgScore: number
  approved: number
  approvalRate: number
}
export const getAnalyticsOverview = () => fetchApi<AnalyticsOverview>('/analytics/overview')
export const getAnalyticsBatches = () => fetchApi<AnalyticsBatch[]>('/analytics/batches')
export const getAnalyticsGenres = () => fetchApi<AnalyticsGenre[]>('/analytics/genres')
export const getAnalyticsSources = () => fetchApi<AnalyticsSource[]>('/analytics/sources')

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

// Library Health
export type HealthCheckItem = {
  artistId: number
  artistName: string
  mbid: string
  detail: string
}
export type HealthCheckResult = {
  id: string
  name: string
  description: string
  severity: 'info' | 'warning' | 'error'
  count: number
  items: HealthCheckItem[]
  fixable: boolean
}
export type HealthCheckResponse = {
  checks: HealthCheckResult[]
  cached: boolean
}
export type LibraryStats = {
  totalArtists: number
  totalAlbums: number
  monitoredArtists: number
  genreDistribution: Array<{ genre: string; count: number }>
  rootFolders: Array<{ path: string; freeSpace: number }>
}
export const getLibraryHealth = () => fetchApi<HealthCheckResponse>('/library/health')
export const scanLibraryHealth = () =>
  fetchApi<HealthCheckResponse>('/library/health/scan', { method: 'POST' })
export const fixHealthCheck = (checkId: string) =>
  fetchApi<unknown>(`/library/health/${encodeURIComponent(checkId)}/fix`, { method: 'POST' })
export const getLibraryStats = () => fetchApi<LibraryStats>('/library/stats')

// Genres
export const getGenres = () => fetchApi<GenreInfo[]>('/genres')
export const searchGenres = (q: string) =>
  fetchApi<GenreInfo[]>(`/genres/search?q=${encodeURIComponent(q)}`)
export const getGenre = (slug: string) =>
  fetchApi<GenreInfo & { subGenres: GenreInfo[]; libraryArtists: LibraryArtist[] }>(
    `/genres/${encodeURIComponent(slug)}`,
  )
export const seedGenres = () => fetchApi<{ message: string }>('/genres/seed', { method: 'POST' })

// Library warm status
export const getWarmStatuses = (mbids: string) =>
  fetchApi<{ statuses: Record<string, string> }>(`/library/warm/status?mbids=${mbids}`)
export const warmArtists = (mbids: string[]) =>
  fetchApi('/library/warm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mbids }),
  })

// User management (admin)
export const listUsers = () =>
  fetchApi<
    Array<{
      id: number
      username: string
      isAdmin: boolean
      email: string | null
      oidcSubject: string | null
      authProvider: string
      createdAt: string
    }>
  >('/users')
export const updateUserAdmin = (id: number, isAdmin: boolean) =>
  fetchApi(`/users/${id}`, { method: 'PATCH', body: JSON.stringify({ isAdmin }) })
export const deleteUserApi = (id: number) => fetchApi(`/users/${id}`, { method: 'DELETE' })
