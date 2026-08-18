import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"

export function mfaTotpSecretProtect(
  operation: "decrypt" | "encrypt",
  value: string,
  realmId: string,
  secret?: Secret | string,
): Result<string> {
  const op = "mfaTotpSecretProtect"
  if (realmId.length === 0)
    return resultErrorCreate(op, "The TOTP secret protection context is invalid.", "mfa.invalid")
  try {
    const keyValue =
      secret === undefined ? `development-only:${realmId}` : typeof secret === "string" ? secret : secret.valueGet()
    const key = createHash("sha256").update(`authworks-mfa:${realmId}:${keyValue}`, "utf8").digest()
    if (operation === "encrypt") {
      const iv = randomBytes(12)
      const cipher = createCipheriv("aes-256-gcm", key, iv)
      cipher.setAAD(Buffer.from(realmId))
      const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
      return resultCreate(
        `v1.${iv.toString("base64url")}.${encrypted.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`,
      )
    }
    const [version, ivEncoded, encryptedEncoded, tagEncoded] = value.split(".")
    if (version !== "v1" || ivEncoded === undefined || encryptedEncoded === undefined || tagEncoded === undefined)
      return resultErrorCreate(op, "The TOTP secret could not be decrypted.", "mfa.invalid")
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivEncoded, "base64url"))
    decipher.setAAD(Buffer.from(realmId))
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"))
    return resultCreate(
      Buffer.concat([decipher.update(Buffer.from(encryptedEncoded, "base64url")), decipher.final()]).toString("utf8"),
    )
  } catch (_error) {
    return resultErrorCreate(
      op,
      operation === "encrypt" ? "The TOTP secret could not be protected." : "The TOTP secret could not be decrypted.",
      "mfa.invalid",
    )
  }
}
