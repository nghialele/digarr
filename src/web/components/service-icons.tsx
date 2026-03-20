import { Bell } from 'lucide-react'

function ServiceLogo({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="w-6 h-6 rounded" />
}

export function LidarrIcon() {
  return <ServiceLogo src="/icons/lidarr.png" alt="Lidarr" />
}

export function ListenBrainzIcon() {
  return <ServiceLogo src="/icons/listenbrainz.png" alt="ListenBrainz" />
}

export function LastfmIcon() {
  return <ServiceLogo src="/icons/lastfm.svg" alt="Last.fm" />
}

export function AiProviderIcon({ provider }: { provider?: string }) {
  const icons: Record<string, { src: string; alt: string }> = {
    anthropic: { src: '/icons/anthropic.png', alt: 'Anthropic' },
    openai: { src: '/icons/openai.png', alt: 'OpenAI' },
    gemini: { src: '/icons/gemini.png', alt: 'Google Gemini' },
    ollama: { src: '/icons/ollama.png', alt: 'Ollama' },
  }
  const icon = provider ? icons[provider] : null
  if (icon) return <ServiceLogo src={icon.src} alt={icon.alt} />
  // Generic fallback for openai-compatible or unknown
  return <ServiceLogo src="/icons/openai.png" alt="AI Provider" />
}

export function WebhookIcon() {
  return (
    <span className="flex items-center justify-center w-6 h-6 text-[#60a5fa]">
      <Bell size={18} />
    </span>
  )
}
