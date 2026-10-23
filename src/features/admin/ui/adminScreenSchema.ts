import * as v from "valibot"

export const adminScreenSchema = v.picklist(["sign-in", "realm", "sessions", "audit-events"])

export type AdminScreen = v.InferOutput<typeof adminScreenSchema>
