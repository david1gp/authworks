import * as v from "valibot"
import type { ResultErr } from "#result"
import { createResultErrorCode } from "#result"
import { resultErrorCodeSchema } from "./resultErrorCodeSchema.js"

export function resultErrorCodedCreate(
  op: string,
  errorMessage: string,
  code: string,
  details?: Readonly<Record<string, unknown>>,
): ResultErr {
  const parsedCode = v.safeParse(resultErrorCodeSchema, code)
  const resolvedCode = parsedCode.success ? parsedCode.output : "platform.invalid-error-code"
  const resolvedDetails = parsedCode.success ? details : resultErrorDetailsWithAttemptedCodeCreate(details, code)
  const result = createResultErrorCode(op, errorMessage, resolvedCode)
  const errorData = resultErrorDetailsSerialize(resolvedDetails)
  if (errorData !== undefined) result.errorData = errorData
  return result
}

function resultErrorDetailsSerialize(details: Readonly<Record<string, unknown>> | undefined): string | undefined {
  if (details === undefined) return undefined
  try {
    const serialized = JSON.stringify(details)
    return typeof serialized === "string" ? serialized : undefined
  } catch (_error) {
    return undefined
  }
}

function resultErrorDetailsWithAttemptedCodeCreate(
  details: Readonly<Record<string, unknown>> | undefined,
  code: string,
): Readonly<Record<string, unknown>> {
  try {
    return { ...details, attemptedCode: code }
  } catch (_error) {
    return { attemptedCode: code }
  }
}
