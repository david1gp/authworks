import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { oidcBase64UrlEncode } from "./oidcBase64UrlEncode.js"
import { oidcBase64UrlDecode } from "./oidcBase64UrlDecode.js"

export function oidcValueEncrypt(value: string, realmId: string, secret?: Secret | string): Result<string> {
  const op = "oidcValueEncrypt"
  try {
    const key = oidcEncryptionKeyCreate(realmId, secret)
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", key, iv)
    cipher.setAAD(Buffer.from(realmId))
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
    return resultCreate(
      `v1.${oidcBase64UrlEncode(iv)}.${oidcBase64UrlEncode(encrypted)}.${oidcBase64UrlEncode(cipher.getAuthTag())}`,
    )
  } catch (_error) {
    return resultErrorCreate(op, "The protected value could not be encrypted.")
  }
}

export function oidcValueDecrypt(value: string, realmId: string, secret?: Secret | string): Result<string> {
  const op = "oidcValueDecrypt"
  try {
    const [version, ivEncoded, encryptedEncoded, tagEncoded] = value.split(".")
    if (version !== "v1" || ivEncoded === undefined || encryptedEncoded === undefined || tagEncoded === undefined)
      return resultErrorCreate(op, "The protected value could not be decrypted.")
    const iv = oidcBase64UrlDecode(ivEncoded)
    const encrypted = oidcBase64UrlDecode(encryptedEncoded)
    const tag = oidcBase64UrlDecode(tagEncoded)
    if (iv === null || encrypted === null || tag === null)
      return resultErrorCreate(op, "The protected value could not be decrypted.")
    const decipher = createDecipheriv("aes-256-gcm", oidcEncryptionKeyCreate(realmId, secret), iv)
    decipher.setAAD(Buffer.from(realmId))
    decipher.setAuthTag(Buffer.from(tag))
    return resultCreate(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"))
  } catch (_error) {
    return resultErrorCreate(op, "The protected value could not be decrypted.")
  }
}

function oidcEncryptionKeyCreate(realmId: string, secret?: Secret | string): Buffer {
  const value =
    secret === undefined ? `development-only:${realmId}` : typeof secret === "string" ? secret : secret.valueGet()
  return createHash("sha256").update(`zitadel-v2-oidc:${realmId}:${value}`, "utf8").digest()
}
