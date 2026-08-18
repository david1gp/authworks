import * as v from "valibot"
import { realmSchema } from "./realmSchema.js"

export const realmResponseSchema = v.strictObject({ realm: realmSchema })

export type RealmResponse = v.InferOutput<typeof realmResponseSchema>
