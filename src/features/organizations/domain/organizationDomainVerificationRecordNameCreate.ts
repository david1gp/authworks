export function organizationDomainVerificationRecordNameCreate(domain: string): string {
  return `_zitadel-verification.${domain}`
}
