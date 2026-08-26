import { createHash } from "node:crypto"
import type { Result } from "#result"
import type { R2Configuration } from "../../configuration/r2ConfigurationSchema.js"
import { resultCreate } from "../../errors/resultCreate.js"
import { resultErrorCreate } from "../../errors/resultErrorCreate.js"
import type { R2ObjectStorage } from "./r2ObjectStorage.js"
import { r2RequestSign } from "./r2RequestSign.js"

const immutableCacheControl = "public, max-age=31536000, immutable"
const emptyBodyHash = createHash("sha256").update(new Uint8Array()).digest("hex")

export function r2ObjectStorageCreate(
  configuration: R2Configuration,
  options: {
    readonly fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    readonly now?: () => Date
  } = {},
): R2ObjectStorage {
  return {
    delete: async (input) => {
      const op = "r2ObjectStorageDelete"
      const objectUrl = r2ObjectUrlCreate(configuration, input.key, op)
      if (!objectUrl.success) return objectUrl
      const signed = r2RequestSign({
        accessKeyId: configuration.accessKeyId,
        bodyHash: emptyBodyHash,
        headers: {
          host: objectUrl.data.host,
          "x-amz-content-sha256": emptyBodyHash,
        },
        method: "DELETE",
        secretAccessKey: configuration.secretAccessKey,
        timestamp: options.now?.() ?? new Date(),
        url: objectUrl.data,
      })
      if (!signed.success) return signed

      try {
        const response = await (options.fetch ?? fetch)(objectUrl.data, {
          headers: {
            Authorization: signed.data.authorization,
            Host: objectUrl.data.host,
            "x-amz-content-sha256": emptyBodyHash,
            "x-amz-date": signed.data.amzDate,
          },
          method: "DELETE",
        })
        if (!response.ok && response.status !== 404) return resultErrorCreate(op, "The R2 object could not be deleted.")
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCreate(op, "The R2 object could not be deleted.")
      }
    },
    put: async (input) => {
      const op = "r2ObjectStoragePut"
      if (!(input.body instanceof Uint8Array) || input.body.length === 0)
        return resultErrorCreate(op, "The R2 object body is invalid.")
      if (input.contentType.length === 0 || /[\r\n]/.test(input.contentType))
        return resultErrorCreate(op, "The R2 object content type is invalid.")
      if (input.cacheControl !== immutableCacheControl)
        return resultErrorCreate(op, "The R2 object cache policy is invalid.")

      const objectUrl = r2ObjectUrlCreate(configuration, input.key, op)
      if (!objectUrl.success) return objectUrl
      const bodyHash = createHash("sha256").update(input.body).digest("hex")
      const signed = r2RequestSign({
        accessKeyId: configuration.accessKeyId,
        bodyHash,
        headers: {
          "cache-control": input.cacheControl,
          "content-type": input.contentType,
          host: objectUrl.data.host,
          "x-amz-content-sha256": bodyHash,
        },
        method: "PUT",
        secretAccessKey: configuration.secretAccessKey,
        timestamp: options.now?.() ?? new Date(),
        url: objectUrl.data,
      })
      if (!signed.success) return signed

      try {
        const response = await (options.fetch ?? fetch)(objectUrl.data, {
          body: input.body as BodyInit,
          headers: {
            Authorization: signed.data.authorization,
            "Cache-Control": input.cacheControl,
            "Content-Type": input.contentType,
            Host: objectUrl.data.host,
            "x-amz-content-sha256": bodyHash,
            "x-amz-date": signed.data.amzDate,
          },
          method: "PUT",
        })
        if (!response.ok) return resultErrorCreate(op, "The R2 object could not be stored.")
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCreate(op, "The R2 object could not be stored.")
      }
    },
  }
}

function r2ObjectUrlCreate(configuration: R2Configuration, key: string, op: string): Result<URL> {
  if (key.length === 0 || key.startsWith("/") || key.includes("\\") || /[?#\r\n]/.test(key))
    return resultErrorCreate(op, "The R2 object key is invalid.")
  if (key.split("/").some((segment) => segment.length === 0))
    return resultErrorCreate(op, "The R2 object key is invalid.")

  let endpoint: URL
  try {
    endpoint = new URL(configuration.endpoint)
  } catch (_error) {
    return resultErrorCreate(op, "The R2 object endpoint is invalid.")
  }
  if (endpoint.protocol !== "https:" || endpoint.username !== "" || endpoint.password !== "")
    return resultErrorCreate(op, "The R2 object endpoint is invalid.")
  const endpointPath = endpoint.pathname.replace(/\/+$/, "")
  const objectPath = [
    endpointPath,
    encodeURIComponent(configuration.bucket),
    ...key.split("/").map((segment) => encodeURIComponent(segment)),
  ]
    .filter((segment) => segment.length > 0)
    .join("/")
  endpoint.pathname = `/${objectPath}`
  endpoint.search = ""
  endpoint.hash = ""
  return resultCreate(endpoint)
}
