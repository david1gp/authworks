import { lookup as dnsLookup } from "node:dns/promises"
import { request as httpsRequest } from "node:https"
import { isIP } from "node:net"
import { Readable } from "node:stream"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

const userProfilePictureDownloadMaximumBytes = 512 * 1024
const userProfilePictureDownloadMaximumRedirects = 3
const userProfilePictureDownloadTimeoutMs = 10_000

type UserProfilePictureAddress = string | { readonly address: string }
type UserProfilePictureAddressResolve = (hostname: string) => Promise<readonly UserProfilePictureAddress[]>

type UserProfilePictureDownloadOptions = {
  readonly fetch?: typeof fetch
  readonly resolve?: UserProfilePictureAddressResolve
  readonly sourceUrl: string
}

export async function userProfilePictureDownload(
  options: UserProfilePictureDownloadOptions,
): Promise<Result<{ body: Uint8Array; contentType: string }>> {
  const op = "userProfilePictureDownload"
  const source = userProfilePictureSourceUrlParse(options.sourceUrl)
  if (!source.success) return source
  const signal = AbortSignal.timeout(userProfilePictureDownloadTimeoutMs)
  let url = source.data
  const sourceHost = source.data.host

  for (let redirect = 0; redirect <= userProfilePictureDownloadMaximumRedirects; redirect += 1) {
    const addresses = await userProfilePictureDestinationResolve(url, options.resolve)
    if (!addresses.success) return addresses

    let response: Response
    try {
      response =
        options.fetch === undefined
          ? await userProfilePictureHttpsFetch(url, signal, addresses.data[0] as string)
          : await options.fetch(url, { redirect: "manual", signal })
    } catch (_error) {
      return resultErrorCreate(op, "The provider picture could not be downloaded.")
    }

    if (isRedirectStatus(response.status)) {
      if (redirect === userProfilePictureDownloadMaximumRedirects) break
      const location = response.headers.get("location")
      let nextUrl: Result<URL> | undefined
      try {
        nextUrl = location === null ? undefined : userProfilePictureSourceUrlParse(new URL(location, url).toString())
      } catch (_error) {
        return resultErrorCreate(op, "The provider picture could not be downloaded.")
      }
      if (nextUrl === undefined || !nextUrl.success)
        return resultErrorCreate(op, "The provider picture could not be downloaded.")
      if (nextUrl.data.host !== sourceHost)
        return resultErrorCreate(op, "The provider picture could not be downloaded.")
      url = nextUrl.data
      await response.body?.cancel().catch(() => undefined)
      continue
    }

    if (!response.ok) return resultErrorCreate(op, "The provider picture could not be downloaded.")
    const contentType = userProfilePictureContentTypeGet(response.headers.get("content-type"))
    if (contentType === undefined || response.body === null)
      return resultErrorCreate(op, "The provider picture could not be downloaded.")
    const contentLength = response.headers.get("content-length")
    if (contentLength !== null) {
      const length = Number(contentLength)
      if (!Number.isSafeInteger(length) || length < 0 || length > userProfilePictureDownloadMaximumBytes)
        return resultErrorCreate(op, "The provider picture could not be downloaded.")
    }
    const body = await userProfilePictureBodyRead(response.body)
    if (!body.success) return body
    return resultCreate({ body: body.data, contentType })
  }

  return resultErrorCreate(op, "The provider picture could not be downloaded.")
}

async function userProfilePictureDestinationResolve(
  url: URL,
  resolve: UserProfilePictureAddressResolve | undefined,
): Promise<Result<readonly string[]>> {
  const op = "userProfilePictureDownload"
  const hostname = userProfilePictureHostnameNormalize(url.hostname)
  if (isIP(hostname) !== 0) return resultCreate([hostname])
  const resolver = resolve ?? userProfilePictureDnsResolve
  let resolved: readonly UserProfilePictureAddress[]
  try {
    resolved = await userProfilePictureAddressResolveWithTimeout(resolver, hostname)
  } catch (_error) {
    return resultErrorCreate(op, "The provider picture could not be downloaded.")
  }
  if (!Array.isArray(resolved)) return resultErrorCreate(op, "The provider picture could not be downloaded.")
  const addresses = resolved.map((value) => {
    if (typeof value === "string") return value
    if (value !== null && typeof value === "object" && typeof value.address === "string") return value.address
    return undefined
  })
  if (addresses.some((address) => address === undefined))
    return resultErrorCreate(op, "The provider picture could not be downloaded.")
  const validAddresses = addresses as readonly string[]
  if (validAddresses.length === 0 || validAddresses.some((address) => !userProfilePictureAddressIsPublic(address)))
    return resultErrorCreate(op, "The provider picture could not be downloaded.")
  return resultCreate(validAddresses)
}

