import { expect, test } from "bun:test"
import { createHash, createPrivateKey, createPublicKey, createSign, generateKeyPairSync } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { isoCBOR } from "@simplewebauthn/server/helpers"
import { passkeyAuthenticationComplete } from "../../src/features/passkeys/actions/passkeyAuthenticationComplete.js"
import { passkeyAuthenticationStart } from "../../src/features/passkeys/actions/passkeyAuthenticationStart.js"
import { passkeyCredentialList } from "../../src/features/passkeys/actions/passkeyCredentialList.js"
import { passkeyCredentialRevoke } from "../../src/features/passkeys/actions/passkeyCredentialRevoke.js"
import { passkeyRegistrationComplete } from "../../src/features/passkeys/actions/passkeyRegistrationComplete.js"
import { passkeyRegistrationStart } from "../../src/features/passkeys/actions/passkeyRegistrationStart.js"
import { passkeyApiClientCreate } from "../../src/features/passkeys/client/passkeyApiClientCreate.js"
import { passkeyUserHandleCreate } from "../../src/features/passkeys/domain/passkeyUserHandleCreate.js"
import type { PasskeyAuthenticationResponse } from "../../src/features/passkeys/public/passkeyAuthenticationResponseSchema.js"
import type { PasskeyRegistrationResponse } from "../../src/features/passkeys/public/passkeyRegistrationResponseSchema.js"
import { passkeyServerAppCreate } from "../../src/features/passkeys/server/passkeyServerAppCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionPasswordCreate } from "../../src/features/sessions/actions/sessionPasswordCreate.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { sessionBrowserModeHeaderName } from "../../src/features/sessions/public/sessionBrowserModeHeaderName.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const rpId = "example.com"
const origin = "https://example.com"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-passkeys-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data, testkit)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function createUser(database: StorageDatabase, domain: string) {
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const context = realmTenantContextCreate(realm.data.realm.id, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `${domain}@example.com`,
      password: "Correct Horse 12",
      profile: {},
      userName: domain.replaceAll(".", "-"),
    },
    realmId: realm.data.realm.id,
    onVerificationToken: (delivery) => {
      token = delivery.token
    },
  })
  expect(registered.success).toBe(true)
  const verified = passwordEmailVerify({ context, database, input: { token }, realmId: realm.data.realm.id })
  expect(verified.success).toBe(true)
  if (!verified.success) throw new Error(verified.errorMessage)
  return { context, realm: realm.data.realm, userId: verified.data.user.id }
}

function publicKeyCoordinates(publicKey: ReturnType<typeof createPublicKey>) {
  const jwk = publicKey.export({ format: "jwk" })
  if (typeof jwk !== "object" || jwk === null || !("x" in jwk) || !("y" in jwk))
    throw new Error("P-256 JWK missing coordinates")
  return { x: Buffer.from(String(jwk.x), "base64url"), y: Buffer.from(String(jwk.y), "base64url") }
}

function registrationResponse(
  options: { readonly challenge: string; readonly origin?: string; readonly userId: string },
  credentialId: Buffer,
  privateKey: ReturnType<typeof createPrivateKey>,
): PasskeyRegistrationResponse {
  const { x, y } = publicKeyCoordinates(createPublicKey(privateKey))
  const coseKey = isoCBOR.encode(
    new Map<number, unknown>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, x],
      [-3, y],
    ]) as never,
  )
  const authData = Buffer.concat([
    createHash("sha256").update(rpId).digest(),
    Buffer.from([0x45]),
    Buffer.alloc(4),
    Buffer.alloc(16),
    Buffer.from([credentialId.length >> 8, credentialId.length & 0xff]),
    credentialId,
    Buffer.from(coseKey),
  ])
  const clientDataJSON = Buffer.from(
    JSON.stringify({ challenge: options.challenge, origin: options.origin ?? origin, type: "webauthn.create" }),
    "utf8",
  ).toString("base64url")
  return {
    clientExtensionResults: {},
    id: credentialId.toString("base64url"),
    rawId: credentialId.toString("base64url"),
    response: {
      attestationObject: Buffer.from(
        isoCBOR.encode(
          new Map<string, unknown>([
            ["fmt", "none"],
            ["authData", authData],
            ["attStmt", new Map()],
          ]) as never,
        ),
      ).toString("base64url"),
      clientDataJSON,
      transports: ["internal"],
    },
    type: "public-key",
  }
}

