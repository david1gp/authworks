type OidcBasicCredentials = {
  readonly clientId: string
  readonly clientSecret?: string
}

/**
 * Parse RFC 7617 Basic credentials: base64 of UTF-8 `client_id:client_secret`,
 * split on the first colon. The decoded value is used verbatim: no
 * `decodeURIComponent` and no `+`-to-space handling, so secrets containing
 * `%`, `+`, spaces, colons, or non-ASCII bytes round-trip exactly.
 */
export function oidcBasicCredentialsParse(
  authorization: string | undefined,
  body: Record<string, string>,
): (OidcBasicCredentials & { readonly success: true }) | { readonly success: false } {
  const bodyClientId = body.client_id
  const bodyClientSecret = body.client_secret
  if (authorization === undefined) {
    if (bodyClientId === undefined) return { success: false }
    return {
      clientId: bodyClientId,
      ...(bodyClientSecret === undefined ? {} : { clientSecret: bodyClientSecret }),
      success: true,
    }
  }
  const basic = /^Basic\s+(\S+)$/i.exec(authorization)
  if (basic === null) return { success: false }
  try {
    const decoded = Buffer.from(basic[1] ?? "", "base64").toString("utf8")
    const separator = decoded.indexOf(":")
    if (separator < 1 || bodyClientSecret !== undefined) return { success: false }
    const clientId = decoded.slice(0, separator)
    const clientSecret = decoded.slice(separator + 1)
    if (bodyClientId !== undefined && bodyClientId !== clientId) return { success: false }
    return { clientId, clientSecret, success: true }
  } catch (_error) {
    return { success: false }
  }
}
