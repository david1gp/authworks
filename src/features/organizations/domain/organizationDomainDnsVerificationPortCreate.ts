import { resolveTxt } from "node:dns/promises"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { OrganizationDomainDnsVerificationPort } from "./organizationDomainDnsVerificationPort.js"

export function organizationDomainDnsVerificationPortCreate(): OrganizationDomainDnsVerificationPort {
  return {
    async txtRecordsGet(recordName) {
      try {
        const records = await resolveTxt(recordName)
        return resultCreate(records.map((record) => record.join("")))
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationDomainDnsVerification",
          "The domain verification record could not be read.",
          "organizations.read-failed",
        )
      }
    },
  }
}
