import { createHash, createHmac } from "node:crypto"
import type { Result } from "#result"
import { resultCreate } from "../../errors/resultCreate.js"
import { resultErrorCreate } from "../../errors/resultErrorCreate.js"

export function r2RequestSign(input: {
  readonly accessKeyId: string
  readonly bodyHash: string
  readonly headers: Readonly<Record<string, string>>
  readonly method: string
  readonly secretAccessKey: string
  readonly timestamp: Date
  readonly url: string | URL
}): Result<{ authorization: string; amzDate: string; signedHeaders: string }> {
  const op = "r2RequestSign"
  if (input.accessKeyId.length === 0 || input.secretAccessKey.length === 0)
    return resultErrorCreate(op, "R2 request credentials are invalid.")
  if (!/^[0-9a-f]{64}$/.test(input.bodyHash)) return resultErrorCreate(op, "The R2 request payload hash is invalid.")
  if (!(input.timestamp instanceof Date) || !Number.isFinite(input.timestamp.getTime()))
    return resultErrorCreate(op, "The R2 request timestamp is invalid.")

  let url: URL
  try {
    url = new URL(input.url)
  } catch (_error) {
    return resultErrorCreate(op, "The R2 request URL is invalid.")
  }
  if (url.username !== "" || url.password !== "") return resultErrorCreate(op, "The R2 request URL is invalid.")

  try {
    const amzDate = input.timestamp.toISOString().replace(/[-:]|\.\d{3}/g, "")
    const dateStamp = amzDate.slice(0, 8)
    const headers = {
      ...input.headers,
      "x-amz-date": amzDate,
    }
    const canonicalHeaders = r2CanonicalHeadersCreate(headers)
    if (!canonicalHeaders.success) return canonicalHeaders
    if (!canonicalHeaders.data.headers.has("host"))
      return resultErrorCreate(op, "The R2 request host header is missing.")
    if (!canonicalHeaders.data.headers.has("x-amz-content-sha256"))
      return resultErrorCreate(op, "The R2 request payload header is missing.")

    const signedHeaders = canonicalHeaders.data.signedHeaders
    const canonicalRequest = [
      input.method.toUpperCase(),
      r2CanonicalUriCreate(url),
      r2CanonicalQueryCreate(url),
      canonicalHeaders.data.value,
      signedHeaders,
      input.bodyHash,
    ].join("\n")
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
    ].join("\n")
    const dateKey = r2HmacCreate(`AWS4${input.secretAccessKey}`, dateStamp)
    const regionKey = r2HmacCreate(dateKey, "auto")
    const serviceKey = r2HmacCreate(regionKey, "s3")
    const signingKey = r2HmacCreate(serviceKey, "aws4_request")
    const signature = r2HmacCreate(signingKey, stringToSign).toString("hex")
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`
    return resultCreate({ authorization, amzDate, signedHeaders })
  } catch (_error) {
    return resultErrorCreate(op, "The R2 request could not be signed.")
  }
}

function r2CanonicalHeadersCreate(headers: Readonly<Record<string, string>>): Result<{
  headers: Map<string, string>
  signedHeaders: string
  value: string
}> {
  const op = "r2RequestSign"
  const normalized = new Map<string, string>()
  for (const [name, value] of Object.entries(headers)) {
    const normalizedName = name.toLowerCase()
    if (!/^[a-z0-9-]+$/.test(normalizedName) || /[\r\n]/.test(value))
      return resultErrorCreate(op, "The R2 request headers are invalid.")
    if (normalized.has(normalizedName)) return resultErrorCreate(op, "The R2 request headers are invalid.")
    normalized.set(normalizedName, value.trim().replace(/\s+/g, " "))
  }
  const names = [...normalized.keys()].sort()
  return resultCreate({
    headers: normalized,
    signedHeaders: names.join(";"),
    value: `${names.map((name) => `${name}:${normalized.get(name)}`).join("\n")}\n`,
  })
}

function r2CanonicalUriCreate(url: URL): string {
  return url.pathname
    .split("/")
    .map((segment) => r2Encode(decodeURIComponent(segment)))
    .join("/")
}

function r2CanonicalQueryCreate(url: URL): string {
  return [...url.searchParams.entries()]
    .map(([name, value]) => [r2Encode(name), r2Encode(value)] as const)
    .sort(([firstName, firstValue], [secondName, secondValue]) =>
      firstName === secondName ? firstValue.localeCompare(secondValue) : firstName.localeCompare(secondName),
    )
    .map(([name, value]) => `${name}=${value}`)
    .join("&")
}

function r2Encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function r2HmacCreate(key: string | Uint8Array, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest()
}