function authenticationResponse(
  options: {
    readonly challenge: string
    readonly userId: string
    readonly counter: number
    readonly origin?: string
    readonly up?: boolean
    readonly uv?: boolean
    readonly type?: string
  },
  credentialId: Buffer,
  privateKey: ReturnType<typeof createPrivateKey>,
): PasskeyAuthenticationResponse {
  const flags = (options.up === false ? 0 : 1) | (options.uv === false ? 0 : 4)
  const authData = Buffer.concat([
    createHash("sha256").update(rpId).digest(),
    Buffer.from([flags]),
    Buffer.from([
      (options.counter >>> 24) & 0xff,
      (options.counter >>> 16) & 0xff,
      (options.counter >>> 8) & 0xff,
      options.counter & 0xff,
    ]),
  ])
  const clientDataJSON = Buffer.from(
    JSON.stringify({
      challenge: options.challenge,
      origin: options.origin ?? origin,
      type: options.type ?? "webauthn.get",
    }),
    "utf8",
  )
  const signature = createSign("SHA256")
    .update(Buffer.concat([authData, createHash("sha256").update(clientDataJSON).digest()]))
    .sign(privateKey)
  return {
    clientExtensionResults: {},
    id: credentialId.toString("base64url"),
    rawId: credentialId.toString("base64url"),
    response: {
      authenticatorData: authData.toString("base64url"),
      clientDataJSON: clientDataJSON.toString("base64url"),
      signature: signature.toString("base64url"),
      userHandle: passkeyUserHandleCreate(options.userId),
    },
    type: "public-key",
  }
}

