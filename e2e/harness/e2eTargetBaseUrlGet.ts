const productionBaseUrl = "https://authworks.contentoren.de"

export function e2eTargetBaseUrlGet(environment: Readonly<Record<string, string | undefined>> = process.env): string {
  const override = environment.AUTHWORKS_E2E_BASE_URL
  return override === undefined || override === "" ? productionBaseUrl : override
}
