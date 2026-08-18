import * as v from "valibot"

export const realmStatusSchema = v.picklist(["active", "disabled"])

export type RealmStatus = v.InferOutput<typeof realmStatusSchema>
