import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

export function organizationEmailNormalize(input: string): Result<string> {
  const op = "organizationEmailNormalize"
  const email = input.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320)
    return resultErrorCodedCreate(op, "The invitation email is invalid.", "organizations.invalid")
  return resultCreate(email)
}
