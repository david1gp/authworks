import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

const cookieNamePattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
const cookieValuePattern = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/

export function sessionBrowserCookieParse(
  cookieHeader: string | null | undefined,
): Result<Readonly<Record<string, string>>> {
  const op = "sessionBrowserCookieParse"
  if (cookieHeader === undefined || cookieHeader === null || cookieHeader.trim() === "") return resultCreate({})
  const entries: Array<readonly [string, string]> = []
  const names = new Set<string>()
  for (const part of cookieHeader.split(";")) {
    const pair = part.trim()
    if (pair === "") continue
    const separator = pair.indexOf("=")
    if (separator < 1) return resultErrorCreate(op, "The browser cookie header is invalid.", "sessions.invalid")
    const name = pair.slice(0, separator).trim()
    const rawValue = pair.slice(separator + 1).trim()
    if (!cookieNamePattern.test(name) || names.has(name))
      return resultErrorCreate(op, "The browser cookie header is invalid.", "sessions.invalid")
    const value = sessionBrowserCookieValueParse(rawValue)
    if (value === undefined) return resultErrorCreate(op, "The browser cookie header is invalid.", "sessions.invalid")
    names.add(name)
    entries.push([name, value])
  }
  return resultCreate(Object.fromEntries(entries))
}

function sessionBrowserCookieValueParse(value: string): string | undefined {
  if (value.startsWith('"')) {
    if (!value.endsWith('"') || value.length < 2) return undefined
    const unquoted = value.slice(1, -1)
    return cookieValuePattern.test(unquoted) ? unquoted : undefined
  }
  return cookieValuePattern.test(value) ? value : undefined
}
