import { expect, test } from "bun:test"
import { e2eTargetBaseUrlGet } from "../../e2e/harness/e2eTargetBaseUrlGet.js"

test("target base URL requires an explicit production target and prefers the orchestrator override", () => {
  expect(e2eTargetBaseUrlGet({ AUTHWORKS_E2E_TARGET: "production" })).toBe("https://authworks.contentoren.de")
  expect(e2eTargetBaseUrlGet({ AUTHWORKS_E2E_BASE_URL: "", AUTHWORKS_E2E_TARGET: "production" })).toBe(
    "https://authworks.contentoren.de",
  )
  expect(
    e2eTargetBaseUrlGet({
      AUTHWORKS_E2E_BASE_URL: "http://login.localhost:5190",
      AUTHWORKS_E2E_TARGET: "dev",
    }),
  ).toBe("http://login.localhost:5190")
  expect(() => e2eTargetBaseUrlGet({})).toThrow("There is no default environment.")
  expect(() => e2eTargetBaseUrlGet({ AUTHWORKS_E2E_TARGET: "" })).toThrow("There is no default environment.")
})
