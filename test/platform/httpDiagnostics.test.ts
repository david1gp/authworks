import { expect, test } from "bun:test"
import { Hono } from "hono"
import * as v from "valibot"
import { resultErrorCodedCreate } from "../../src/platform/errors/resultErrorCodedCreate.js"
import { httpApiClientGetRequest } from "../../src/platform/http/httpApiClientGetRequest.js"
import { httpApiClientRequest } from "../../src/platform/http/httpApiClientRequest.js"
import { httpDiagnosticPathCreate } from "../../src/platform/http/httpDiagnosticPathCreate.js"
import { httpResultResponseCreate } from "../../src/platform/http/httpResultResponseCreate.js"
import { httpServerDiagnosticsMiddlewareCreate } from "../../src/platform/http/httpServerDiagnosticsMiddlewareCreate.js"

const responseSchema = v.object({ value: v.string() })

test("browser API diagnostics correlate invalid JSON/schema responses without response data", async () => {
  const diagnostics: Record<string, unknown>[] = []
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} })

  try {
    const invalidSchema = await httpApiClientRequest({
      baseUrl: "https://identity.example.test/api",
      fetch: async () =>
        Response.json(
          { email: "ada@example.test", token: "body-secret", value: 1 },
          { headers: { "x-request-id": "request-schema" } },
        ),
      init: { method: "GET" },
      diagnosticLog: (diagnostic) => diagnostics.push(diagnostic),
      op: "userMeGet",
      path: "/realms/realm-one/me?email=query-secret&token=query-token",
      schema: responseSchema,
    })
    const invalidJson = await httpApiClientRequest({
      baseUrl: "https://identity.example.test",
      fetch: async () => new Response("not-json", { headers: { "x-request-id": "request-json" } }),
      init: { method: "GET" },
      diagnosticLog: (diagnostic) => diagnostics.push(diagnostic),
      op: "userMeGet",
      path: "/realms/realm-one/me",
      schema: responseSchema,
    })

    expect(invalidSchema).toEqual({
      code: "platform.invalid-response",
      errorMessage: "The server returned an invalid response.",
      op: "userMeGet",
      success: false,
    })
    expect(invalidJson).toMatchObject({ code: "platform.invalid-response", success: false })
    expect(diagnostics).toEqual([
      {
        event: "authworks.api.invalid-response",
        op: "userMeGet",
        path: "/api/realms/[redacted]/me",
        reason: "invalid-schema",
        requestId: "request-schema",
        schema: [{ code: "string", path: "value" }],
        status: 200,
      },
      {
        event: "authworks.api.invalid-response",
        op: "userMeGet",
        path: "/realms/[redacted]/me",
        reason: "invalid-json",
        requestId: "request-json",
        schema: [],
        status: 200,
      },
    ])
    const serialized = JSON.stringify(diagnostics)
    expect(serialized).not.toContain("ada@example.test")
    expect(serialized).not.toContain("body-secret")
    expect(serialized).not.toContain("query-secret")
    expect(serialized).not.toContain("query-token")
    expect(serialized).not.toContain("realm-one")
  } finally {
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window")
    else Object.defineProperty(globalThis, "window", previousWindow)
  }
})

test("unexpected generic 304 diagnostics are emitted while conditional GET 304 remains unchanged", async () => {
  const diagnostics: Record<string, unknown>[] = []
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} })

  try {
    const response = new Response(null, { headers: { "x-request-id": "request-304" }, status: 304 })
    const unexpected = await httpApiClientRequest({
      baseUrl: "https://identity.example.test",
      fetch: async () => response,
      init: { method: "POST" },
      diagnosticLog: (diagnostic) => diagnostics.push(diagnostic),
      op: "sessionRotate",
      path: "/realms/realm-one/sessions/rotate?token=query-token",
      schema: responseSchema,
    })
    const expected = await httpApiClientGetRequest({
      baseUrl: "https://identity.example.test",
      fetch: async () => new Response(null, { status: 304 }),
      op: "resourceGet",
      path: "/resource?token=query-token",
      schema: responseSchema,
    })

    expect(unexpected).toMatchObject({ code: "platform.http", statusCode: 304, success: false })
    expect(expected).toEqual({ status: "unchanged", success: true })
    expect(diagnostics).toEqual([
      {
        event: "authworks.api.invalid-response",
        op: "sessionRotate",
        path: "/realms/[redacted]/sessions/rotate",
        reason: "unexpected-304",
        requestId: "request-304",
        schema: [],
        status: 304,
      },
    ])
  } finally {
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window")
    else Object.defineProperty(globalThis, "window", previousWindow)
  }
})

