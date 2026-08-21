import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCodedCreate } from "../errors/resultErrorCodedCreate.js"
import { type ListQuery, listQuerySchema } from "./listQuerySchema.js"

export function listQueryParse(input: unknown): Result<ListQuery> {
  const op = "listQueryParse"
  const parsed = v.safeParse(listQuerySchema, input)
  if (!parsed.success) return resultErrorCodedCreate(op, "The list query is invalid.", "platform.invalid-page")
  return resultCreate(parsed.output)
}
