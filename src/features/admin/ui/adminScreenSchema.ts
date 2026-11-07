import * as v from "valibot"

export const adminScreenSchema = v.picklist(["sign-in", "realm", "sessions", "audit-events", "whatsapp"])

export type AdminScreen = v.InferOutput<typeof adminScreenSchema>