test("client operations stay local and no operation header is sent", async () => {
  let request: Request | undefined
  await httpApiClientRequest({
    baseUrl: "https://identity.example.test",
    fetch: async (input, init) => {
      request = new Request(input, init)
      return Response.json({ value: "ok" })
    },
    init: { cache: "no-store", headers: { "if-modified-since": "Wed, 19 Aug 2026 12:34:56 GMT" } },
    op: "userMeGet",
    path: "/me",
    schema: responseSchema,
  })

  expect(request?.headers.get("x-authworks-operation")).toBeNull()
  expect(request?.headers.get("if-modified-since")).toBeNull()
})

test("server success logs use the registered route instead of the browser operation header", async () => {
  const diagnostics: unknown[] = []
  const app = new Hono()
  app.use("*", httpServerDiagnosticsMiddlewareCreate({ log: (diagnostic) => diagnostics.push(diagnostic) }))
  app.get("/realms/:realmId/me", (context) =>
    httpResultResponseCreate(context, { data: { value: "ok" }, success: true }),
  )

  const response = await app.request("https://identity.example.test/realms/realm-one/me", {
    headers: { "x-authworks-operation": "userMeGet" },
  })

  expect(response.status).toBe(200)
  expect(diagnostics).toEqual([
    {
      event: "authworks.http.request",
      method: "GET",
      op: "/realms/:realmId/me",
      path: "/realms/[redacted]/me",
      requestId: response.headers.get("x-request-id"),
      status: 200,
    },
  ])
})

test("server request error logs retain the response request ID and operation without request data", async () => {
  const diagnostics: unknown[] = []
  const app = new Hono()
  app.use("*", httpServerDiagnosticsMiddlewareCreate({ log: (diagnostic) => diagnostics.push(diagnostic) }))
  app.get("/realms/:realmId/me", (context) =>
    httpResultResponseCreate(context, resultErrorCodedCreate("userMeGet", "not logged", "platform.invalid")),
  )

  const response = await app.request("https://identity.example.test/realms/realm-one/me?token=query-token", {
    headers: { "x-request-id": "request-server" },
  })

  expect(response.status).toBe(400)
  expect(response.headers.get("x-request-id")).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  )
  expect(response.headers.get("x-request-id")).not.toBe("request-server")
  expect(diagnostics).toEqual([
    {
      event: "authworks.http.error",
      method: "GET",
      op: "userMeGet",
      path: "/realms/[redacted]/me",
      requestId: response.headers.get("x-request-id"),
      status: 400,
    },
  ])
  const serialized = JSON.stringify(diagnostics)
  expect(serialized).not.toContain("not logged")
  expect(serialized).not.toContain("realm-one")
  expect(serialized).not.toContain("query-token")
})

test("path diagnostics redact dynamic values by route position even when they match safe words", () => {
  expect(httpDiagnosticPathCreate("https://identity.example.test/realms/me/me")).toBe("/realms/[redacted]/me")
  expect(httpDiagnosticPathCreate("https://identity.example.test/realms/realm-one/users/users")).toBe(
    "/realms/[redacted]/users/[redacted]",
  )
  expect(httpDiagnosticPathCreate("https://identity.example.test/realms/realm-one/me?userId=users")).toBe(
    "/realms/[redacted]/me",
  )
})
