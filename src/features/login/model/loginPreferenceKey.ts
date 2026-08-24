/** Returns the organization-scoped browser key for hosted-login preferences. */
export function loginPreferenceKey(organizationId: string): string {
  return `authworks:login:preference:v1:${organizationId}`
}
