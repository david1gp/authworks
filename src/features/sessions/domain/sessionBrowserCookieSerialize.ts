import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

const cookieNamePattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
const cookieValuePattern = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/

type SessionBrowserCookieSerializeOptions = Readonly<{
  readonly expires?: Date
  readonly maxAge?: number
}>

export function sessionBrowserCookieSerialize(
  name: string,
  value: string,
  options: SessionBrowserCookieSerializeOptions = {},
): Result<string> {
  const op = "sessionBrowserCookieSerialize"
  if (!cookieNamePattern.test(name) || !cookieValuePattern.test(value))
    return resultErrorCreate(op, "The browser cookie is invalid.", "sessions.invalid")
  if (
    options.maxAge !== undefined &&
    (!Number.isSafeInteger(options.maxAge) || options.maxAge < 0 || options.maxAge > 2_147_483_647)
  )
    return resultErrorCreate(op, "The browser cookie lifetime is invalid.", "sessions.invalid")
  if (options.expires !== undefined && Number.isNaN(options.expires.getTime()))
    return resultErrorCreate(op, "The browser cookie expiry is invalid.", "sessions.invalid")
  const attributes = ["Path=/", "HttpOnly", "Secure", "SameSite=Lax"]
  if (options.maxAge !== undefined) attributes.push(`Max-Age=${options.maxAge}`)
  if (options.expires !== undefined) attributes.push(`Expires=${options.expires.toUTCString()}`)
  return resultCreate(`${name}=${value}; ${attributes.join("; ")}`)
}
