import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export function realmDomainNormalize(value: string): Result<string> {
  const domain = value.trim().toLowerCase().replace(/\.$/, "")
  if (
    domain.length === 0 ||
    domain.length > 253 ||
    domain.includes("/") ||
    domain.includes(":") ||
    domain.includes("@") ||
    !/^(localhost|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)$/.test(domain)
  )
    return resultErrorCreate("realmDomainNormalize", "The realm domain is invalid.")
  return resultCreate(domain)
}
