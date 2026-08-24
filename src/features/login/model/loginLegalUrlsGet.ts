type LoginLegalUrls = {
  readonly privacyUrl: string
  readonly termsUrl: string
}

const absoluteHttpUrlPattern = /^https?:\/\/[^\s/]+/i

export function loginLegalUrlsGet(value: unknown): LoginLegalUrls | undefined {
  if (typeof value !== "object" || value === null) return undefined

  const termsUrl = loginLegalUrlGet((value as { readonly termsUrl?: unknown }).termsUrl)
  if (termsUrl === undefined) return undefined
  const privacyUrl = loginLegalUrlGet((value as { readonly privacyUrl?: unknown }).privacyUrl)
  if (privacyUrl === undefined) return undefined

  return { privacyUrl, termsUrl }
}

function loginLegalUrlGet(value: unknown): string | undefined {
  if (typeof value !== "string" || !absoluteHttpUrlPattern.test(value)) return undefined

  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    if (url.hostname.length === 0) return undefined
  } catch {
    return undefined
  }

  return value
}
