import { expect, test } from "bun:test"
import { createSign, generateKeyPairSync } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import type { Result } from "#result"
import { externalIdentityCallback } from "../../src/features/externalIdentities/actions/externalIdentityCallback.js"
import { externalIdentityLinkComplete } from "../../src/features/externalIdentities/actions/externalIdentityLinkComplete.js"
import { externalIdentityLinkStart } from "../../src/features/externalIdentities/actions/externalIdentityLinkStart.js"
import { externalIdentityProviderCreate } from "../../src/features/externalIdentities/actions/externalIdentityProviderCreate.js"
import { externalIdentityStart } from "../../src/features/externalIdentities/actions/externalIdentityStart.js"
import type { ExternalIdentityProviderPort } from "../../src/features/externalIdentities/domain/externalIdentityProviderPort.js"
import { externalIdentityProviderPortCreate } from "../../src/features/externalIdentities/domain/externalIdentityProviderPortCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { userProfilePictureImport } from "../../src/features/users/actions/userProfilePictureImport.js"
import { userProfileUpdate } from "../../src/features/users/actions/userProfileUpdate.js"
import { userProfileTable } from "../../src/features/users/persistence/userProfileTable.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../src/platform/errors/resultErrorCreate.js"
import { runtimeCreate } from "../../src/platform/runtime/runtimeCreate.js"
import type { R2ObjectStorage } from "../../src/platform/storage/r2/r2ObjectStorage.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAACYktHRAAB3YoTpAAAAAd0SU1FB+oIGgccHxrvKFMAAAAKSURBVAjXY2gAAACCAIHdQ2r0AAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDI2LTA4LTI2VDA3OjI4OjMxKzAwOjAw7lEr7gAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyNi0wOC0yNlQwNzoyODozMSswMDowMJ8Mk1IAAAAodEVYdGRhdGU6dGltZXN0YW1wADIwMjYtMDgtMjZUMDc6Mjg6MzErMDA6MDDIGbKNAAAAAElFTkSuQmCC",
    "base64",
  ),
)

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-external-identity-pictures-"))
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

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

