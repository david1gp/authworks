const invalidPercentEncoding = /%(?![0-9A-Fa-f]{2})/

/**
 * Client-side guard mirroring the server return-path rules so the hosted login never navigates to
 * an attacker-controlled destination. The server revalidates every handle it receives.
 */
export function loginReturnPathSelect(returnPath: string | null | undefined, fallback: string): string {
  if (
    returnPath === null ||
    returnPath === undefined ||
    returnPath.length === 0 ||
    returnPath.length > 2048 ||
    !returnPath.startsWith("/") ||
    returnPath.startsWith("//") ||
    returnPath.includes("\\") ||
    invalidPercentEncoding.test(returnPath)
  )
    return fallback
  let decoded: string
  try {
    decoded = decodeURIComponent(returnPath)
  } catch (_error) {
    return fallback
  }
  if (decoded.startsWith("//") || decoded.includes("\\")) return fallback
  for (const character of decoded) {
    const codePoint = character.codePointAt(0) ?? 0
    if (codePoint <= 0x1f || codePoint === 0x7f) return fallback
  }
  return returnPath
}
