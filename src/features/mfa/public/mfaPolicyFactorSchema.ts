import { mfaFactorSchema } from "./mfaFactorSchema.js"
import type { MfaFactor } from "./mfaFactorSchema.js"

/** Factors that can be selected by an organization security policy. */
export const mfaPolicyFactorSchema = mfaFactorSchema

export type MfaPolicyFactor = MfaFactor
