export function connectionProfileCliSystemTokenResolve(
  explicitToken: string | undefined,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  return explicitToken ?? environment.AUTHWORKS_SYSTEM_SECRET
}
