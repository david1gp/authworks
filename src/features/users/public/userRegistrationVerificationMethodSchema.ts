import * as v from "valibot"

export const userRegistrationVerificationMethodSchema = v.picklist(["email", "whatsapp"])

export type UserRegistrationVerificationMethod = v.InferOutput<typeof userRegistrationVerificationMethodSchema>
