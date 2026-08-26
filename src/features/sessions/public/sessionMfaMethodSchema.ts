import * as v from "valibot"

export const sessionMfaMethodSchema = v.picklist(["email_otp", "passkey", "recovery_code", "totp"])

export type SessionMfaMethod = v.InferOutput<typeof sessionMfaMethodSchema>
