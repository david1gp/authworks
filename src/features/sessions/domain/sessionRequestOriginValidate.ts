import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

export function sessionRequestOriginValidate(request: Request, publicOrigin: string): Result<boolean> {
  const op = "sessionRequestOriginValidate"
  const configured = sessionPublicOriginParse(publicOrigin)
  if (configured === undefined)
    return resultErrorCreate(op, "The configured public origin is invalid.", "sessions.invalid")
  return resultCreate(request.headers.get("origin") === configured.origin)
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
