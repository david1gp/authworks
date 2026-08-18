export function organizationDomainVerificationRecordNameCreate(domain: string): string {
  return `_authworks-verification.${domain}`
}