test("passkeys perform real registration, discoverable authentication, protocol validation, replay protection, and step-up", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "passkeys.example.com")
    const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
    const credentialId = Buffer.from(testkit.runtime.randomBytes(32))
    const started = await passkeyRegistrationStart({
      actorId: fixture.userId,
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    const registrationInput = {
      response: registrationResponse(
        { challenge: started.data.options.challenge, userId: fixture.userId },
        credentialId,
        keys.privateKey,
      ),
      token: started.data.token,
    }
    const registered = await passkeyRegistrationComplete({
      actorId: fixture.userId,
      database,
      input: registrationInput,
      realmId: fixture.realm.id,
      origins: [origin],
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    if (!registered.success) throw new Error(registered.errorMessage)
    expect(registered.success).toBe(true)
    if (!registered.success) return
    expect(registered.data.credential.id).not.toContain(credentialId.toString("base64url"))

    const password = passwordLogin({
      context: fixture.context,
      database,
      input: { identifier: "passkeys-example-com", password: "Correct Horse 12" },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(password.success).toBe(true)
    if (!password.success || password.data.session === undefined) return
    const passwordSession = password.data.session

    const authenticationStarted = await passkeyAuthenticationStart({
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      purpose: "passwordless",
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
    })
    expect(authenticationStarted.success).toBe(true)
    if (!authenticationStarted.success) return
    expect(authenticationStarted.data.options.allowCredentials).toBeUndefined()
    const authenticationResponse = authenticationResponseCreate(
      authenticationStarted.data.options.challenge,
      fixture.userId,
      credentialId,
      keys.privateKey,
      1,
    )
    const authenticated = await passkeyAuthenticationComplete({
      database,
      input: { response: authenticationResponse, token: authenticationStarted.data.token },
      realmId: fixture.realm.id,
      origins: [origin],
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
    })
    expect(authenticated.success).toBe(true)
    if (!authenticated.success || authenticated.data.session === undefined) return
    expect(authenticated.data.session.session.authenticationMethod).toBe("passkey")
    expect(authenticated.data.session.session.assurance).toBe("authenticated")
    expect(
      await passkeyAuthenticationStart({
        actorId: fixture.userId,
        database,
        realmId: fixture.realm.id,
        origins: [origin],
        purpose: "step_up",
        rpId,
        rpName: "Test RP",
        runtime: testkit.runtime,
        sessionId: authenticated.data.session.session.id,
        userId: fixture.userId,
      }),
    ).toMatchObject({ code: "passkeys.conflict", success: false })
    expect(
      (
        await passkeyAuthenticationComplete({
          database,
          input: { response: authenticationResponse, token: authenticationStarted.data.token },
          realmId: fixture.realm.id,
          origins: [origin],
          rpId,
          rpName: "Test RP",
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)

    const invalidOriginStart = await passkeyAuthenticationStart({
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      purpose: "passwordless",
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
    })
    if (!invalidOriginStart.success) return
    expect(
      (
        await passkeyAuthenticationComplete({
          database,
          input: {
            response: authenticationResponseCreate(
              invalidOriginStart.data.options.challenge,
              fixture.userId,
              credentialId,
              keys.privateKey,
              2,
              { origin: "https://evil.example.com" },
            ),
            token: invalidOriginStart.data.token,
          },
          realmId: fixture.realm.id,
          origins: [origin],
          rpId,
          rpName: "Test RP",
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)

    const mismatchedChallengeStart = await passkeyAuthenticationStart({
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      purpose: "passwordless",
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
    })
    if (!mismatchedChallengeStart.success) return
    expect(
      (
        await passkeyAuthenticationComplete({
          database,
          input: {
            response: authenticationResponseCreate(
              "not-the-ceremony-challenge",
              fixture.userId,
              credentialId,
              keys.privateKey,
              2,
            ),
            token: mismatchedChallengeStart.data.token,
          },
          realmId: fixture.realm.id,
          origins: [origin],
          rpId,
          rpName: "Test RP",
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)

    const noPresenceStart = await passkeyAuthenticationStart({
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      purpose: "passwordless",
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
    })
    if (!noPresenceStart.success) return
    expect(
      (
        await passkeyAuthenticationComplete({
          database,
          input: {
            response: authenticationResponseCreate(
              noPresenceStart.data.options.challenge,
              fixture.userId,
              credentialId,
              keys.privateKey,
              2,
              { up: false },
            ),
            token: noPresenceStart.data.token,
          },
          realmId: fixture.realm.id,
          origins: [origin],
          rpId,
          rpName: "Test RP",
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)
    const noVerificationStart = await passkeyAuthenticationStart({
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      purpose: "passwordless",
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
    })
    if (!noVerificationStart.success) return
    expect(
      (
        await passkeyAuthenticationComplete({
          database,
          input: {
            response: authenticationResponseCreate(
              noVerificationStart.data.options.challenge,
              fixture.userId,
              credentialId,
              keys.privateKey,
              2,
              { uv: false },
            ),
            token: noVerificationStart.data.token,
          },
          realmId: fixture.realm.id,
          origins: [origin],
          rpId,
          rpName: "Test RP",
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)

    const expiredStart = await passkeyAuthenticationStart({
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      purpose: "passwordless",
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
    })
    if (!expiredStart.success) return
    testkit.advance(5 * 60 * 1_000 + 1)
    expect(
      (
        await passkeyAuthenticationComplete({
          database,
          input: {
            response: authenticationResponseCreate(
              expiredStart.data.options.challenge,
              fixture.userId,
              credentialId,
              keys.privateKey,
              2,
            ),
            token: expiredStart.data.token,
          },
          realmId: fixture.realm.id,
          origins: [origin],
          rpId,
          rpName: "Test RP",
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)

    const mfaWithoutSession = await passkeyAuthenticationStart({
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      purpose: "mfa",
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(mfaWithoutSession.success).toBe(false)

    const invalidSignatureStart = await passkeyAuthenticationStart({
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      purpose: "passwordless",
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
    })
    if (!invalidSignatureStart.success) return
    const invalidSignature = authenticationResponseCreate(
      invalidSignatureStart.data.options.challenge,
      fixture.userId,
      credentialId,
      keys.privateKey,
      2,
    )
    invalidSignature.response.signature = "AA"
    expect(
      (
        await passkeyAuthenticationComplete({
          database,
          input: { response: invalidSignature, token: invalidSignatureStart.data.token },
          realmId: fixture.realm.id,
          origins: [origin],
          rpId,
          rpName: "Test RP",
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)
    const invalidTypeStart = await passkeyAuthenticationStart({
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      purpose: "passwordless",
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
    })
    if (!invalidTypeStart.success) return
    expect(
      (
        await passkeyAuthenticationComplete({
          database,
          input: {
            response: authenticationResponseCreate(
              invalidTypeStart.data.options.challenge,
              fixture.userId,
              credentialId,
              keys.privateKey,
              2,
              { type: "webauthn.create" },
            ),
            token: invalidTypeStart.data.token,
          },
          realmId: fixture.realm.id,
          origins: [origin],
          rpId,
          rpName: "Test RP",
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)
    const counterStart = await passkeyAuthenticationStart({
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      purpose: "passwordless",
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
    })
    if (!counterStart.success) return
    expect(
      (
        await passkeyAuthenticationComplete({
          database,
          input: {
            response: authenticationResponseCreate(
              counterStart.data.options.challenge,
              fixture.userId,
              credentialId,
              keys.privateKey,
              1,
            ),
            token: counterStart.data.token,
          },
          realmId: fixture.realm.id,
          origins: [origin],
          rpId,
          rpName: "Test RP",
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)

    const stepUpStart = await passkeyAuthenticationStart({
      actorId: fixture.userId,
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      purpose: "step_up",
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
      sessionId: passwordSession.session.id,
      userId: fixture.userId,
    })
    expect(stepUpStart.success).toBe(true)
    if (!stepUpStart.success) return
    const steppedUp = await passkeyAuthenticationComplete({
      actorId: fixture.userId,
      database,
      expectedPurpose: "step_up",
      input: {
        response: authenticationResponseCreate(
          stepUpStart.data.options.challenge,
          fixture.userId,
          credentialId,
          keys.privateKey,
          2,
        ),
        token: stepUpStart.data.token,
      },
      realmId: fixture.realm.id,
      origins: [origin],
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
      sessionToken: passwordSession.token,
    })
    expect(steppedUp.success).toBe(true)
    if (steppedUp.success) expect(steppedUp.data.session?.session.mfaMethod).toBe("passkey")
    expect(sessionAuthenticate({ database, realmId: fixture.realm.id, token: passwordSession.token }).success).toBe(
      false,
    )
    const revoked = passkeyCredentialRevoke({
      actorId: fixture.userId,
      database,
      input: { credentialId: registered.data.credential.id },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(revoked.success).toBe(true)
    const listed = passkeyCredentialList({ database, realmId: fixture.realm.id, userId: fixture.userId })
    expect(listed.success).toBe(true)
    if (listed.success) expect(listed.data.items[0]?.revokedAt).not.toBeNull()
    expect(JSON.stringify(database.sqlite.query("SELECT payload FROM events").all())).not.toContain(
      credentialId.toString("base64url"),
    )

    const revokedAuthenticationStart = await passkeyAuthenticationStart({
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      purpose: "passwordless",
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
    })
    expect(revokedAuthenticationStart.success).toBe(true)
    if (!revokedAuthenticationStart.success) return
    expect(
      (
        await passkeyAuthenticationComplete({
          database,
          input: {
            response: authenticationResponseCreate(
              revokedAuthenticationStart.data.options.challenge,
              fixture.userId,
              credentialId,
              keys.privateKey,
              3,
            ),
            token: revokedAuthenticationStart.data.token,
          },
          realmId: fixture.realm.id,
          origins: [origin],
          rpId,
          rpName: "Test RP",
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)
  })
})

test("passkey registration binds origin and challenge before consuming its ceremony", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "passkey-registration.example.com")
    const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
    const credentialId = Buffer.from(testkit.runtime.randomBytes(32))
    const started = await passkeyRegistrationStart({
      actorId: fixture.userId,
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(started.success).toBe(true)
    if (!started.success) return

    const mismatchedChallenge = await passkeyRegistrationComplete({
      actorId: fixture.userId,
      database,
      input: {
        response: registrationResponse(
          { challenge: "not-the-ceremony-challenge", userId: fixture.userId },
          credentialId,
          keys.privateKey,
        ),
        token: started.data.token,
      },
      realmId: fixture.realm.id,
      origins: [origin],
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(mismatchedChallenge.success).toBe(false)

    const registered = await passkeyRegistrationComplete({
      actorId: fixture.userId,
      database,
      input: {
        response: registrationResponse(
          { challenge: started.data.options.challenge, userId: fixture.userId },
          credentialId,
          keys.privateKey,
        ),
        token: started.data.token,
      },
      realmId: fixture.realm.id,
      origins: [origin],
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(registered.success).toBe(true)

    const invalidOriginStart = await passkeyRegistrationStart({
      actorId: fixture.userId,
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(invalidOriginStart.success).toBe(true)
    if (!invalidOriginStart.success) return
    const invalidOrigin = await passkeyRegistrationComplete({
      actorId: fixture.userId,
      database,
      input: {
        response: registrationResponse(
          {
            challenge: invalidOriginStart.data.options.challenge,
            origin: "https://evil.example.com",
            userId: fixture.userId,
          },
          Buffer.from(testkit.runtime.randomBytes(32)),
          keys.privateKey,
        ),
        token: invalidOriginStart.data.token,
      },
      realmId: fixture.realm.id,
      origins: [origin],
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(invalidOrigin.success).toBe(false)
  })
})

test("passkey browser completion issues and upgrades an HttpOnly session cookie without disclosing credentials", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "passkeys-browser.example.com")
    const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
    const credentialId = Buffer.from(testkit.runtime.randomBytes(32))
    const registrationStarted = await passkeyRegistrationStart({
      actorId: fixture.userId,
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(registrationStarted.success).toBe(true)
    if (!registrationStarted.success) return
    const registered = await passkeyRegistrationComplete({
      actorId: fixture.userId,
      database,
      input: {
        response: registrationResponse(
          { challenge: registrationStarted.data.options.challenge, userId: fixture.userId },
          credentialId,
          keys.privateKey,
        ),
        token: registrationStarted.data.token,
      },
      realmId: fixture.realm.id,
      origins: [origin],
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(registered.success).toBe(true)
    if (!registered.success) return

    const app = passkeyServerAppCreate({
      browserMode: true,
      database,
      origins: [origin],
      publicOrigin: "https://passkeys-browser.example.com",
      rpId,
      rpName: "Test RP",
    })
    const authenticationStarted = await app.request(
      `https://passkeys-browser.example.com/realms/${fixture.realm.id}/passkeys/authentication/start`,
      {
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(authenticationStarted.status).toBe(200)
    const authenticationBody = (await authenticationStarted.json()) as { options: { challenge: string }; token: string }
    const authenticated = await app.request(
      `https://passkeys-browser.example.com/realms/${fixture.realm.id}/passkeys/authentication/complete`,
      {
        body: JSON.stringify({
          response: authenticationResponseCreate(
            authenticationBody.options.challenge,
            fixture.userId,
            credentialId,
            keys.privateKey,
            1,
          ),
          token: authenticationBody.token,
        }),
        headers: { "content-type": "application/json", [sessionBrowserModeHeaderName]: "true" },
        method: "POST",
      },
    )
    expect(authenticated.status).toBe(200)
    const loginCookie = authenticated.headers.get("set-cookie") ?? ""
    const loginToken = /^session=([^;]+);/.exec(loginCookie)?.[1]
    const authenticatedBody = (await authenticated.json()) as { session?: unknown }
    expect(loginToken).toHaveLength(43)
    expect(authenticatedBody.session).toBeUndefined()
    if (loginToken === undefined) return

    const unmarkedStart = await app.request(
      `https://passkeys-browser.example.com/realms/${fixture.realm.id}/passkeys/authentication/start`,
      {
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(unmarkedStart.status).toBe(200)
    const unmarkedStartBody = (await unmarkedStart.json()) as { options: { challenge: string }; token: string }
    const unmarked = await app.request(
      `https://passkeys-browser.example.com/realms/${fixture.realm.id}/passkeys/authentication/complete`,
      {
        body: JSON.stringify({
          response: authenticationResponseCreate(
            unmarkedStartBody.options.challenge,
            fixture.userId,
            credentialId,
            keys.privateKey,
            2,
          ),
          token: unmarkedStartBody.token,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(unmarked.status).toBe(200)
    expect(unmarked.headers.get("set-cookie")).toBeNull()
    const unmarkedBody = (await unmarked.json()) as { session?: { token?: string } }
    expect(unmarkedBody.session?.token).toHaveLength(43)

    const invalidStart = await app.request(
      `https://passkeys-browser.example.com/realms/${fixture.realm.id}/passkeys/authentication/start`,
      {
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(invalidStart.status).toBe(200)
    const invalidStartBody = (await invalidStart.json()) as { options: { challenge: string }; token: string }
    const invalid = await app.request(
      `https://passkeys-browser.example.com/realms/${fixture.realm.id}/passkeys/authentication/complete`,
      {
        body: JSON.stringify({
          response: authenticationResponseCreate(
            invalidStartBody.options.challenge,
            fixture.userId,
            credentialId,
            keys.privateKey,
            3,
          ),
          token: invalidStartBody.token,
        }),
        headers: { "content-type": "application/json", [sessionBrowserModeHeaderName]: "false" },
        method: "POST",
      },
    )
    expect(invalid.status).toBe(200)
    expect(invalid.headers.get("set-cookie")).toBeNull()
    const invalidBody = (await invalid.json()) as { session?: { token?: string } }
    expect(invalidBody.session?.token).toHaveLength(43)

    const csrfToken = sessionCsrfTokenCreate(testkit.runtime)
    const headers = {
      cookie: `${loginCookie.split(";", 1)[0]}; csrf=${csrfToken}`,
      origin: "https://passkeys-browser.example.com",
      [sessionBrowserModeHeaderName]: "true",
      "x-csrf-token": csrfToken,
    }
    const stepUpStarted = await app.request(
      `https://passkeys-browser.example.com/realms/${fixture.realm.id}/passkeys/step-up/start`,
      { headers, method: "POST" },
    )
    expect(stepUpStarted.status).toBe(409)
    expect(sessionAuthenticate({ database, realmId: fixture.realm.id, token: loginToken }).success).toBe(true)
  })
})

test("passkey route and API client preserve tenant isolation and bounded public contracts", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createUser(database, "passkey-alpha.example.com")
    const beta = await createUser(database, "passkey-beta.example.com")
    const login = passwordLogin({
      context: alpha.context,
      database,
      input: { identifier: "passkey-alpha-example-com", password: "Correct Horse 12" },
      realmId: alpha.realm.id,
      runtime: testkit.runtime,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) return
    const app = passkeyServerAppCreate({ database, origins: [origin], rpId, rpName: "Test RP" })
    const client = passkeyApiClientCreate({
      baseUrl: "https://example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: login.data.session.token,
    })
    const start = await client.passkeyRegistrationStart(alpha.realm.id)
    expect(start.success).toBe(true)
    if (!start.success) return
    const betaList = await passkeyApiClientCreate({
      baseUrl: "https://example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
    }).passkeyCredentialList(beta.realm.id)
    expect(betaList.success).toBe(false)
    expect(start.data.options.user.id).toBe(passkeyUserHandleCreate(alpha.userId))
  })
})

test("passkey ceremony and event writes are atomic when audit persistence fails", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "passkey-atomic.example.com")
    database.sqlite.run(
      "CREATE TRIGGER reject_passkey_events BEFORE INSERT ON events WHEN NEW.aggregate_type LIKE 'passkey_%' BEGIN SELECT RAISE(ABORT, 'rejected'); END",
    )
    const started = await passkeyRegistrationStart({
      actorId: fixture.userId,
      database,
      realmId: fixture.realm.id,
      origins: [origin],
      rpId,
      rpName: "Test RP",
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(started.success).toBe(false)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM passkey_ceremonies").get()).toEqual({ count: 0 })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM passkey_credentials").get()).toEqual({ count: 0 })
    database.sqlite.run("DROP TRIGGER reject_passkey_events")
  })
})

function authenticationResponseCreate(
  challenge: string,
  userId: string,
  credentialId: Buffer,
  privateKey: ReturnType<typeof createPrivateKey>,
  counter: number,
  overrides: { readonly origin?: string; readonly up?: boolean; readonly uv?: boolean; readonly type?: string } = {},
) {
  return authenticationResponse(
    { challenge, counter, origin: overrides.origin, type: overrides.type, up: overrides.up, userId, uv: overrides.uv },
    credentialId,
    privateKey,
  )
}
