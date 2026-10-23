import * as v from "valibot"
import { listPageSizeSchema } from "./listPageSizeSchema.js"
import { listPageTokenSchema } from "./listPageTokenSchema.js"
import { listSortDirectionSchema } from "./listSortDirectionSchema.js"

export const listQuerySchema = v.strictObject({
  pageSize: v.optional(listPageSizeSchema),
  pageToken: v.optional(listPageTokenSchema),
  search: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200))),
  sortBy: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(64))),
  sortDirection: v.optional(listSortDirectionSchema),
})

export type ListQuery = v.InferOutput<typeof listQuerySchema>
