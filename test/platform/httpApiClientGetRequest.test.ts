import { expect, test } from "bun:test"
import * as v from "valibot"
import { httpApiClientGetRequest } from "../../src/platform/http/httpApiClientGetRequest.js"
import { httpDateFormat } from "../../src/platform/http/httpDateFormat.js"

const schema = v.object({ value: v.string() })

test("304 skips JSON parsing and returns unchanged with Last-Modified", async () => {
  let jsonCalls = 0
  const lastModified = new Date("2026-08-19T12:34:56.000Z")
  const response = new Response(null, {
    headers: { "last-modified": httpDateFormat(lastModified) },
    status: 304,
  })
  Object.defineProperty(response, "json", {
    value: async () => {
      jsonCalls += 1
      throw new Error("304 has no JSON body")
    },
  })

  const result = await httpApiClientGetRequest({
    baseUrl: "https://identity.example.test",
    fetch: async () => response,
    path: "/resource",
    op: "resourceGet",
    schema,
  })

  expect(result).toEqual({ lastModified, status: "unchanged", success: true })
  expect(jsonCalls).toBe(0)
})

test("200 parses the response and returns current with Last-Modified", async () => {
  const lastModified = new Date("2026-08-19T12:34:56.000Z")
  const result = await httpApiClientGetRequest({
    baseUrl: "https://identity.example.test",
    fetch: async () =>
      Response.json(
        { value: "current" },
        { headers: { "last-modified": httpDateFormat(lastModified), "x-request-id": "request-1" } },
      ),
    path: "/resource",
    op: "resourceGet",
    schema,
  })

  expect(result).toEqual({
    data: { value: "current" },
    lastModified,
    requestId: "request-1",
    status: "current",
    success: true,
  })
})

test("Date ifModifiedSince is formatted as an IMF-fixdate request header", async () => {
  const ifModifiedSince = new Date("2026-08-19T12:34:56.789Z")
  let request: Request | undefined
  await httpApiClientGetRequest({
    baseUrl: "https://identity.example.test",
    fetch: async (input, init) => {
      request = new Request(
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
        init,
      )
      return Response.json({ value: "current" })
    },
    ifModifiedSince,
    path: "/resource",
    op: "resourceGet",
    schema,
  })

  expect(request?.headers.get("if-modified-since")).toBe("Wed, 19 Aug 2026 12:34:56 GMT")
})

test("string ifModifiedSince is sent as-is", async () => {
  let request: Request | undefined
  const ifModifiedSince = "not an HTTP date"
  await httpApiClientGetRequest({
    baseUrl: "https://identity.example.test",
    fetch: async (input, init) => {
      request = new Request(
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
        init,
      )
      return Response.json({ value: "current" })
    },
    ifModifiedSince,
    path: "/resource",
    op: "resourceGet",
    schema,
  })

  expect(request?.headers.get("if-modified-since")).toBe(ifModifiedSince)
})
