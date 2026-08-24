/** Builds a provider-specific hosted-login path from a discovered provider identifier. */
export function loginProviderPathGet(providerId: string, basePath: string): string {
  return `${basePath}/idp/${encodeURIComponent(providerId)}`
}
