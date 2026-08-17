import * as v from "valibot"
import { passwordPolicySchema } from "./passwordPolicySchema.js"

export const passwordPolicyResponseSchema = v.strictObject({ policy: passwordPolicySchema })

export type PasswordPolicyResponse = v.InferOutput<typeof passwordPolicyResponseSchema>
