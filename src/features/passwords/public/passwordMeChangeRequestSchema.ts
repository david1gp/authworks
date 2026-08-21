import type * as v from "valibot"
import { passwordChangeRequestSchema } from "./passwordChangeRequestSchema.js"

export const passwordMeChangeRequestSchema = passwordChangeRequestSchema

export type PasswordMeChangeRequest = v.InferOutput<typeof passwordMeChangeRequestSchema>
