import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export function oidcRedirectUriValidate(uri: string, allowHttpLocalhost = true): Result<string> {
  const op = "oidcRedirectUriValidate"
  if (uri.length === 0 || uri.length > 2048) return resultErrorCreate(op, "The redirect URI is invalid.")
  let parsed: URL
  try {
    parsed = new URL(uri)
  } catch (_error) {
    return resultErrorCreate(op, "The redirect URI is invalid.")
  }
  if (parsed.username.length > 0 || parsed.password.length > 0 || parsed.hash.length > 0)
    return resultErrorCreate(op, "The redirect URI is invalid.")
  const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]"
  if (parsed.protocol !== "https:" && !(allowHttpLocalhost && isLocalhost && parsed.protocol === "http:"))
    return resultErrorCreate(op, "The redirect URI must use HTTPS.")
  return resultCreate(uri)
}
