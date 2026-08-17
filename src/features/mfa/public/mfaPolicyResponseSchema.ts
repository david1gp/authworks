import * as v from "valibot"
import { mfaPolicySchema } from "./mfaPolicySchema.js"

export const mfaPolicyResponseSchema = v.strictObject({ policy: mfaPolicySchema })

export type MfaPolicyResponse = v.InferOutput<typeof mfaPolicyResponseSchema>
