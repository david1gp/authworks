import { createResultError } from "#result"
import type { ResultErr } from "#result"

export function resultErrorCreate(op: string, errorMessage: string, errorData?: string | null): ResultErr {
  return createResultError(op, errorMessage, errorData)
}
