import * as v from "valibot"

export const userStateSchema = v.picklist(["initial", "active", "inactive", "locked", "suspended", "deleted"])

export type UserState = v.InferOutput<typeof userStateSchema>
