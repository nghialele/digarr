import { describe, expect, it } from 'vitest'
import { isIpInCidr, isIpTrusted } from '@/core/auth/cidr'

describe('isIpInCidr', () => {
  it('matches IP in /24 subnet', () => {
    expect(isIpInCidr('192.168.1.50', '192.168.1.0/24')).toBe(true)
  })
  it('rejects IP outside /24 subnet', () => {
    expect(isIpInCidr('192.168.2.1', '192.168.1.0/24')).toBe(false)
  })
  it('matches IP in /12 subnet', () => {
    expect(isIpInCidr('172.16.5.10', '172.16.0.0/12')).toBe(true)
  })
  it('handles /32 (single host)', () => {
    expect(isIpInCidr('10.0.0.1', '10.0.0.1/32')).toBe(true)
    expect(isIpInCidr('10.0.0.2', '10.0.0.1/32')).toBe(false)
  })
  it('handles CIDR without mask (treats as /32)', () => {
    expect(isIpInCidr('10.0.0.1', '10.0.0.1')).toBe(true)
  })
  it('handles /0 (match all IPs)', () => {
    expect(isIpInCidr('8.8.8.8', '0.0.0.0/0')).toBe(true)
    expect(isIpInCidr('192.168.1.1', '0.0.0.0/0')).toBe(true)
  })
})

describe('isIpTrusted', () => {
  it('returns true if IP matches any CIDR in list', () => {
    expect(isIpTrusted('192.168.1.5', ['10.0.0.0/8', '192.168.0.0/16'])).toBe(true)
  })
  it('returns false if IP matches no CIDR', () => {
    expect(isIpTrusted('8.8.8.8', ['10.0.0.0/8', '192.168.0.0/16'])).toBe(false)
  })
  it('returns false for empty CIDR list', () => {
    expect(isIpTrusted('10.0.0.1', [])).toBe(false)
  })
  it('handles IPv4-mapped IPv6 addresses', () => {
    expect(isIpTrusted('::ffff:192.168.1.5', ['192.168.0.0/16'])).toBe(true)
  })
})
