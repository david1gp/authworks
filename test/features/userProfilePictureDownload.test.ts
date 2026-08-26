import { expect, test } from "bun:test"
import { userProfilePictureDownload } from "../../src/features/users/actions/userProfilePictureDownload.js"

const image = Uint8Array.from([1, 2, 3])

function fetchCreate(handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>): typeof fetch {
  return Object.assign(handler, { preconnect: fetch.preconnect })
}

test("provider picture downloads reject private, loopback, link-local, and mapped addresses", async () => {
  let fetched = false
  const fetch = fetchCreate(async () => {
    fetched = true
    return new Response(image, { headers: { "content-type": "image/png" } })
  })

  for (const sourceUrl of [
    "https://127.0.0.1/picture",
    "https://10.0.0.1/picture",
    "https://169.254.169.254/picture",
    "https://[::1]/picture",
    "https://[::ffff:127.0.0.1]/picture",
    "https://[fc00::1]/picture",
    "https://[fe80::1]/picture",
    "https://[ff02::1]/picture",
    "https://[2001:db8::1]/picture",
  ]) {
    expect((await userProfilePictureDownload({ fetch, sourceUrl })).success).toBe(false)
  }
  expect(fetched).toBe(false)
})

test("provider picture downloads reject private and mixed DNS destinations before fetching", async () => {
  let fetched = false
  const fetch = fetchCreate(async () => {
    fetched = true
    return new Response(image, { headers: { "content-type": "image/png" } })
  })

  expect(
    (
      await userProfilePictureDownload({
        fetch,
        resolve: async () => ["8.8.8.8", "192.168.1.1"],
        sourceUrl: "https://provider.example/picture",
      })
    ).success,
  ).toBe(false)
  expect(fetched).toBe(false)
})

test("provider picture downloads resolve every redirect and reject DNS rebinding", async () => {
  const resolvedAddresses = ["8.8.8.8", "127.0.0.1"]
  const resolvedHosts: string[] = []
  let fetched = 0
  const result = await userProfilePictureDownload({
    fetch: fetchCreate(async (input) => {
      fetched += 1
      if (input.toString() === "https://provider.example/start")
        return new Response(null, { headers: { location: "/picture" }, status: 302 })
      return new Response(image, { headers: { "content-type": "image/png" } })
    }),
    resolve: async (hostname) => {
      resolvedHosts.push(hostname)
      const address = resolvedAddresses.shift()
      return address === undefined ? [] : [address]
    },
    sourceUrl: "https://provider.example/start",
  })

  expect(result.success).toBe(false)
  expect(fetched).toBe(1)
  expect(resolvedHosts).toEqual(["provider.example", "provider.example"])
})

test("provider picture downloads preserve same-host redirects and accept public resolved destinations", async () => {
  let fetched = 0
  const result = await userProfilePictureDownload({
    fetch: fetchCreate(async (input) => {
      fetched += 1
      if (input.toString() === "https://provider.example/start")
        return new Response(null, { headers: { location: "/picture" }, status: 302 })
      return new Response(image, { headers: { "content-type": "image/png" } })
    }),
    resolve: async () => ["8.8.8.8"],
    sourceUrl: "https://provider.example/start",
  })

  expect(result).toEqual({ data: { body: image, contentType: "image/png" }, success: true })
  expect(fetched).toBe(2)
})

test("provider picture downloads reject resolution failures and redirects to another host", async () => {
  let fetched = 0
  const resolutionFailure = await userProfilePictureDownload({
    fetch: fetchCreate(async () => {
      fetched += 1
      return new Response(image, { headers: { "content-type": "image/png" } })
    }),
    resolve: async () => {
      throw new Error("DNS failure")
    },
    sourceUrl: "https://provider.example/picture",
  })
  expect(resolutionFailure.success).toBe(false)
  expect(fetched).toBe(0)

  const alternateHost = await userProfilePictureDownload({
    fetch: fetchCreate(async () => {
      fetched += 1
      return new Response(null, { headers: { location: "https://other.example/picture" }, status: 302 })
    }),
    resolve: async () => ["8.8.8.8"],
    sourceUrl: "https://provider.example/start",
  })
  expect(alternateHost.success).toBe(false)
  expect(fetched).toBe(1)
})
