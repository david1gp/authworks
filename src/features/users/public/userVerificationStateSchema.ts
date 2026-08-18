import * as v from "valibot"

export const userVerificationStateSchema = v.picklist(["unverified", "verified"])

export type UserVerificationState = v.InferOutput<typeof userVerificationStateSchema>
