import { resolveTxt } from "node:dns/promises"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { OrganizationDomainDnsVerificationPort } from "./organizationDomainDnsVerificationPort.js"

export function organizationDomainDnsVerificationPortCreate(): OrganizationDomainDnsVerificationPort {
  return {
    async txtRecordsGet(recordName) {
      try {
        const records = await resolveTxt(recordName)
        return resultCreate(records.map((record) => record.join("")))
      } catch (_error) {
        return resultErrorCreate(
          "organizationDomainDnsVerification",
          "The domain verification record could not be read.",
        )
      }
    },
  }
}