async function createProvider(database: StorageDatabase, realmId: string, type: "github" | "google") {
  const created = externalIdentityProviderCreate({
    context: realmSystemContextCreate(),
    database,
    input: {
      allowAccountCreation: true,
      clientId: "client-id",
      clientSecret: "client-secret",
      displayName: type,
      redirectUri: "https://app.test/callback",
      type,
    },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.provider
}

function testPort(options: {
  readonly email: string
  readonly picture?: string
  readonly providerType: "github" | "google"
  readonly subject: string
}): ExternalIdentityProviderPort {
  return {
    authorizationUrlCreate(_configuration, input) {
      return resultCreate(`https://provider.test/authorize?state=${encodeURIComponent(input.state)}`)
    },
    callbackExchange(_configuration, input) {
      return Promise.resolve(
        resultCreate({
          displayName: "External User",
          email: options.email,
          emailVerified: true,
          externalSubject: options.subject,
          ...(input.nonce === undefined ? {} : { nonce: input.nonce }),
          ...(options.picture === undefined ? {} : { picture: options.picture }),
          providerType: options.providerType,
          username: options.subject,
        }),
      )
    },
  }
}

function fetchCreate(handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>): typeof fetch {
  return Object.assign(handler, { preconnect: fetch.preconnect })
}

function pictureImportCreate(database: StorageDatabase, fetcher: typeof fetch, storage: R2ObjectStorage) {
  return (input: { readonly pictureUrl: string; readonly realmId: string; readonly userId: string }) =>
    userProfilePictureImport({
      database,
      fetch: fetcher,
      publicOrigin: "https://assets.authworks.contentoren.de",
      resolve: async () => ["8.8.8.8"],
      sourceUrl: input.pictureUrl,
      storage,
      realmId: input.realmId,
      userId: input.userId,
    })
}

async function callbackRun(options: {
  readonly database: StorageDatabase
  readonly port: ExternalIdentityProviderPort
  readonly providerId: string
  readonly realmId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly profilePictureImport?: (input: {
    readonly pictureUrl: string
    readonly realmId: string
    readonly userId: string
  }) => Promise<Result<void>>
}) {
  const started = externalIdentityStart({
    database: options.database,
    input: {},
    providerId: options.providerId,
    providerPorts: { google: options.port, github: options.port },
    realmId: options.realmId,
    runtime: options.runtime,
  })
  expect(started.success).toBe(true)
  if (!started.success) throw new Error(started.errorMessage)
  const state = new URL(started.data.authorizationUrl).searchParams.get("state") ?? ""
  return externalIdentityCallback({
    code: "provider-code",
    database: options.database,
    profilePictureImport: options.profilePictureImport,
    providerId: options.providerId,
    providerPorts: { google: options.port, github: options.port },
    realmId: options.realmId,
    runtime: options.runtime,
    state,
  })
}

test("Google picture and GitHub avatar_url are extracted into internal provider identities", async () => {
  const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const jwk = keyPair.publicKey.export({ format: "jwk" }) as Record<string, string>
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-key", typ: "JWT" })).toString("base64url")
  const claims = Buffer.from(
    JSON.stringify({
      aud: "client-id",
      email: "google@example.com",
      email_verified: true,
      exp: Math.floor(Date.now() / 1_000) + 3_600,
      iss: "https://accounts.google.com",
      name: "Google User",
      nonce: "nonce",
      sub: "google-subject",
    }),
  ).toString("base64url")
  const signedInput = `${header}.${claims}`
  const signer = createSign("RSA-SHA256")
  signer.update(signedInput)
  signer.end()
  const idToken = `${signedInput}.${signer.sign(keyPair.privateKey).toString("base64url")}`
  const googleFetcher = fetchCreate(async (input) => {
    const url = input.toString()
    if (url === "https://oauth2.googleapis.com/token")
      return new Response(JSON.stringify({ access_token: "access", id_token: idToken }))
    if (url === "https://www.googleapis.com/oauth2/v3/certs")
      return new Response(JSON.stringify({ keys: [{ ...jwk, kid: "test-key" }] }))
    if (url === "https://openidconnect.googleapis.com/v1/userinfo")
      return new Response(JSON.stringify({ picture: "https://google.example/avatar.png", sub: "google-subject" }))
    return new Response("not found", { status: 404 })
  })
  const google = externalIdentityProviderPortCreate({ fetch: googleFetcher }).google
  expect(google).toBeDefined()
  if (google === undefined) return
  const googleIdentity = await google.callbackExchange(
    {
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://app.test/callback",
      scopes: ["openid"],
      type: "google",
    },
    { code: "code", nonce: "nonce", pkceVerifier: "verifier" },
  )
  expect(googleIdentity).toMatchObject({ data: { picture: "https://google.example/avatar.png" }, success: true })

  const githubFetcher = fetchCreate(async (input) => {
    const url = input.toString()
    if (url === "https://github.com/login/oauth/access_token")
      return new Response(JSON.stringify({ access_token: "access" }))
    if (url === "https://api.github.com/user")
      return new Response(
        JSON.stringify({ avatar_url: "https://github.example/avatar.png", email: "github@example.com", id: 42 }),
      )
    return new Response("not found", { status: 404 })
  })
  const github = externalIdentityProviderPortCreate({ fetch: githubFetcher }).github
  expect(github).toBeDefined()
  if (github === undefined) return
  const githubIdentity = await github.callbackExchange(
    {
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://app.test/callback",
      scopes: ["user"],
      type: "github",
    },
    { code: "code", pkceVerifier: "verifier" },
  )
  expect(githubIdentity).toMatchObject({ data: { picture: "https://github.example/avatar.png" }, success: true })
})

type ExternalIdentityPictureMatrixCase = {
  readonly flow: "link" | "sign-in"
  readonly initial: "existing" | "missing"
  readonly providerType: "github" | "google"
}

const externalIdentityPictureMatrix: readonly ExternalIdentityPictureMatrixCase[] = [
  { flow: "sign-in", initial: "missing", providerType: "google" },
  { flow: "sign-in", initial: "existing", providerType: "google" },
  { flow: "sign-in", initial: "missing", providerType: "github" },
  { flow: "sign-in", initial: "existing", providerType: "github" },
  { flow: "link", initial: "missing", providerType: "google" },
  { flow: "link", initial: "existing", providerType: "google" },
  { flow: "link", initial: "missing", providerType: "github" },
  { flow: "link", initial: "existing", providerType: "github" },
]

function profilePictureUrlGet(database: StorageDatabase, userId: string): string | null {
  return (
    database.db
      .select({ pictureUrl: userProfileTable.pictureUrl })
      .from(userProfileTable)
      .where(eq(userProfileTable.userId, userId))
      .get()?.pictureUrl ?? null
  )
}

for (const matrixCase of externalIdentityPictureMatrix) {
  test(`Google/GitHub picture import (${matrixCase.providerType} ${matrixCase.flow} with ${matrixCase.initial} picture) sets missing pictures and preserves manual pictures`, async () => {
    await withDatabase(async (database, testkit) => {
      const tag = `${matrixCase.providerType}-${matrixCase.flow}-${matrixCase.initial}`
      const realm = await createRealm(database, `external-picture-${tag}.example.com`)
      const googleProvider = await createProvider(database, realm.id, "google")
      const githubProvider = await createProvider(database, realm.id, "github")
      const provider = matrixCase.providerType === "google" ? googleProvider : githubProvider
      const sourceUrl = `https://provider.example/${tag}-picture.png`
      const manualUrl = `https://manual.example/${tag}-avatar.png`
      let fetchCount = 0
      const uploads: { readonly key: string }[] = []
      const imageFetcher = fetchCreate(async () => {
        fetchCount += 1
        return new Response(png, { headers: { "content-type": "image/png" } })
      })
      const storage = {
        delete: async () => resultCreate(undefined),
        put: async (input: { readonly key: string }) => {
          uploads.push(input)
          return resultCreate(undefined)
        },
      }
      const importer = pictureImportCreate(database, imageFetcher, storage)

      if (matrixCase.flow === "sign-in") {
        const subject = `signin-${tag}`
        const email = `signin-${tag}@example.com`
        if (matrixCase.initial === "existing") {
          const seed = await callbackRun({
            database,
            port: testPort({ email, providerType: matrixCase.providerType, subject }),
            providerId: provider.id,
            realmId: realm.id,
            runtime: testkit.runtime,
          })
          expect(seed.success).toBe(true)
          if (!seed.success || seed.data.kind !== "authenticated" || seed.data.session === undefined) return
          const userId = seed.data.authentication.userId
          const manual = userProfileUpdate({
            context: realmSystemContextCreate(),
            database,
            input: {},
            picture: { contentType: "image/png", url: manualUrl },
            realmId: realm.id,
            userId,
          })
          expect(manual.success).toBe(true)
          fetchCount = 0
          uploads.length = 0
          const callback = await callbackRun({
            database,
            port: testPort({ email, picture: sourceUrl, providerType: matrixCase.providerType, subject }),
            profilePictureImport: importer,
            providerId: provider.id,
            realmId: realm.id,
            runtime: testkit.runtime,
          })
          expect(callback.success).toBe(true)
          if (!callback.success || callback.data.kind !== "authenticated" || callback.data.session === undefined) return
          expect(sessionAuthenticate({ database, realmId: realm.id, token: callback.data.session.token }).success).toBe(
            true,
          )
          expect(profilePictureUrlGet(database, userId)).toBe(manualUrl)
          expect(fetchCount).toBe(0)
          expect(uploads).toHaveLength(0)
          return
        }
        const callback = await callbackRun({
          database,
          port: testPort({ email, picture: sourceUrl, providerType: matrixCase.providerType, subject }),
          profilePictureImport: importer,
          providerId: provider.id,
          realmId: realm.id,
          runtime: testkit.runtime,
        })
        expect(callback.success).toBe(true)
        if (!callback.success || callback.data.kind !== "authenticated" || callback.data.session === undefined) return
        expect(sessionAuthenticate({ database, realmId: realm.id, token: callback.data.session.token }).success).toBe(
          true,
        )
        expect(profilePictureUrlGet(database, callback.data.authentication.userId)).toContain("assets.authworks")
        expect(fetchCount).toBe(1)
        expect(uploads).toHaveLength(1)
        return
      }

      const baseSubject = `link-base-${tag}`
      const baseLogin = await callbackRun({
        database,
        port: testPort({ email: `link-base-${tag}@example.com`, providerType: "google", subject: baseSubject }),
        providerId: googleProvider.id,
        realmId: realm.id,
        runtime: testkit.runtime,
      })
      expect(baseLogin.success).toBe(true)
      if (!baseLogin.success || baseLogin.data.kind !== "authenticated" || baseLogin.data.session === undefined) return
      const userId = baseLogin.data.authentication.userId
      const session = baseLogin.data.session.session
      expect(sessionAuthenticate({ database, realmId: realm.id, token: baseLogin.data.session.token }).success).toBe(
        true,
      )
      if (matrixCase.initial === "existing") {
        const manual = userProfileUpdate({
          context: realmSystemContextCreate(),
          database,
          input: {},
          picture: { contentType: "image/png", url: manualUrl },
          realmId: realm.id,
          userId,
        })
        expect(manual.success).toBe(true)
      }
      fetchCount = 0
      uploads.length = 0
      const linkSubject = `link-${tag}`
      const linkPortCreate = () =>
        testPort({
          email: `linked-${tag}@example.com`,
          picture: sourceUrl,
          providerType: matrixCase.providerType,
          subject: linkSubject,
        })
      const linkStarted = externalIdentityLinkStart({
        database,
        input: {},
        providerId: provider.id,
        providerPorts: { github: linkPortCreate(), google: linkPortCreate() },
        realmId: realm.id,
        runtime: testkit.runtime,
        session,
        userId,
      })
      expect(linkStarted.success).toBe(true)
      if (!linkStarted.success) return
      const linkState = new URL(linkStarted.data.authorizationUrl).searchParams.get("state") ?? ""
      const linkedCallback = await externalIdentityCallback({
        code: "link-code",
        database,
        profilePictureImport: importer,
        providerId: provider.id,
        providerPorts: { github: linkPortCreate(), google: linkPortCreate() },
        realmId: realm.id,
        runtime: testkit.runtime,
        state: linkState,
      })
      expect(linkedCallback).toMatchObject({ data: { kind: "link_confirmation" }, success: true })
      if (!linkedCallback.success || linkedCallback.data.kind !== "link_confirmation") return
      if (matrixCase.initial === "existing") {
        expect(profilePictureUrlGet(database, userId)).toBe(manualUrl)
        expect(fetchCount).toBe(0)
        expect(uploads).toHaveLength(0)
      } else {
        expect(profilePictureUrlGet(database, userId)).toContain("assets.authworks")
        expect(fetchCount).toBe(1)
        expect(uploads).toHaveLength(1)
      }
      const completed = externalIdentityLinkComplete({
        database,
        input: { confirm: true, confirmationToken: linkedCallback.data.confirmationToken },
        providerId: provider.id,
        realmId: realm.id,
        runtime: testkit.runtime,
        session,
        userId,
      })
      expect(completed.success).toBe(true)
      if (matrixCase.initial === "existing") {
        expect(profilePictureUrlGet(database, userId)).toBe(manualUrl)
        expect(fetchCount).toBe(0)
        expect(uploads).toHaveLength(0)
      } else {
        expect(profilePictureUrlGet(database, userId)).toContain("assets.authworks")
        expect(fetchCount).toBe(1)
        expect(uploads).toHaveLength(1)
      }
    })
  })
}
for (const providerType of ["google", "github"] as const) {
  test(`returning existing ${providerType} sign-in without picture then imports once and preserves hosted picture`, async () => {
    await withDatabase(async (database, testkit) => {
      const tag = `returning-${providerType}`
      const realm = await createRealm(database, `external-picture-${tag}.example.com`)
      const googleProvider = await createProvider(database, realm.id, "google")
      const githubProvider = await createProvider(database, realm.id, "github")
      const provider = providerType === "google" ? googleProvider : githubProvider
      const subject = `returning-${tag}`
      const email = `returning-${tag}@example.com`
      const firstPictureUrl = `https://provider.example/${tag}-first.png`
      const secondPictureUrl = `https://provider.example/${tag}-second.png`
      let fetchCount = 0
      const uploads: { readonly key: string }[] = []
      const imageFetcher = fetchCreate(async () => {
        fetchCount += 1
        return new Response(png, { headers: { "content-type": "image/png" } })
      })
      const storage = {
        delete: async () => resultCreate(undefined),
        put: async (input: { readonly key: string }) => {
          uploads.push(input)
          return resultCreate(undefined)
        },
      }
      const importer = pictureImportCreate(database, imageFetcher, storage)

      const first = await callbackRun({
        database,
        port: testPort({ email, providerType, subject }),
        profilePictureImport: importer,
        providerId: provider.id,
        realmId: realm.id,
        runtime: testkit.runtime,
      })
      expect(first.success).toBe(true)
      if (!first.success || first.data.kind !== "authenticated" || first.data.session === undefined) return
      const userId = first.data.authentication.userId
      const identityId = first.data.identity.id
      expect(sessionAuthenticate({ database, realmId: realm.id, token: first.data.session.token }).success).toBe(true)
      expect(profilePictureUrlGet(database, userId)).toBeNull()
      expect(fetchCount).toBe(0)
      expect(uploads).toHaveLength(0)

      const second = await callbackRun({
        database,
        port: testPort({ email, picture: firstPictureUrl, providerType, subject }),
        profilePictureImport: importer,
        providerId: provider.id,
        realmId: realm.id,
        runtime: testkit.runtime,
      })
      expect(second.success).toBe(true)
      if (!second.success || second.data.kind !== "authenticated" || second.data.session === undefined) return
      expect(second.data.authentication.userId).toBe(userId)
      expect(second.data.identity.id).toBe(identityId)
      expect(sessionAuthenticate({ database, realmId: realm.id, token: second.data.session.token }).success).toBe(true)
      const hosted = profilePictureUrlGet(database, userId)
      expect(hosted).toContain("assets.authworks")
      expect(fetchCount).toBe(1)
      expect(uploads).toHaveLength(1)

      fetchCount = 0
      uploads.length = 0
      const third = await callbackRun({
        database,
        port: testPort({ email, picture: secondPictureUrl, providerType, subject }),
        profilePictureImport: importer,
        providerId: provider.id,
        realmId: realm.id,
        runtime: testkit.runtime,
      })
      expect(third.success).toBe(true)
      if (!third.success || third.data.kind !== "authenticated" || third.data.session === undefined) return
      expect(third.data.authentication.userId).toBe(userId)
      expect(third.data.identity.id).toBe(identityId)
      expect(sessionAuthenticate({ database, realmId: realm.id, token: third.data.session.token }).success).toBe(true)
      expect(profilePictureUrlGet(database, userId)).toBe(hosted)
      expect(fetchCount).toBe(0)
      expect(uploads).toHaveLength(0)
    })
  })
}
test("invalid, oversized, network, and R2 picture failures do not break session issuance", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "external-picture-failures.example.com")
    const provider = await createProvider(database, realm.id, "google")
    const cases: readonly { readonly body?: Uint8Array; readonly network?: boolean; readonly storage?: boolean }[] = [
      { body: Uint8Array.from([1, 2, 3]) },
      { body: new Uint8Array(512 * 1024 + 1) },
      { network: true },
      { storage: true },
    ]
    for (const [index, failure] of cases.entries()) {
      const sourceUrl = `https://provider.example/failure-${index}.png`
      const imageFetcher = fetchCreate(async () => {
        if (failure.network === true) throw new Error("network failure")
        return new Response((failure.body ?? png) as BodyInit, { headers: { "content-type": "image/png" } })
      })
      const storage: R2ObjectStorage = {
        delete: async () => resultCreate(undefined),
        put: async () =>
          failure.storage === true ? resultErrorCreate("test", "storage failed") : resultCreate(undefined),
      }
      const callback = await callbackRun({
        database,
        port: testPort({
          email: `picture-failure-${index}@example.com`,
          picture: sourceUrl,
          providerType: "google",
          subject: `failure-${index}`,
        }),
        profilePictureImport: pictureImportCreate(database, imageFetcher, storage),
        providerId: provider.id,
        realmId: realm.id,
        runtime: testkit.runtime,
      })
      if (!callback.success || callback.data.kind !== "authenticated" || callback.data.session === undefined) {
        expect(callback.success).toBe(true)
        continue
      }
      const token = callback.data.session.token
      if (!callback.success || callback.data.kind !== "authenticated" || callback.data.session === undefined) continue
      expect(token).toBeString()
      expect(sessionAuthenticate({ database, realmId: realm.id, token }).success).toBe(true)
      expect(
        database.db
          .select({ pictureUrl: userProfileTable.pictureUrl })
          .from(userProfileTable)
          .where(eq(userProfileTable.userId, callback.data.authentication.userId))
          .get()?.pictureUrl,
      ).toBeNull()
    }
  })
})

