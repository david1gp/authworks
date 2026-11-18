import { expect, test } from "bun:test"
import { generateKeyPairSync, verify } from "node:crypto"
import { appleClientSecretCreate } from "./appleClientSecretCreate.js"

function testKeyPair() {
  return generateKeyPairSync("ec", { namedCurve: "prime256v1" })
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64")
}

test("apple client secret builds a signed ES256 JWT with Apple's claims", () => {
  const { privateKey, publicKey } = testKeyPair()
  const privatePem = privateKey.export({ format: "pem", type: "pkcs8" }).toString()
  const issuedAt = 1_800_000_000
  const created = appleClientSecretCreate({
    clientId: "com.example.services",
    issuedAtSeconds: issuedAt,
    keyId: "ABC123DEFG",
    privateKey: privatePem,
    teamId: "TEAM123456",
  })
  expect(created.success).toBe(true)
  if (!created.success) return
  const parts = created.data.split(".")
  expect(parts).toHaveLength(3)
  const header = JSON.parse(base64UrlDecode(parts[0] as string).toString("utf8")) as Record<string, unknown>
  expect(header).toMatchObject({ alg: "ES256", kid: "ABC123DEFG" })
  const payload = JSON.parse(base64UrlDecode(parts[1] as string).toString("utf8")) as Record<string, unknown>
  expect(payload).toMatchObject({
    aud: "https://appleid.apple.com",
    iat: issuedAt,
    iss: "TEAM123456",
    sub: "com.example.services",
  })
  expect(payload.exp).toBe(issuedAt + 15 * 60)
  const signature = base64UrlDecode(parts[2] as string)
  expect(
    verify(
      "sha256",
      Buffer.from(`${parts[0]}.${parts[1]}`, "utf8"),
      { dsaEncoding: "ieee-p1363", key: publicKey },
      signature,
    ),
  ).toBe(true)
})

test("apple client secret rejects incomplete configuration", () => {
  const { privateKey } = testKeyPair()
  const privatePem = privateKey.export({ format: "pem", type: "pkcs8" }).toString()
  const base = {
    clientId: "com.example.services",
    issuedAtSeconds: 1_800_000_000,
    keyId: "ABC123DEFG",
    privateKey: privatePem,
    teamId: "TEAM123456",
  }
  for (const input of [
    { ...base, teamId: "" },
    { ...base, keyId: "" },
    { ...base, clientId: "" },
    { ...base, privateKey: "" },
  ]) {
    const created = appleClientSecretCreate(input)
    expect(created.success).toBe(false)
  }
})

test("apple client secret rejects non-EC and malformed private keys", () => {
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const rsaPem = rsa.privateKey.export({ format: "pem", type: "pkcs8" }).toString()
  const rejected = appleClientSecretCreate({
    clientId: "com.example.services",
    issuedAtSeconds: 1_800_000_000,
    keyId: "ABC123DEFG",
    privateKey: rsaPem,
    teamId: "TEAM123456",
  })
  expect(rejected.success).toBe(false)
  const malformed = appleClientSecretCreate({
    clientId: "com.example.services",
    issuedAtSeconds: 1_800_000_000,
    keyId: "ABC123DEFG",
    privateKey: "-----BEGIN PRIVATE KEY-----\nnot-a-key\n-----END PRIVATE KEY-----",
    teamId: "TEAM123456",
  })
  expect(malformed.success).toBe(false)
})
