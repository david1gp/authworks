const invalidPercentEncoding = /%(?![0-9A-Fa-f]{2})/

/**
 * Validate an untrusted local return path without changing its exact value.
 */
export function localReturnPathSelect(returnPath: string | null | undefined, fallback: string): string {
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
