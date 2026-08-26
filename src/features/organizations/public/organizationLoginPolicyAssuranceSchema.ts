import { sessionAssuranceSchema } from "../../sessions/public/sessionAssuranceSchema.js"
import type { SessionAssurance } from "../../sessions/public/sessionAssuranceSchema.js"

export const organizationLoginPolicyAssuranceSchema = sessionAssuranceSchema

export type OrganizationLoginPolicyAssurance = SessionAssurance