function userProfilePictureAddressResolveWithTimeout(
  resolve: UserProfilePictureAddressResolve,
  hostname: string,
): Promise<readonly UserProfilePictureAddress[]> {
  return new Promise((resolveResult, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("The provider picture DNS lookup timed out.")),
      userProfilePictureDownloadTimeoutMs,
    )
    resolve(hostname).then(
      (value) => {
        clearTimeout(timeout)
        resolveResult(value)
      },
      (error: unknown) => {
        clearTimeout(timeout)
        reject(error)
      },
    )
  })
}

async function userProfilePictureDnsResolve(hostname: string): Promise<readonly string[]> {
  const resolved = await dnsLookup(hostname, { all: true, verbatim: true })
  return resolved.map((value) => value.address)
}

function userProfilePictureHttpsFetch(url: URL, signal: AbortSignal, address: string): Promise<Response> {
  if (!userProfilePictureAddressIsPublic(address))
    return Promise.reject(new Error("The connection address is invalid."))
  return new Promise((resolve, reject) => {
    let settled = false
    let responseStarted = false
    const request = httpsRequest(
      {
        hostname: userProfilePictureHostnameNormalize(url.hostname),
        lookup: (_hostname, _options, callback) => callback(null, address, isIP(address)),
        method: "GET",
        path: `${url.pathname}${url.search}`,
        port: url.port === "" ? 443 : Number(url.port),
        servername: userProfilePictureHostnameNormalize(url.hostname),
      },
      (response) => {
        responseStarted = true
        try {
          const headers = new Headers()
          for (const [name, value] of Object.entries(response.headers)) {
            if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value)
          }
          const body = Readable.toWeb(response) as unknown as ReadableStream<Uint8Array>
          const result = new Response(body, {
            headers,
            status: response.statusCode,
            statusText: response.statusMessage,
          })
          response.once("close", cleanup)
          settled = true
          resolve(result)
        } catch (error) {
          request.destroy()
          cleanup()
          if (!settled) {
            settled = true
            reject(error)
          }
        }
      },
    )
    const abort = () => request.destroy(new Error("The provider picture download timed out."))
    const cleanup = () => signal.removeEventListener("abort", abort)
    request.once("close", () => {
      if (!responseStarted) cleanup()
    })
    request.once("error", (error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    })
    signal.addEventListener("abort", abort, { once: true })
    if (signal.aborted) abort()
    request.end()
  })
}

async function userProfilePictureBodyRead(body: ReadableStream<Uint8Array>): Promise<Result<Uint8Array>> {
  const op = "userProfilePictureDownload"
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      if (!(chunk.value instanceof Uint8Array))
        return resultErrorCreate(op, "The provider picture could not be downloaded.")
      length += chunk.value.byteLength
      if (length > userProfilePictureDownloadMaximumBytes) {
        await reader.cancel().catch(() => undefined)
        return resultErrorCreate(op, "The provider picture could not be downloaded.")
      }
      chunks.push(chunk.value)
    }
  } catch (_error) {
    return resultErrorCreate(op, "The provider picture could not be downloaded.")
  } finally {
    reader.releaseLock()
  }

  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return resultCreate(result)
}

function userProfilePictureSourceUrlParse(value: string): Result<URL> {
  const op = "userProfilePictureDownload"
  if (value.length === 0 || value.length > 4096)
    return resultErrorCreate(op, "The provider picture could not be downloaded.")
  try {
    const url = new URL(value)
    const hostname = userProfilePictureHostnameNormalize(url.hostname)
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      hostname.length === 0 ||
      (isIP(hostname) !== 0 && !userProfilePictureAddressIsPublic(hostname))
    )
      return resultErrorCreate(op, "The provider picture could not be downloaded.")
    return resultCreate(url)
  } catch (_error) {
    return resultErrorCreate(op, "The provider picture could not be downloaded.")
  }
}

function userProfilePictureHostnameNormalize(value: string): string {
  return value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value
}

function userProfilePictureAddressIsPublic(value: string): boolean {
  const address = userProfilePictureHostnameNormalize(value)
  const family = isIP(address)
  if (family === 4) return userProfilePictureIpv4IsPublic(address)
  if (family === 6) return userProfilePictureIpv6IsPublic(address)
  return false
}

