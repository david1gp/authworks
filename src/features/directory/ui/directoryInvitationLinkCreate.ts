/** Build a same-origin redemption link without interpreting the token as URL syntax. */
export function directoryInvitationLinkCreate(origin: string, token: string, demo: boolean): string {
  const url = new URL(demo ? "/demo/invitations/accept" : "/invitations/accept", origin)
  url.searchParams.set("token", token)
  return url.toString()
}
