import { expect, test } from "bun:test"
import { productionE2eConfigurationResolve } from "../../e2e/productionE2eConfigurationResolve.js"

test("production E2E configuration fails closed when either SSOTEST credential is missing", () => {
  for (const environment of [
    { AUTHWORKS_E2E_PRODUCTION: "1", AUTHWORKS_SSOTEST_PASSWORD: "password" },
    { AUTHWORKS_E2E_PRODUCTION: "1", AUTHWORKS_SSOTEST_USERNAME: "username" },
    { AUTHWORKS_E2E_PRODUCTION: "1", AUTHWORKS_SSOTEST_PASSWORD: "", AUTHWORKS_SSOTEST_USERNAME: "username" },
  ])
    expect(() => productionE2eConfigurationResolve(environment)).toThrow(
      /AUTHWORKS_SSOTEST_USERNAME.*AUTHWORKS_SSOTEST_PASSWORD/,
    )
})

test("default E2E configuration excludes live production specs", () => {
  expect(productionE2eConfigurationResolve({})).toEqual({
    productionE2e: false,
    testIgnore: ["**/productionAuthentication.spec.ts", "**/productionAccountRegression.spec.ts"],
    testMatch: undefined,
  })
  expect(
    productionE2eConfigurationResolve({
      AUTHWORKS_E2E_PRODUCTION: "1",
      AUTHWORKS_SSOTEST_PASSWORD: "password",
      AUTHWORKS_SSOTEST_USERNAME: "username",
    }),
  ).toEqual({
    productionE2e: true,
    testIgnore: undefined,
    testMatch: ["**/productionAuthentication.spec.ts", "**/productionAccountRegression.spec.ts"],
  })
})

test("production mode selects only the dedicated live specs", () => {
  const configuration = productionE2eConfigurationResolve({
    AUTHWORKS_E2E_PRODUCTION: "1",
    AUTHWORKS_SSOTEST_PASSWORD: "password",
    AUTHWORKS_SSOTEST_USERNAME: "username",
  })

  expect(configuration.testMatch).toEqual([
    "**/productionAuthentication.spec.ts",
    "**/productionAccountRegression.spec.ts",
  ])
  expect(configuration.testMatch).not.toContain("**/*Production.spec.ts")
})
