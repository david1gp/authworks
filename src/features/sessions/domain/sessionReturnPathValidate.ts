import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

const invalidPercentEncodingPattern = /%(?![0-9A-Fa-f]{2})/

export function sessionReturnPathValidate(returnPath: string | null | undefined, publicOrigin: string): Result<string> {
  const op = "sessionReturnPathValidate"
  const configured = sessionPublicOriginParse(publicOrigin)
  if (configured === undefined)
    return resultErrorCreate(op, "The configured public origin is invalid.", "sessions.invalid")
  if (
    returnPath === null ||
    returnPath === undefined ||
    returnPath.length === 0 ||
    returnPath.length > 2048 ||
    !returnPath.startsWith("/") ||
    returnPath.startsWith("//") ||
    returnPath.includes("\\") ||
    sessionReturnPathContainsControlCharacter(returnPath) ||
    invalidPercentEncodingPattern.test(returnPath)
  )
    return resultErrorCreate(op, "The browser return path is invalid.", "sessions.invalid")
  let decoded: string
  let resolved: URL
  try {
    decoded = decodeURIComponent(returnPath)
    resolved = new URL(returnPath, configured.origin)
  } catch (_error) {
    return resultErrorCreate(op, "The browser return path is invalid.", "sessions.invalid")
  }
  if (
    decoded.includes("\\") ||
    decoded.startsWith("//") ||
    sessionReturnPathContainsControlCharacter(decoded) ||
    resolved.origin !== configured.origin ||
    resolved.username !== "" ||
    resolved.password !== "" ||
    resolved.pathname.startsWith("//")
  )
    return resultErrorCreate(op, "The browser return path is invalid.", "sessions.invalid")
  return resultCreate(resolved.pathname + resolved.search + resolved.hash)
}

function sessionReturnPathContainsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    if (codePoint <= 0x1f || codePoint === 0x7f) return true
  }
  return false
}

function sessionPublicOriginParse(value: string): URL | undefined {
  try {
    const parsed = new URL(value)
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.search !== "" ||
      parsed.hash !== ""
    )
      return undefined
    return parsed
  } catch (_error) {
    return undefined
  }
}
