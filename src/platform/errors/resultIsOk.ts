import type { Result } from "#result"
import { resultIsOk as adaptiveResultIsOk } from "#result"

export function resultIsOk<T>(result: Result<T>): result is Extract<Result<T>, { success: true }> {
  return adaptiveResultIsOk(result)
}