test("provider picture persistence failure leaves candidate cleanup for retry without breaking sign-in", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "external-picture-persistence-failure.example.com")
    const provider = await createProvider(database, realm.id, "google")
    database.sqlite.exec(
      "CREATE TRIGGER provider_picture_persistence_failure BEFORE UPDATE OF picture_url ON user_profiles BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    )
    const deleted: string[] = []
    const storage: R2ObjectStorage = {
      delete: async ({ key }) => {
        deleted.push(key)
        return resultErrorCreate("testR2Delete", "R2 delete failed")
      },
      put: async () => resultCreate(undefined),
    }
    const callback = await callbackRun({
      database,
      port: testPort({
        email: "provider-persistence-failure@example.com",
        picture: "https://provider.example/persistence-failure.png",
        providerType: "google",
        subject: "provider-persistence-failure",
      }),
      profilePictureImport: pictureImportCreate(
        database,
        fetchCreate(async () => new Response(png, { headers: { "content-type": "image/png" } })),
        storage,
      ),
      providerId: provider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(callback.success).toBe(true)
    expect(deleted).toHaveLength(0)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM user_profile_picture_cleanup").get()).toEqual({
      count: 1,
    })
  })
})

test("provider cleanup intent failure skips PUT without breaking sign-in", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "external-picture-intent-failure.example.com")
    const provider = await createProvider(database, realm.id, "google")
    database.sqlite.exec(
      "CREATE TRIGGER provider_picture_cleanup_intent_failure BEFORE INSERT ON user_profile_picture_cleanup BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    )
    let puts = 0
    const callback = await callbackRun({
      database,
      port: testPort({
        email: "provider-intent-failure@example.com",
        picture: "https://provider.example/intent-failure.png",
        providerType: "google",
        subject: "provider-intent-failure",
      }),
      profilePictureImport: pictureImportCreate(
        database,
        fetchCreate(async () => new Response(png, { headers: { "content-type": "image/png" } })),
        {
          delete: async () => resultCreate(undefined),
          put: async () => {
            puts += 1
            return resultCreate(undefined)
          },
        },
      ),
      providerId: provider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(callback.success).toBe(true)
    expect(puts).toBe(0)
  })
})

test("provider picture downloads require HTTPS and bounded redirect responses", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "external-picture-download.example.com")
    const provider = await createProvider(database, realm.id, "google")
    let requests = 0
    const importer = pictureImportCreate(
      database,
      fetchCreate(async (input) => {
        requests += 1
        if (input.toString() === "https://provider.example/start")
          return new Response(null, { headers: { location: "http://provider.example/image" }, status: 302 })
        return new Response(png, { headers: { "content-type": "image/png" } })
      }),
      { delete: async () => resultCreate(undefined), put: async () => resultCreate(undefined) },
    )
    const callback = await callbackRun({
      database,
      port: testPort({
        email: "https-picture@example.com",
        picture: "https://provider.example/start",
        providerType: "google",
        subject: "https-picture",
      }),
      profilePictureImport: importer,
      providerId: provider.id,
      realmId: realm.id,
      runtime: database.runtime,
    })
    expect(callback.success).toBe(true)
    expect(requests).toBe(1)
  })
})
