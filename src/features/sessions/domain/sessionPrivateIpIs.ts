/** Detects loopback, private, link-local, and documentation addresses that need no lookup. */
export function sessionPrivateIpIs(ip: string): boolean {
  const normalized = ip.trim()
  if (normalized.length === 0) return true
  if (normalized.includes(":")) return sessionPrivateIpv6Is(normalized.toLowerCase())
  const octets = normalized.split(".")
  if (octets.length !== 4) return true
  const numbers: number[] = []
  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet)) return true
    const value = Number(octet)
    if (!Number.isSafeInteger(value) || value < 0 || value > 255) return true
    numbers.push(value)
  }
  const [first, second] = numbers as [number, number, number, number]
  if (first === 0 || first === 127 || first >= 224) return true
  if (first === 10) return true
  if (first === 172 && second >= 16 && second <= 31) return true
  if (first === 192 && second === 168) return true
  if (first === 169 && second === 254) return true
  if (first === 192 && second === 0 && numbers[2] === 2) return true
  if (first === 198 && second === 51 && numbers[2] === 100) return true
  if (first === 203 && second === 0 && numbers[2] === 113) return true
  return false
}

function sessionPrivateIpv6Is(lower: string): boolean {
  if (lower === "::1" || lower === "::" || lower === "::ffff:127.0.0.1") return true
  if (lower === "localhost") return true
  if (lower.startsWith("fe80:")) return true
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true
  if (lower.startsWith("2001:db8")) return true
  return false
}
