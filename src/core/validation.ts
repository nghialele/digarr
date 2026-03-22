export function isHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
