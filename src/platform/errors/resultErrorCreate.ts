import type { ResultErr } from "#result"
import { createResultError } from "#result"

export function resultErrorCreate(op: string, errorMessage: string, errorData?: string | null): ResultErr {
  return createResultError(op, errorMessage, errorData)
}
