import { resultIsOk as adaptiveResultIsOk } from "#result"
import type { Result } from "#result"

export function resultIsOk<T>(result: Result<T>): result is Extract<Result<T>, { success: true }> {
  return adaptiveResultIsOk(result)
}
