import * as v from "valibot"
import { realmStatusSchema } from "./realmStatusSchema.js"

export const realmSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  domain: v.pipe(v.string(), v.minLength(1), v.maxLength(253)),
  domains: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(253))), v.minLength(1)),
  id: v.pipe(v.string(), v.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  status: realmStatusSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type Realm = v.InferOutput<typeof realmSchema>
