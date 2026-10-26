import { createPublicKey, createVerify } from "node:crypto"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import { oidcBase64UrlDecode } from "./oidcBase64UrlDecode.js"
import { oidcClockSkewMs } from "./oidcClockSkewMs.js"

type OidcJwtVerifyClock = {
  readonly now?: number
  readonly skewMs?: number
}

export function oidcJwtVerify(
  token: string,
  publicJwk: Record<string, unknown>,
  clock?: OidcJwtVerifyClock,
): Result<Record<string, unknown>> {
  const op = "oidcJwtVerify"
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return resultErrorCreate(op, "The token is invalid.", "oidc.invalid")
    const [encodedHeader, encodedPayload, encodedSignature] = parts
    if (encodedHeader === undefined || encodedPayload === undefined || encodedSignature === undefined)
      return resultErrorCreate(op, "The token is invalid.", "oidc.invalid")
    const headerBytes = oidcBase64UrlDecode(encodedHeader)
    const payloadBytes = oidcBase64UrlDecode(encodedPayload)
    const signature = oidcBase64UrlDecode(encodedSignature)
    if (headerBytes === null || payloadBytes === null || signature === null)
      return resultErrorCreate(op, "The token is invalid.", "oidc.invalid")
    const header = JSON.parse(Buffer.from(headerBytes).toString("utf8")) as { alg?: string; kid?: string; typ?: string }
    const payload = JSON.parse(Buffer.from(payloadBytes).toString("utf8")) as Record<string, unknown>
    if (header.alg !== "RS256" || header.typ !== "JWT" || header.kid !== publicJwk.kid)
      return resultErrorCreate(op, "The token is invalid.", "oidc.invalid")
    if (publicJwk.kty !== "RSA" || publicJwk.alg !== "RS256" || publicJwk.use !== "sig")
      return resultErrorCreate(op, "The token is invalid.", "oidc.invalid")
    const modulus = typeof publicJwk.n === "string" ? oidcBase64UrlDecode(publicJwk.n) : null
    const exponent = typeof publicJwk.e === "string" ? oidcBase64UrlDecode(publicJwk.e) : null
    if (modulus === null || exponent === null || modulus.length === 0 || exponent.length === 0)
      return resultErrorCreate(op, "The token is invalid.", "oidc.invalid")
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
    if (!valid) return resultErrorCreate(op, "The token is invalid.", "oidc.invalid")
    if (clock?.now !== undefined) {
      const skew = clock.skewMs ?? oidcClockSkewMs
      const exp = payload.exp
      if (typeof exp !== "number" || !Number.isSafeInteger(exp) || exp * 1_000 + skew <= clock.now)
        return resultErrorCreate(op, "The token is invalid.", "oidc.invalid")
      const nbf = payload.nbf
      if (
        nbf !== undefined &&
        (typeof nbf !== "number" || !Number.isSafeInteger(nbf) || nbf * 1_000 - skew > clock.now)
      )
        return resultErrorCreate(op, "The token is invalid.", "oidc.invalid")
    }
    return resultCreate(payload)
  } catch (_error) {
    return resultErrorCreate(op, "The token is invalid.", "oidc.invalid")
  }
}
