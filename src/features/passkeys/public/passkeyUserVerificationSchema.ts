import * as v from "valibot"

export const passkeyUserVerificationSchema = v.picklist(["required", "preferred", "discouraged"])

export type PasskeyUserVerification = v.InferOutput<typeof passkeyUserVerificationSchema>
