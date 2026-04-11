import {
  getLocaleLabel,
  resolveSupportedLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@/core/i18n/locales'

export function LanguageSwitcher({
  value,
  onChange,
}: {
  value: SupportedLocale
  onChange: (value: SupportedLocale) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span>Language</span>
      <select
        aria-label="Language"
        value={value}
        onChange={(e) => onChange(resolveSupportedLocale(e.target.value))}
        className="rounded-md border border-border bg-surface px-2 py-1 text-text"
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {getLocaleLabel(locale)}
          </option>
        ))}
      </select>
    </label>
  )
}
