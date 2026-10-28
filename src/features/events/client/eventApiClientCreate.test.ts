import { expect, test } from "bun:test"
import { eventApiClientCreate } from "./eventApiClientCreate.js"

test("organization activity client sends encoded scope and pagination to the organization endpoint", async () => {
  let request = ""
  const client = eventApiClientCreate({
    baseUrl: "https://example.test",
    fetch: async (input) => {
      request = String(input)
      return Response.json({ items: [], nextPageToken: "next" })
    },
  })
  const result = await client.eventOrganizationList("realm/a", "org/b", { pageSize: 5, pageToken: "a+b" })
  expect(result.success).toBe(true)
  expect(request).toBe(
    "https://example.test/realms/realm%2Fa/organizations/org%2Fb/activity?pageSize=5&pageToken=a%2Bb",
  )
})
