import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"

export function oidcRedirectUriValidate(uri: string, allowHttpLocalhost = true, devMode = false): Result<string> {
  const op = "oidcRedirectUriValidate"
  if (uri.length === 0 || uri.length > 2048)
    return resultErrorCreate(op, "The redirect URI is invalid.", "oidc.redirect-uri-invalid")
  let parsed: URL
  try {
    parsed = new URL(uri)
  } catch (_error) {
    return resultErrorCreate(op, "The redirect URI is invalid.", "oidc.redirect-uri-invalid")
  }
  if (parsed.username.length > 0 || parsed.password.length > 0 || parsed.hash.length > 0)
    return resultErrorCreate(op, "The redirect URI is invalid.", "oidc.redirect-uri-invalid")
  // Dev-mode clients (Zitadel dev_mode parity) may register plain-http
  // redirects on any host; production clients stay https-only except the
  // long-standing http-on-loopback allowance.
  if (devMode && parsed.protocol === "http:") return resultCreate(uri)
  const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]"
  if (parsed.protocol !== "https:" && !(allowHttpLocalhost && isLocalhost && parsed.protocol === "http:"))
    return resultErrorCreate(op, "The redirect URI must use HTTPS.", "oidc.redirect-uri-invalid")
  return resultCreate(uri)
}
