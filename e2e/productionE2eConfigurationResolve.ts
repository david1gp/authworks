import { productionE2eCredentialsGet } from "./productionE2eCredentialsGet.js"

type ProductionE2eEnvironment = Readonly<Record<string, string | undefined>>

const liveProductionSpecs = ["**/productionAuthentication.spec.ts", "**/productionAccountRegression.spec.ts"]

export function productionE2eConfigurationResolve(environment: ProductionE2eEnvironment = process.env) {
  const productionE2e = environment.AUTHWORKS_E2E_PRODUCTION === "1"
  const credentials = productionE2eCredentialsGet(environment)
  if (productionE2e && !credentials.success) throw new Error(credentials.errorMessage)
  return {
    productionE2e,
    testMatch: productionE2e ? liveProductionSpecs : undefined,
    testIgnore: productionE2e ? undefined : liveProductionSpecs,
  }
}
