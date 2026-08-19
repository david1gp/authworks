import { expect, test } from "bun:test"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../src/platform/errors/resultErrorCodedCreate.js"
import { httpResultResponseCreate } from "../../src/platform/http/httpResultResponseCreate.js"

const lastModified = new Date("2026-08-19T12:34:56.789Z")
const lastModifiedHeader = "Wed, 19 Aug 2026 12:34:56 GMT"

function contextCreate(input: { ifModifiedSince?: string; method?: string } = {}) {
  let jsonCalls = 0
  const context = {
    json: (body: unknown, status = 200) => {
      jsonCalls += 1
      return Response.json(body, { status })
    },
    req: {
      header: (name: string) => (name === "if-modified-since" ? input.ifModifiedSince : undefined),
      method: input.method,
    },
  }
  return { context, jsonCalls: () => jsonCalls }
}

test("success without lastModified returns JSON and request ID only", async () => {
  const { context } = contextCreate()

  const response = httpResultResponseCreate(context, resultCreate({ value: "current" }))

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ value: "current" })
  expect(response.headers.get("x-request-id")).toBeString()
  expect(response.headers.get("Last-Modified")).toBeNull()
  expect(response.headers.get("Cache-Control")).toBeNull()
})

test("success with lastModified returns JSON and freshness headers", async () => {
  const { context } = contextCreate()

  const response = httpResultResponseCreate(context, resultCreate({ value: "current" }), 200, lastModified)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ value: "current" })
  expect(response.headers.get("Last-Modified")).toBe(lastModifiedHeader)
  expect(response.headers.get("Cache-Control")).toBe("private, no-cache")
})

test("matching If-Modified-Since on GET returns a bodyless 304", async () => {
  const { context, jsonCalls } = contextCreate({ ifModifiedSince: lastModifiedHeader, method: "GET" })

  const response = httpResultResponseCreate(context, resultCreate({ value: "current" }), 200, lastModified)

  expect(response.status).toBe(304)
  expect(await response.text()).toBe("")
  expect(response.headers.get("Last-Modified")).toBe(lastModifiedHeader)
  expect(response.headers.get("Cache-Control")).toBe("private, no-cache")
  expect(response.headers.get("x-request-id")).toBeString()
  expect(response.headers.get("Content-Type")).toBeNull()
  expect(jsonCalls()).toBe(0)
})

test("invalid If-Modified-Since returns the JSON body", async () => {
  const { context } = contextCreate({ ifModifiedSince: "not a date", method: "GET" })

  const response = httpResultResponseCreate(context, resultCreate({ value: "current" }), 200, lastModified)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ value: "current" })
})

test("a newer resource returns the JSON body", async () => {
  const { context } = contextCreate({
    ifModifiedSince: "Wed, 19 Aug 2026 12:34:55 GMT",
    method: "GET",
  })

  const response = httpResultResponseCreate(context, resultCreate({ value: "current" }), 200, lastModified)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ value: "current" })
})

test("error results keep error mapping and ignore lastModified", async () => {
  const { context } = contextCreate({ ifModifiedSince: lastModifiedHeader, method: "GET" })
  const result = resultErrorCodedCreate("test", "Something went wrong.", "platform.invalid")

  const response = httpResultResponseCreate(context, result, 200, lastModified)

  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({
    error: { code: "platform.invalid", message: "Something went wrong." },
  })
  expect(response.headers.get("Last-Modified")).toBeNull()
  expect(response.headers.get("Cache-Control")).toBeNull()
})

test("POST with a matching If-Modified-Since returns JSON", async () => {
  const { context } = contextCreate({ ifModifiedSince: lastModifiedHeader, method: "POST" })

  const response = httpResultResponseCreate(context, resultCreate({ value: "current" }), 200, lastModified)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ value: "current" })
  expect(response.headers.get("Last-Modified")).toBe(lastModifiedHeader)
  expect(response.headers.get("Cache-Control")).toBe("private, no-cache")
})
