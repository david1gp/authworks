import type { Result } from "#result"

export type OrganizationDomainDnsVerificationPort = {
  txtRecordsGet: (recordName: string) => Promise<Result<readonly string[]>>
}
