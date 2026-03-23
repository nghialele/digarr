import { lookup } from 'node:dns/promises'
import { isHttpUrl } from './validation'

export type WebhookPayload = {
  event: 'batch_complete'
  batchId: number
  stats: {
    discovered: number
    added: number
    failed: number
  }
  message: string
  timestamp: string
}

export function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    const hostname = url.hostname
    // IPv4 private ranges
    if (/^127\./.test(hostname)) return true
    if (/^10\./.test(hostname)) return true
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true
    if (/^192\.168\./.test(hostname)) return true
    if (/^169\.254\./.test(hostname)) return true // link-local / cloud metadata
    if (hostname === '0.0.0.0') return true
    // IPv6 loopback and private (hostname includes brackets for IPv6)
    const bare = hostname.replace(/^\[|\]$/g, '')
    if (bare === '::1') return true
    if (/^f[cd]/i.test(bare)) return true
    if (/^fe80/i.test(bare)) return true // link-local IPv6
    // localhost
    if (hostname === 'localhost') return true
    return false
  } catch {
    return true // invalid URL = reject
  }
}

function isDiscordWebhook(url: string): boolean {
  try {
    const u = new URL(url)
    return u.hostname.endsWith('discord.com') || u.hostname.endsWith('discordapp.com')
  } catch {
    return false
  }
}

function formatDiscordPayload(payload: WebhookPayload): Record<string, unknown> {
  const { stats, message } = payload
  return {
    embeds: [
      {
        title: 'Scan Complete',
        description: message,
        color: 0x7c3aed, // accent purple
        fields: [
          { name: 'Discovered', value: String(stats.discovered), inline: true },
          { name: 'Added', value: String(stats.added), inline: true },
          { name: 'Failed', value: String(stats.failed), inline: true },
        ],
        timestamp: payload.timestamp,
        footer: { text: 'digarr' },
      },
    ],
  }
}

/** Resolve hostname and check if the resolved IP is private (DNS rebinding mitigation). */
async function resolvedIpIsPrivate(hostname: string): Promise<boolean> {
  try {
    const { address } = await lookup(hostname)
    return (
      /^127\./.test(address) ||
      /^10\./.test(address) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(address) ||
      /^192\.168\./.test(address) ||
      /^169\.254\./.test(address) ||
      address === '0.0.0.0' ||
      address === '::1' ||
      /^f[cd]/i.test(address) ||
      /^fe80/i.test(address)
    )
  } catch {
    return true // unresolvable = reject
  }
}

export async function sendWebhook(url: string, payload: WebhookPayload): Promise<void> {
  if (!isHttpUrl(url)) {
    console.error('Webhook URL must use http:// or https://')
    return
  }
  if (isPrivateUrl(url)) {
    console.error('Webhook URL points to a private/internal address')
    return
  }

  // DNS rebinding mitigation: verify the resolved IP is also not private
  try {
    const hostname = new URL(url).hostname
    if (await resolvedIpIsPrivate(hostname)) {
      console.error('Webhook URL resolves to a private/internal IP address')
      return
    }
  } catch {
    console.error('Webhook URL hostname resolution failed')
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  const safeUrl = url.replace(/:\/\/[^@]*@/, '://***@')
  const body = isDiscordWebhook(url) ? formatDiscordPayload(payload) : payload

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      console.error(`Webhook POST to ${safeUrl} failed: HTTP ${res.status}`)
    }
  } catch (err: unknown) {
    console.error(`Webhook POST to ${safeUrl} failed:`, err)
  } finally {
    clearTimeout(timeout)
  }
}
