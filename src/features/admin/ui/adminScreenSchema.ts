import * as v from "valibot"

// Per-user session and authentication-method administration has no browser contract yet, so those
// destinations stay fixture placeholders until the server exposes them.
export const adminScreenSchema = v.picklist(["sign-in", "overview", "realm", "users", "user-detail", "audit-events"])

export type AdminScreen = v.InferOutput<typeof adminScreenSchema>
