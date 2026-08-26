import * as v from "valibot"
import { mfaPolicyFactorSchema } from "../../mfa/public/mfaPolicyFactorSchema.js"

export const organizationLoginPolicyFactorListSchema = v.pipe(
  v.array(mfaPolicyFactorSchema),
  v.check((factors) => new Set(factors).size === factors.length, "Factors must not be duplicated."),
)

export type OrganizationLoginPolicyFactorList = v.InferOutput<typeof organizationLoginPolicyFactorListSchema>
