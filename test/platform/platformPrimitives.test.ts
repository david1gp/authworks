import { expect, test } from "bun:test"
import * as v from "valibot"
import { configurationParse } from "../../src/platform/configuration/configurationParse.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../src/platform/errors/resultErrorCodedCreate.js"
import { resultErrorCreate } from "../../src/platform/errors/resultErrorCreate.js"
import { resultErrorDetailsParse } from "../../src/platform/errors/resultErrorDetailsParse.js"
import { httpApiClientRequest } from "../../src/platform/http/httpApiClientRequest.js"
import { httpErrorResponseCreate } from "../../src/platform/http/httpErrorResponseCreate.js"
import { httpErrorResponseSchema } from "../../src/platform/http/httpErrorResponseSchema.js"
import { httpErrorStatusGet } from "../../src/platform/http/httpErrorStatusGet.js"
import { uuidv7Create } from "../../src/platform/ids/uuidv7Create.js"
import { secretCreate } from "../../src/platform/secrets/secretCreate.js"
import { secretGenerate } from "../../src/platform/secrets/secretGenerate.js"
import { secretMatches } from "../../src/platform/secrets/secretMatches.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

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

test("coded results validate codes and preserve safe details", () => {
  const coded = resultErrorCodedCreate("operation", "safe failure", "users.not-found", { resource: "user" })
  expect(coded).toMatchObject({
    code: "users.not-found",
    errorMessage: "safe failure",
    op: "operation",
    success: false,
  })
  expect(resultErrorDetailsParse(coded)).toEqual({ resource: "user" })

  const invalid = resultErrorCodedCreate("operation", "safe failure", "not_found")
  expect(invalid).toMatchObject({ code: "platform.invalid-error-code", success: false })
  expect(resultErrorDetailsParse(invalid)).toEqual({ attemptedCode: "not_found" })

  const circular: Record<string, unknown> = {}
  circular.self = circular
  expect(resultErrorDetailsParse(resultErrorCodedCreate("operation", "safe failure", "users.invalid", circular))).toBe(
    undefined,
  )
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
  const parsed = configurationParse({ PUBLIC_ORIGIN: "https://identity.example.test/authworks/" })
  expect(parsed.success).toBe(true)
  if (!parsed.success) return
  expect(parsed.data).toMatchObject({ databasePath: "authworks.sqlite", host: "127.0.0.1", port: 3000 })
  expect(parsed.data.publicOrigin).toBe("https://identity.example.test/authworks")

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

test("configuration rejects origins with search or hash components", () => {
  for (const publicOrigin of [
    "https://identity.example.test/authworks?tenant=one",
    "https://identity.example.test/authworks#login",
  ]) {
    const rejected = configurationParse({ publicOrigin })
    expect(rejected.success).toBe(false)
  }
})

test("HTTP errors have a validated public shape and conservative status fallback", () => {
  const body = httpErrorResponseCreate({
    code: "users.not-found",
    details: { resource: "user" },
    message: "Resource not found",
    op: "userGet",
    requestId: "request-1",
    retryable: false,
    status: 404,
  })
  expect(v.safeParse(httpErrorResponseSchema, body).success).toBe(true)
  expect(httpErrorStatusGet("not_found")).toBe(404)
  expect(httpErrorStatusGet("platform.internal")).toBe(500)
  expect(httpErrorStatusGet("platform.invalid")).toBe(400)
  expect(httpErrorStatusGet("unknown_code")).toBe(500)
})

test("HTTP API clients share headers, transport errors, and response validation", async () => {
  const requests: Request[] = []
  const schema = v.object({ value: v.string() })
  const success = await httpApiClientRequest({
    baseUrl: "https://identity.example.test/authworks",
    fetch: async (input, init) => {
      const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      requests.push(new Request(requestUrl, init))
      return Response.json({ value: "ok" })
    },
    init: { body: JSON.stringify({ name: "Ada" }), method: "POST" },
    op: "testRequest",
    path: "/resource",
    schema,
    token: secretCreate("test-token"),
  })
  expect(success).toEqual({ data: { value: "ok" }, success: true })
  expect(requests[0]?.url).toBe("https://identity.example.test/authworks/resource")
  expect(requests[0]?.headers.get("accept")).toBe("application/json")
  expect(requests[0]?.headers.get("content-type")).toBe("application/json")
  expect(requests[0]?.headers.get("authorization")).toBe("Bearer test-token")

  const invalid = await httpApiClientRequest({
    baseUrl: "https://identity.example.test",
    fetch: async () => Response.json({ value: 1 }),
    init: { method: "GET" },
    op: "testRequest",
    path: "/resource",
    schema,
  })
  expect(invalid).toEqual({
    code: "platform.invalid-response",
    errorMessage: "The server returned an invalid response.",
    op: "testRequest",
    success: false,
  })

  let jsonCalls = 0
  const notModifiedResponse = new Response(null, { status: 304 })
  Object.defineProperty(notModifiedResponse, "json", {
    value: async () => {
      jsonCalls += 1
      throw new Error("304 has no JSON body")
    },
  })
  const notModified = await httpApiClientRequest({
    baseUrl: "https://identity.example.test",
    fetch: async () => notModifiedResponse,
    init: { method: "GET" },
    op: "testRequest",
    path: "/resource",
    schema,
  })
  expect(notModified).toMatchObject({ code: "platform.http", statusCode: 304, success: false })
  expect(jsonCalls).toBe(0)

  const structured = await httpApiClientRequest({
    baseUrl: "https://identity.example.test/authworks",
    fetch: async () => Response.json({ error: { code: "platform.internal", message: "boom" } }, { status: 500 }),
    init: { method: "GET" },
    op: "testRequest",
    path: "/resource",
    schema,
  })
  expect(structured).toMatchObject({
    code: "platform.internal",
    errorMessage: "boom",
    op: "testRequest",
    statusCode: 500,
    success: false,
  })

  const unreachable = await httpApiClientRequest({
    baseUrl: "https://identity.example.test",
    fetch: async () => {
      throw new Error("offline")
    },
    init: { method: "GET" },
    op: "testRequest",
    path: "/resource",
    schema,
  })
  expect(unreachable).toEqual({
    code: "platform.unreachable",
    errorMessage: "The server could not be reached.",
    op: "testRequest",
    success: false,
  })
})
