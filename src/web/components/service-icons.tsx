import { Bell, Bot, Headphones, Music4, Radio } from 'lucide-react'

function ServiceIcon({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="flex items-center justify-center w-6 h-6 rounded" style={{ color }}>
      {children}
    </span>
  )
}

export function LidarrIcon() {
  return (
    <ServiceIcon color="#00a651">
      <Music4 size={18} />
    </ServiceIcon>
  )
}

export function ListenBrainzIcon() {
  return (
    <ServiceIcon color="#eb743b">
      <Headphones size={18} />
    </ServiceIcon>
  )
}

export function LastfmIcon() {
  return (
    <ServiceIcon color="#d51007">
      <Radio size={18} />
    </ServiceIcon>
  )
}

export function AiProviderIcon() {
  return (
    <ServiceIcon color="#a78bfa">
      <Bot size={18} />
    </ServiceIcon>
  )
}

export function WebhookIcon() {
  return (
    <ServiceIcon color="#60a5fa">
      <Bell size={18} />
    </ServiceIcon>
  )
}
