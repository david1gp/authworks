import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { sessionBrowserCookieParse } from "./sessionBrowserCookieParse.js"

const cookieNamePattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

export function sessionBrowserCookieExtract(
  cookieHeader: string | null | undefined,
  name: string,
): Result<string | undefined> {
  const op = "sessionBrowserCookieExtract"
  if (!cookieNamePattern.test(name))
    return resultErrorCreate(op, "The browser cookie name is invalid.", "sessions.invalid")
  const parsed = sessionBrowserCookieParse(cookieHeader)
  if (!parsed.success) return parsed
  return resultCreate(parsed.data[name])
}
