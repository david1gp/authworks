import { expect, test } from "bun:test"
import { configurationParse } from "../../src/platform/configuration/configurationParse.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../src/platform/errors/resultErrorCreate.js"
import { httpErrorResponseCreate } from "../../src/platform/http/httpErrorResponseCreate.js"
import { httpErrorResponseSchema } from "../../src/platform/http/httpErrorResponseSchema.js"
import { httpErrorStatusGet } from "../../src/platform/http/httpErrorStatusGet.js"
import { uuidv7Create } from "../../src/platform/ids/uuidv7Create.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"
import { secretCreate } from "../../src/platform/secrets/secretCreate.js"
import { secretGenerate } from "../../src/platform/secrets/secretGenerate.js"
import { secretMatches } from "../../src/platform/secrets/secretMatches.js"
import * as v from "valibot"

test("uuidv7Create uses injected milliseconds and RFC version/variant bits", () => {
  const testkit = platformTestkitCreate({ now: 0x0123456789ab, randomByte: 0 })
  const value = uuidv7Create(testkit.runtime)

  expect(value).toBe("01234567-89ab-7000-8000-000000000000")
})

test("runtime and testkit make time and randomness deterministic", () => {
  const testkit = platformTestkitCreate({ now: 100 })

  expect(testkit.runtime.now()).toBe(100)
  expect(testkit.runtime.randomBytes(2)).toEqual(new Uint8Array([0, 0]))
  testkit.advance(25)
  expect(testkit.runtime.now()).toBe(125)
})

test("results keep success and error shapes stable", () => {
  expect(resultCreate("value")).toEqual({ data: "value", success: true })
  expect(resultErrorCreate("operation", "safe failure")).toEqual({
    errorMessage: "safe failure",
    op: "operation",
    success: false,
  })
})

test("secrets redact serialization and compare without an early length exit", () => {
  const secret = secretCreate("correct horse")
  const generated = secretGenerate(4, platformTestkitCreate().runtime)

  expect(String(secret)).toBe("[REDACTED]")
  expect(JSON.stringify(secret)).toBe('"[REDACTED]"')
  expect(secretMatches(secret, "correct horse")).toBe(true)
  expect(secretMatches(secret, "correct horse!")).toBe(false)
  expect(generated.valueGet()).toHaveLength(6)
})

test("configuration applies safe defaults and rejects insecure production origins", () => {
  const parsed = configurationParse({ PUBLIC_ORIGIN: "https://identity.example.test" })
  expect(parsed.success).toBe(true)
  if (!parsed.success) return
  expect(parsed.data).toMatchObject({ databasePath: "zitadel.sqlite", host: "127.0.0.1", port: 3000 })

  const rejected = configurationParse({ nodeEnv: "production", publicOrigin: "http://identity.example.test" })
  expect(rejected.success).toBe(false)
  if (rejected.success) return
  expect(rejected.errorMessage).toContain("publicOrigin")
})

test("configuration rejects credential-bearing origins without echoing credentials", () => {
  const rejected = configurationParse({ publicOrigin: "https://admin:super-secret@identity.example.test" })

  expect(rejected.success).toBe(false)
  if (rejected.success) return
  expect(rejected.errorMessage).not.toContain("super-secret")
})

test("HTTP errors have a validated public shape and conservative status fallback", () => {
  const body = httpErrorResponseCreate("not_found", "Resource not found")
  expect(v.safeParse(httpErrorResponseSchema, body).success).toBe(true)
  expect(httpErrorStatusGet("not_found")).toBe(404)
  expect(httpErrorStatusGet("unknown_code")).toBe(500)
})
