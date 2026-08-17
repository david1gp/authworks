import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export function organizationEmailNormalize(input: string): Result<string> {
  const op = "organizationEmailNormalize"
  const email = input.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320)
    return resultErrorCreate(op, "The invitation email is invalid.")
  return resultCreate(email)
}
