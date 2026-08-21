import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCodedCreate } from "../errors/resultErrorCodedCreate.js"

export function patchInputParse<TSchema extends v.GenericSchema<Record<string, unknown>>>(
  op: string,
  schema: TSchema,
  input: unknown,
  emptyCode = "platform.empty-patch",
  invalidCode = "platform.invalid",
): Result<v.InferOutput<TSchema>> {
  const parsed = v.safeParse(schema, input)
  if (!parsed.success) return resultErrorCodedCreate(op, "The patch is invalid.", invalidCode)
  if (Object.keys(parsed.output).length === 0) return resultErrorCodedCreate(op, "The patch is empty.", emptyCode)
  return resultCreate(parsed.output)
}
