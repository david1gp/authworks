import { createPublicKey, createVerify } from "node:crypto"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { oidcBase64UrlDecode } from "./oidcBase64UrlDecode.js"

export function oidcJwtVerify(token: string, publicJwk: Record<string, unknown>): Result<Record<string, unknown>> {
  const op = "oidcJwtVerify"
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return resultErrorCreate(op, "The token is invalid.")
    const [encodedHeader, encodedPayload, encodedSignature] = parts
    if (encodedHeader === undefined || encodedPayload === undefined || encodedSignature === undefined)
      return resultErrorCreate(op, "The token is invalid.")
    const headerBytes = oidcBase64UrlDecode(encodedHeader)
    const payloadBytes = oidcBase64UrlDecode(encodedPayload)
    const signature = oidcBase64UrlDecode(encodedSignature)
    if (headerBytes === null || payloadBytes === null || signature === null)
      return resultErrorCreate(op, "The token is invalid.")
    const header = JSON.parse(Buffer.from(headerBytes).toString("utf8")) as { alg?: string; kid?: string; typ?: string }
    const payload = JSON.parse(Buffer.from(payloadBytes).toString("utf8")) as Record<string, unknown>
    if (header.alg !== "RS256" || header.typ !== "JWT" || header.kid !== publicJwk.kid)
      return resultErrorCreate(op, "The token is invalid.")
    if (publicJwk.kty !== "RSA" || publicJwk.alg !== "RS256" || publicJwk.use !== "sig")
      return resultErrorCreate(op, "The token is invalid.")
    const modulus = typeof publicJwk.n === "string" ? oidcBase64UrlDecode(publicJwk.n) : null
    const exponent = typeof publicJwk.e === "string" ? oidcBase64UrlDecode(publicJwk.e) : null
    if (modulus === null || exponent === null || modulus.length === 0 || exponent.length === 0)
      return resultErrorCreate(op, "The token is invalid.")
    const verifier = createVerify("RSA-SHA256")
    verifier.update(`${encodedHeader}.${encodedPayload}`)
    verifier.end()
    const valid = verifier.verify(
      createPublicKey({
        key: {
          alg: "RS256",
          e: Buffer.from(exponent).toString("base64url"),
          kty: "RSA",
          n: Buffer.from(modulus).toString("base64url"),
          use: "sig",
        },
        format: "jwk",
      }),
      Buffer.from(signature),
    )
    if (!valid) return resultErrorCreate(op, "The token is invalid.")
    return resultCreate(payload)
  } catch (_error) {
    return resultErrorCreate(op, "The token is invalid.")
  }
}
