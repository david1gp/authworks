import type * as v from "valibot"
import { passwordChangeResponseSchema } from "./passwordChangeResponseSchema.js"

export const passwordMeChangeResponseSchema = passwordChangeResponseSchema

export type PasswordMeChangeResponse = v.InferOutput<typeof passwordMeChangeResponseSchema>
