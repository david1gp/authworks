import type { ResultErr } from "#result"
import { e2eServiceUserEnsureFailureExitCodes } from "./e2eServiceUserEnsureFailureExitCodes.js"

const internalFailureCode = "e2e.service-user-ensure.internal-failed"

export function e2eServiceUserEnsureFailureOutputCreate(failure: ResultErr | string): string {
  const candidate = typeof failure === "string" ? failure : failure.code
  const code =
    candidate !== undefined && e2eServiceUserEnsureFailureExitCodes.has(candidate) ? candidate : internalFailureCode
  return `${JSON.stringify({ error: { code } })}\n`
}

export function e2eServiceUserEnsureExitCodeGet(failure: ResultErr | string): number {
  if (typeof failure === "string") return e2eServiceUserEnsureFailureExitCodes.get(failure) ?? 1
  const mappedCode = failure.code === undefined ? undefined : e2eServiceUserEnsureFailureExitCodes.get(failure.code)
  if (mappedCode !== undefined) return mappedCode
  if (failure.code === "platform.unreachable" || failure.code === "platform.unavailable") return 52
  if (failure.code === "platform.unauthorized" || failure.statusCode === 401) return 53
  if (failure.code === "platform.forbidden" || failure.statusCode === 403) return 54
  if (failure.code === "platform.rate-limited" || failure.statusCode === 429) return 55
  if (failure.code === "platform.invalid-response") return 56
  if (failure.statusCode !== undefined && failure.statusCode >= 500) return 65
  return 1
}
