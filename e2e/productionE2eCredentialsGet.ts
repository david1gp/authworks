type ProductionE2eEnvironment = Readonly<Record<string, string | undefined>>

export function productionE2eCredentialsGet(environment: ProductionE2eEnvironment = process.env) {
  const username = environment.AUTHWORKS_SSOTEST_USERNAME
  const password = environment.AUTHWORKS_SSOTEST_PASSWORD
  if (username === undefined || username.length === 0 || password === undefined || password.length === 0)
    return {
      errorMessage: "Production authentication E2E requires AUTHWORKS_SSOTEST_USERNAME and AUTHWORKS_SSOTEST_PASSWORD.",
      success: false as const,
    }
  return { data: { password, username }, success: true as const }
}
