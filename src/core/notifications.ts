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

function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    const hostname = url.hostname
    // IPv4 private ranges
    if (/^127\./.test(hostname)) return true
    if (/^10\./.test(hostname)) return true
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true
    if (/^192\.168\./.test(hostname)) return true
    // IPv6 loopback and private (hostname includes brackets for IPv6)
    const bare = hostname.replace(/^\[|\]$/g, '')
    if (bare === '::1') return true
    if (/^f[cd]/i.test(bare)) return true
    // localhost
    if (hostname === 'localhost') return true
    return false
  } catch {
    return true // invalid URL = reject
  }
}

export async function sendWebhook(url: string, payload: WebhookPayload): Promise<void> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.error('Webhook URL must use http:// or https://')
    return
  }
  if (isPrivateUrl(url)) {
    console.error('Webhook URL points to a private/internal address')
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!res.ok) {
      console.error(`Webhook POST to ${url} failed: HTTP ${res.status}`)
    }
  } catch (err) {
    console.error(`Webhook POST to ${url} failed:`, err)
  } finally {
    clearTimeout(timeout)
  }
}

// Re-export isPrivateUrl for testing
export { isPrivateUrl }
