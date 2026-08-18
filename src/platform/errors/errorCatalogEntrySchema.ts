import * as v from "valibot"
import { resultErrorCodeSchema } from "./resultErrorCodeSchema.js"

export const errorCatalogEntrySchema = v.object({
  code: resultErrorCodeSchema,
  httpStatus: v.picklist([400, 401, 403, 404, 409, 429, 500, 503]),
  retryable: v.boolean(),
})

export type ErrorCatalogEntry = v.InferOutput<typeof errorCatalogEntrySchema>
