import * as v from "valibot"
import { realmSchema } from "./realmSchema.js"

export const realmListResponseSchema = v.strictObject({ realms: v.array(realmSchema) })

export type RealmListResponse = v.InferOutput<typeof realmListResponseSchema>
