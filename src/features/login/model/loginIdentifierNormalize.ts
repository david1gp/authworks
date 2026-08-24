/** Normalizes identifiers exactly once before they are submitted or remembered. */
export function loginIdentifierNormalize(value: string): string {
  const trimmed = value.trim()
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed
}
