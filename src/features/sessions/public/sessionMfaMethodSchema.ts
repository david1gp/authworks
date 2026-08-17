import * as v from "valibot"

export const sessionMfaMethodSchema = v.picklist(["recovery_code", "totp"])

export type SessionMfaMethod = v.InferOutput<typeof sessionMfaMethodSchema>
