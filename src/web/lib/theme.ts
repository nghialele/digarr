export type Mode = 'dark' | 'light' | 'system'

export type ColorTheme =
  | 'tokyonight'
  | 'catppuccin'
  | 'dracula'
  | 'nord'
  | 'gruvbox'
  | 'solarized'
  | 'rosepine'

export const COLOR_THEMES: { id: ColorTheme; name: string }[] = [
  { id: 'tokyonight', name: 'Tokyo Night' },
  { id: 'catppuccin', name: 'Catppuccin' },
  { id: 'dracula', name: 'Dracula' },
  { id: 'nord', name: 'Nord' },
  { id: 'gruvbox', name: 'Gruvbox' },
  { id: 'solarized', name: 'Solarized' },
  { id: 'rosepine', name: 'Rose Pine' },
]

const MODE_KEY = 'digarr-theme'
const COLOR_KEY = 'digarr-color-theme'

// Keep backward compat: old 'dark'/'light' values still work as Mode
export function getStoredMode(): Mode {
  const stored = localStorage.getItem(MODE_KEY)
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  return 'system'
}

export function setStoredMode(mode: Mode): void {
  localStorage.setItem(MODE_KEY, mode)
}

export function getStoredColorTheme(): ColorTheme {
  const stored = localStorage.getItem(COLOR_KEY)
  if (COLOR_THEMES.some((t) => t.id === stored)) return stored as ColorTheme
  return 'tokyonight'
}

export function setStoredColorTheme(theme: ColorTheme): void {
  localStorage.setItem(COLOR_KEY, theme)
}

export function resolveMode(mode: Mode): 'dark' | 'light' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return mode
}

export function applyTheme(colorTheme: ColorTheme, mode: Mode): void {
  const resolved = resolveMode(mode)
  document.documentElement.setAttribute('data-theme', `${colorTheme}-${resolved}`)
}

// Backward-compat aliases
export type Theme = Mode
export const getStoredTheme = getStoredMode
export const setStoredTheme = setStoredMode
export const resolveTheme = resolveMode
