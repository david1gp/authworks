import { createPublicKey, generateKeyPairSync } from "node:crypto"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import { oidcBase64UrlEncode } from "./oidcBase64UrlEncode.js"

export function oidcKeyMaterialCreate(): Result<{ privateKey: string; publicJwk: Record<string, string> }> {
  const op = "oidcKeyMaterialCreate"
  try {
    const pair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { format: "der", type: "pkcs8" },
      publicKeyEncoding: { format: "der", type: "spki" },
    })
    const publicKey = createPublicKey({ format: "der", key: pair.publicKey, type: "spki" }).export({
      format: "jwk",
    }) as {
      e: string
      kty: string
      n: string
    }
    return resultCreate({
      privateKey: oidcBase64UrlEncode(pair.privateKey),
      publicJwk: { alg: "RS256", e: publicKey.e, kty: publicKey.kty, n: publicKey.n, use: "sig" },
    })
  } catch (_error) {
    return resultErrorCreate(op, "The signing key could not be generated.", "oidc.write-failed")
  }
}
