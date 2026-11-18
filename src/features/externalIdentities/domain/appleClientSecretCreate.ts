import { createPrivateKey, sign } from "node:crypto"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

type AppleClientSecretCreateInput = {
  readonly clientId: string
  readonly issuedAtSeconds: number
  readonly keyId: string
  readonly privateKey: string
  readonly teamId: string
}

/**
 * Creates the `client_secret` JWT for Apple's token endpoint. Apple issues no static
 * secret: the server signs a short-lived ES256 JWT with the Sign in with Apple .p8
 * private key (header `kid` is the key ID; `iss` is the team ID, `sub` is the Services
 * ID / client ID, `aud` is `https://appleid.apple.com`).
 */
export function appleClientSecretCreate(input: AppleClientSecretCreateInput): Result<string> {
  const op = "appleClientSecretCreate"
  if (
    input.clientId.length === 0 ||
    input.teamId.length === 0 ||
    input.keyId.length === 0 ||
    input.privateKey.length === 0
  )
    return resultErrorCreate(op, "The Apple provider configuration is incomplete.", "external-identities.invalid")
  if (!Number.isSafeInteger(input.issuedAtSeconds) || input.issuedAtSeconds <= 0)
    return resultErrorCreate(
      op,
      "The Apple client secret timestamp is invalid.",
      "external-identities.invalid-timestamp",
    )
  try {
    const key = createPrivateKey({ format: "pem", key: input.privateKey.trim() })
    if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1")
      return resultErrorCreate(
        op,
        "The Apple private key must be a P-256 elliptic-curve key.",
        "external-identities.invalid",
      )
    const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: input.keyId }), "utf8").toString("base64url")
    const payload = Buffer.from(
      JSON.stringify({
        aud: "https://appleid.apple.com",
        exp: input.issuedAtSeconds + 15 * 60,
        iat: input.issuedAtSeconds,
        iss: input.teamId,
        sub: input.clientId,
      }),
      "utf8",
    ).toString("base64url")
    const signature = sign("sha256", Buffer.from(`${header}.${payload}`, "utf8"), {
      dsaEncoding: "ieee-p1363",
      key,
    })
    return resultCreate(`${header}.${payload}.${signature.toString("base64url")}`)
  } catch (_error) {
    return resultErrorCreate(op, "The Apple private key is invalid.", "external-identities.invalid")
  }
}
