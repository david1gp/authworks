import { createPrivateKey, createSign } from "node:crypto"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { oidcBase64UrlEncode } from "./oidcBase64UrlEncode.js"
import { oidcBase64UrlDecode } from "./oidcBase64UrlDecode.js"

export function oidcJwtSign(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKeyEncoded: string,
): Result<string> {
  const op = "oidcJwtSign"
  try {
    const encodedHeader = oidcBase64UrlEncode(JSON.stringify(header))
    const encodedPayload = oidcBase64UrlEncode(JSON.stringify(payload))
    const input = `${encodedHeader}.${encodedPayload}`
    const privateKey = oidcBase64UrlDecode(privateKeyEncoded)
    if (privateKey === null) return resultErrorCreate(op, "The signing key is invalid.")
    const signer = createSign("RSA-SHA256")
    signer.update(input)
    signer.end()
    return resultCreate(
      `${input}.${oidcBase64UrlEncode(signer.sign(createPrivateKey({ format: "der", key: privateKey, type: "pkcs8" })))} `.trim(),
    )
  } catch (_error) {
    return resultErrorCreate(op, "The token could not be signed.")
  }
}
