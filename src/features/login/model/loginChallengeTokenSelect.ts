const challengeTokenPattern = /^[A-Za-z0-9_-]{43,128}$/

/** Accepts only opaque MFA challenge tokens that match the server-issued token shape. */
export function loginChallengeTokenSelect(token: string | null | undefined): string | undefined {
  if (token === null || token === undefined) return undefined
  return challengeTokenPattern.test(token) ? token : undefined
}
