import type { ResultErr } from "#result"
import { resultErrorDetailsParse } from "../../../platform/errors/resultErrorDetailsParse.js"

export function loginRetryAfterSecondsGet(result: ResultErr): number | undefined {
  const details = resultErrorDetailsParse(result)
  const retryAfterSeconds = details?.retryAfterSeconds
  if (typeof retryAfterSeconds === "number" && Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds > 0)
    return retryAfterSeconds
  if (typeof retryAfterSeconds === "string" && /^\d+$/.test(retryAfterSeconds)) {
    const parsedRetryAfterSeconds = Number(retryAfterSeconds)
    if (Number.isSafeInteger(parsedRetryAfterSeconds) && parsedRetryAfterSeconds > 0) return parsedRetryAfterSeconds
  }
  const retryAfter = details?.retryAfter
  if (typeof retryAfter !== "string" || !/^\d+$/.test(retryAfter)) return undefined
  const parsedRetryAfter = Number(retryAfter)
  return Number.isSafeInteger(parsedRetryAfter) && parsedRetryAfter > 0 ? parsedRetryAfter : undefined
}
