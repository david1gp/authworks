import { expect, test } from "bun:test"
import * as v from "valibot"
import { r2ConfigurationParse } from "../../src/platform/configuration/r2ConfigurationParse.js"
import { r2ConfigurationSchema } from "../../src/platform/configuration/r2ConfigurationSchema.js"

test("R2 configuration parses task 1 environment names without exposing secrets", () => {
  const parsed = r2ConfigurationParse({
    AUTHWORKS_R2_ACCESS_KEY_ID: "access-key",
    AUTHWORKS_R2_ACCOUNT_ID: "account-id",
    AUTHWORKS_R2_BUCKET_NAME: "contentoren-authworks",
    AUTHWORKS_R2_PUBLIC_BASE_URL: "https://assets.authworks.contentoren.de/",
    AUTHWORKS_R2_SECRET_ACCESS_KEY: "secret-key",
  })

  expect(parsed).toEqual({
    data: {
      accessKeyId: "access-key",
      accountId: "account-id",
      bucket: "contentoren-authworks",
      endpoint: "https://account-id.r2.cloudflarestorage.com",
      publicOrigin: "https://assets.authworks.contentoren.de",
      secretAccessKey: "secret-key",
    },
    success: true,
  })
})

test("R2 configuration schema rejects a non-HTTPS endpoint", () => {
  expect(
    v.safeParse(r2ConfigurationSchema, {
      accessKeyId: "access-key",
      accountId: "account-id",
      bucket: "contentoren-authworks",
      endpoint: "http://account-id.r2.cloudflarestorage.com",
      publicOrigin: "https://assets.authworks.contentoren.de",
      secretAccessKey: "secret-key",
    }).success,
  ).toBe(false)
})

test("R2 configuration is optional when absent and rejects incomplete values safely", () => {
  expect(r2ConfigurationParse({})).toEqual({ data: undefined, success: true })

  const rejected = r2ConfigurationParse({ AUTHWORKS_R2_SECRET_ACCESS_KEY: "do-not-echo" })
  expect(rejected.success).toBe(false)
  if (rejected.success) return
  expect(rejected.errorMessage).toContain("AUTHWORKS_R2_ACCOUNT_ID")
  expect(rejected.errorMessage).not.toContain("do-not-echo")
})
