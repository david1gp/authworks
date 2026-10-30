import { expect, test } from "bun:test"
import { sessionIpApiLookupCreate } from "../../src/features/sessions/domain/sessionIpApiLookupCreate.js"

function fetchCreate(body: unknown, ok = true): typeof fetch {
  const stub = async () =>
    new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
      status: ok ? 200 : 429,
    })
  return Object.assign(stub, { preconnect: () => {} })
}

test("session geo lookup returns the country and region name on success", async () => {
  const lookup = sessionIpApiLookupCreate({
    fetch: fetchCreate({
      country: "Germany",
      countryCode: "DE",
      query: "46.165.215.123",
      region: "HE",
      regionName: "Hesse",
      status: "success",
    }),
  })
  expect(await lookup.lookup("46.165.215.123")).toEqual({ countryCode: "DE", region: "Hesse" })
})

test("session geo lookup fails on a fail-status payload", async () => {
  const lookup = sessionIpApiLookupCreate({
    fetch: fetchCreate({ message: "private range", query: "192.168.1.1", status: "fail" }),
  })
  expect(await lookup.lookup("192.168.1.1")).toBeNull()
})

test("session geo lookup fails when the payload carries no location", async () => {
  const lookup = sessionIpApiLookupCreate({
    fetch: fetchCreate({ query: "8.8.8.8", status: "success" }),
  })
  expect(await lookup.lookup("8.8.8.8")).toBeNull()
})

test("session geo lookup fails on a non-OK response", async () => {
  const lookup = sessionIpApiLookupCreate({
    fetch: fetchCreate(
      {
        countryCode: "DE",
        query: "46.165.215.123",
        regionName: "Hesse",
        status: "success",
      },
      false,
    ),
  })
  expect(await lookup.lookup("46.165.215.123")).toBeNull()
})
