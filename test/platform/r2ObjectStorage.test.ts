import { expect, test } from "bun:test"
import { r2ObjectStorageCreate } from "../../src/platform/storage/r2/r2ObjectStorageCreate.js"

test("R2 object storage signs a deterministic PUT and sends immutable metadata", async () => {
  const requests: { body: Uint8Array; headers: Headers; init: RequestInit; url: string }[] = []
  const storage = r2ObjectStorageCreate(
    {
      accessKeyId: "test-access-key",
      accountId: "account-id",
      bucket: "contentoren-authworks",
      endpoint: "https://account-id.r2.cloudflarestorage.com",
      publicOrigin: "https://assets.authworks.contentoren.de",
      secretAccessKey: "test-secret-key",
    },
    {
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers)
        requests.push({ body: init?.body as Uint8Array, headers, init: init ?? {}, url: input.toString() })
        return new Response(null, { status: 200 })
      },
      now: () => new Date("2026-08-26T12:34:56.000Z"),
    },
  )
  const body = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])

  const stored = await storage.put({
    body,
    cacheControl: "public, max-age=31536000, immutable",
    contentType: "image/jpeg",
    key: "user-pictures/alice_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.jpg",
  })

  expect(stored).toEqual({ data: undefined, success: true })
  expect(requests).toHaveLength(1)
  const request = requests[0]
  expect(request).toBeDefined()
  if (request === undefined) return
  expect(request.url).toBe(
    "https://account-id.r2.cloudflarestorage.com/contentoren-authworks/user-pictures/alice_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.jpg",
  )
  expect(request.init.method).toBe("PUT")
  expect(request.body).toEqual(body)
  expect(request.headers.get("content-type")).toBe("image/jpeg")
  expect(request.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
  expect(request.headers.get("host")).toBe("account-id.r2.cloudflarestorage.com")
  expect(request.headers.get("x-amz-date")).toBe("20260826T123456Z")
  expect(request.headers.get("x-amz-content-sha256")).toBe(
    "32461d5bd1773012acef0ba15636752949bd7c2ce50f9172159d9f56cf0dd9af",
  )
  expect(request.headers.get("authorization")).toBe(
    "AWS4-HMAC-SHA256 Credential=test-access-key/20260826/auto/s3/aws4_request, SignedHeaders=cache-control;content-type;host;x-amz-content-sha256;x-amz-date, Signature=543ab789c26f1c4601d204232779f25271412164345cba2cde59142c50f10a69",
  )
})

test("R2 object storage signs DELETE requests and reports provider failures", async () => {
  const requests: { headers: Headers; init: RequestInit; url: string }[] = []
  const storage = r2ObjectStorageCreate(
    {
      accessKeyId: "test-access-key",
      accountId: "account-id",
      bucket: "contentoren-authworks",
      endpoint: "https://account-id.r2.cloudflarestorage.com",
      publicOrigin: "https://assets.authworks.contentoren.de",
      secretAccessKey: "test-secret-key",
    },
    {
      fetch: async (input, init) => {
        requests.push({ headers: new Headers(init?.headers), init: init ?? {}, url: input.toString() })
        return new Response(null, { status: 204 })
      },
      now: () => new Date("2026-08-26T12:34:56.000Z"),
    },
  )

  const deleted = await storage.delete({
    key: "user-pictures/alice_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.jpg",
  })

  expect(deleted).toEqual({ data: undefined, success: true })
  expect(requests).toHaveLength(1)
  expect(requests[0]?.url).toBe(
    "https://account-id.r2.cloudflarestorage.com/contentoren-authworks/user-pictures/alice_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.jpg",
  )
  expect(requests[0]?.init.method).toBe("DELETE")
  expect(requests[0]?.headers.get("host")).toBe("account-id.r2.cloudflarestorage.com")
  expect(requests[0]?.headers.get("x-amz-content-sha256")).toBe(
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  )

  const failed = r2ObjectStorageCreate(
    {
      accessKeyId: "test-access-key",
      accountId: "account-id",
      bucket: "bucket",
      endpoint: "https://account-id.r2.cloudflarestorage.com",
      publicOrigin: "https://assets.example.test",
      secretAccessKey: "test-secret-key",
    },
    { fetch: async () => new Response(null, { status: 500 }) },
  )
  expect(
    await failed.delete({
      key: "user-pictures/a_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.jpg",
    }),
  ).toMatchObject({ success: false })
})

test("R2 object storage does not fetch when DELETE signing fails", async () => {
  let fetched = false
  const storage = r2ObjectStorageCreate(
    {
      accessKeyId: "",
      accountId: "account-id",
      bucket: "bucket",
      endpoint: "https://account-id.r2.cloudflarestorage.com",
      publicOrigin: "https://assets.example.test",
      secretAccessKey: "test-secret-key",
    },
    { fetch: async () => ((fetched = true), new Response(null, { status: 204 })) },
  )

  const rejected = await storage.delete({
    key: "user-pictures/a_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.jpg",
  })
  expect(rejected.success).toBe(false)
  expect(fetched).toBe(false)
})

test("R2 object storage rejects a non-immutable cache policy without fetching", async () => {
  let fetched = false
  const storage = r2ObjectStorageCreate(
    {
      accessKeyId: "test-access-key",
      accountId: "account-id",
      bucket: "bucket",
      endpoint: "https://account-id.r2.cloudflarestorage.com",
      publicOrigin: "https://assets.example.test",
      secretAccessKey: "test-secret-key",
    },
    { fetch: async () => ((fetched = true), new Response(null, { status: 200 })) },
  )

  const rejected = await storage.put({
    body: Uint8Array.from([1]),
    cacheControl: "public, max-age=60",
    contentType: "image/png",
    key: "picture.png",
  })
  expect(rejected.success).toBe(false)
  expect(fetched).toBe(false)
})

test("R2 object storage rejects a non-HTTPS endpoint without fetching", async () => {
  let fetched = false
  const storage = r2ObjectStorageCreate(
    {
      accessKeyId: "test-access-key",
      accountId: "account-id",
      bucket: "bucket",
      endpoint: "http://account-id.r2.cloudflarestorage.com",
      publicOrigin: "https://assets.example.test",
      secretAccessKey: "test-secret-key",
    },
    { fetch: async () => ((fetched = true), new Response(null, { status: 200 })) },
  )

  const rejected = await storage.put({
    body: Uint8Array.from([1]),
    cacheControl: "public, max-age=31536000, immutable",
    contentType: "image/png",
    key: "picture.png",
  })
  expect(rejected.success).toBe(false)
  expect(fetched).toBe(false)
})