function userProfilePictureIpv4IsPublic(value: string): boolean {
  const octets = value.split(".").map(Number)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false
  const first = octets[0]
  const second = octets[1]
  if (first === undefined || second === undefined) return false
  if (first === 0 || first === 10 || first === 127 || first >= 224) return false
  if (first === 100 && second >= 64 && second <= 127) return false
  if (first === 169 && second === 254) return false
  if (first === 172 && second >= 16 && second <= 31) return false
  if (first === 192 && second === 0) return false
  if (first === 192 && second === 2) return false
  if (first === 192 && second === 168) return false
  if (first === 192 && second === 31 && octets[2] === 196) return false
  if (first === 192 && second === 88 && octets[2] === 99) return false
  if (first === 192 && second === 175 && octets[2] === 48) return false
  if (first === 198 && second >= 18 && second <= 19) return false
  if (first === 198 && second === 51) return false
  if (first === 203 && second === 0 && octets[2] === 113) return false
  return true
}

function userProfilePictureIpv6IsPublic(value: string): boolean {
  const words = userProfilePictureIpv6WordsCreate(value)
  if (words === undefined) return false
  const mapped = userProfilePictureIpv6MappedIpv4Create(words)
  if (mapped !== undefined) return userProfilePictureIpv4IsPublic(mapped)
  const first = words[0]
  const second = words[1]
  if (first === undefined || second === undefined) return false
  if (
    first < 0x2000 ||
    first > 0x3fff ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xffc0) === 0xfec0 ||
    (first & 0xff00) === 0xff00
  )
    return false
  if (
    first === 0x2001 &&
    (second === 0 || second === 2 || (second & 0xfff0) === 0x0010 || (second & 0xfff0) === 0x0020 || second === 0x0db8)
  )
    return false
  if (first === 0x2002) {
    const embeddedFirst = words[1]
    const embeddedSecond = words[2]
    if (embeddedFirst === undefined || embeddedSecond === undefined) return false
    const embedded = `${embeddedFirst >> 8}.${embeddedFirst & 0xff}.${embeddedSecond >> 8}.${embeddedSecond & 0xff}`
    if (!userProfilePictureIpv4IsPublic(embedded)) return false
  }
  return true
}

function userProfilePictureIpv6MappedIpv4Create(words: readonly number[]): string | undefined {
  if (words[0] !== 0 || words[1] !== 0 || words[2] !== 0 || words[3] !== 0 || words[4] !== 0 || words[5] !== 0xffff)
    return undefined
  const first = words[6]
  const second = words[7]
  if (first === undefined || second === undefined) return undefined
  return `${first >> 8}.${first & 0xff}.${second >> 8}.${second & 0xff}`
}

function userProfilePictureIpv6WordsCreate(value: string): readonly number[] | undefined {
  const sections = value.split("::")
  if (sections.length > 2) return undefined
  const left = userProfilePictureIpv6SectionParse(sections[0] ?? "", false)
  const right = userProfilePictureIpv6SectionParse(sections[1] ?? "", sections.length === 2)
  if (left === undefined || right === undefined) return undefined
  const missing = 8 - left.length - right.length
  if (missing < 0 || (sections.length === 1 && missing !== 0)) return undefined
  return [...left, ...new Array<number>(missing).fill(0), ...right]
}

function userProfilePictureIpv6SectionParse(value: string, compressed: boolean): readonly number[] | undefined {
  if (value === "") return []
  const parts = value.split(":")
  const words: number[] = []
  for (const [index, part] of parts.entries()) {
    if (part.includes(".")) {
      if (index !== parts.length - 1) return undefined
      const octets = part.split(".").map(Number)
      if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255))
        return undefined
      const first = octets[0]
      const second = octets[1]
      const third = octets[2]
      const fourth = octets[3]
      if (first === undefined || second === undefined || third === undefined || fourth === undefined) return undefined
      words.push((first << 8) | second, (third << 8) | fourth)
      continue
    }
    if (!/^[0-9a-f]{1,4}$/i.test(part)) return undefined
    words.push(Number.parseInt(part, 16))
  }
  if (!compressed && words.length > 8) return undefined
  return words
}

function userProfilePictureContentTypeGet(value: string | null): string | undefined {
  const contentType = value?.split(";", 1)[0]?.trim()
  return contentType === undefined || contentType.length === 0 ? undefined : contentType
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}
