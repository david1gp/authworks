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

test("successful new, existing, and linking callbacks import missing pictures, preserve existing pictures, and issue sessions", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "external-picture-callback.example.com")
    const googleProvider = await createProvider(database, realm.id, "google")
    const githubProvider = await createProvider(database, realm.id, "github")
    const sourceUrl = "https://provider.example/picture.png"
    let fetchCount = 0
    const imageFetcher = fetchCreate(async () => {
      fetchCount += 1
      return new Response(png, { headers: { "content-type": "image/png" } })
    })
    const uploads: { readonly key: string }[] = []
    const storage = {
      delete: async ({ key }: { readonly key: string }) => resultCreate(undefined),
      put: async (input: { readonly key: string }) => {
        uploads.push(input)
        return resultCreate(undefined)
      },
    }
    const importer = pictureImportCreate(database, imageFetcher, storage)

    const newUser = await callbackRun({
      database,
      port: testPort({ email: "new-picture@example.com", picture: sourceUrl, providerType: "google", subject: "new" }),
      profilePictureImport: importer,
      providerId: googleProvider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(newUser.success).toBe(true)
    if (!newUser.success || newUser.data.kind !== "authenticated" || newUser.data.session === undefined) return
    expect(sessionAuthenticate({ database, realmId: realm.id, token: newUser.data.session.token }).success).toBe(true)
    const newProfile = database.db
      .select()
      .from(userProfileTable)
      .where(eq(userProfileTable.userId, newUser.data.authentication.userId))
      .get()
    expect(newProfile?.pictureContentType).toBe("image/png")
    expect(newProfile?.pictureUrl).toContain("assets.authworks")
    const newPictureUrl = newProfile?.pictureUrl
    expect(uploads).toHaveLength(1)

    const fetchesBeforeOverwrite = fetchCount
    const overwrite = await callbackRun({
      database,
      port: testPort({
        email: "new-picture@example.com",
        picture: "https://provider.example/should-not-be-fetched.png",
        providerType: "google",
        subject: "new",
      }),
      profilePictureImport: importer,
      providerId: googleProvider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(overwrite.success).toBe(true)
    expect(fetchCount).toBe(fetchesBeforeOverwrite)
    expect(
      database.db
        .select({ pictureUrl: userProfileTable.pictureUrl })
        .from(userProfileTable)
        .where(eq(userProfileTable.userId, newUser.data.authentication.userId))
        .get()?.pictureUrl,
    ).toBe(newPictureUrl)

    const existingPort = testPort({
      email: "existing-picture@example.com",
      providerType: "google",
      subject: "existing",
    })
    const existingLogin = await callbackRun({
      database,
      port: existingPort,
      providerId: googleProvider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(existingLogin.success).toBe(true)
    if (
      !existingLogin.success ||
      existingLogin.data.kind !== "authenticated" ||
      existingLogin.data.session === undefined
    )
      return
    const existingUserId = existingLogin.data.authentication.userId
    const existingPortWithPicture = testPort({
      email: "existing-picture@example.com",
      picture: sourceUrl,
      providerType: "google",
      subject: "existing",
    })
    const existingImported = await callbackRun({
      database,
      port: existingPortWithPicture,
      profilePictureImport: importer,
      providerId: googleProvider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(existingImported.success).toBe(true)
    expect(
      database.db
        .select({ pictureUrl: userProfileTable.pictureUrl })
        .from(userProfileTable)
        .where(eq(userProfileTable.userId, existingUserId))
        .get()?.pictureUrl,
    ).toContain("assets.authworks")

    const linkingLoginPort = testPort({
      email: "linking-picture@example.com",
      providerType: "google",
      subject: "linking",
    })
    const linkingLogin = await callbackRun({
      database,
      port: linkingLoginPort,
      providerId: googleProvider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(linkingLogin.success).toBe(true)
    if (!linkingLogin.success || linkingLogin.data.kind !== "authenticated" || linkingLogin.data.session === undefined)
      return
    const linkStarted = externalIdentityLinkStart({
      database,
      input: {},
      providerId: githubProvider.id,
      providerPorts: {
        github: testPort({
          email: "linked-picture@example.com",
          picture: sourceUrl,
          providerType: "github",
          subject: "linked",
        }),
      },
      realmId: realm.id,
      session: linkingLogin.data.session.session,
      userId: linkingLogin.data.authentication.userId,
      runtime: testkit.runtime,
    })
    expect(linkStarted.success).toBe(true)
    if (!linkStarted.success) return
    const linkState = new URL(linkStarted.data.authorizationUrl).searchParams.get("state") ?? ""
    const linkedCallback = await externalIdentityCallback({
      code: "link-code",
      database,
      profilePictureImport: importer,
      providerId: githubProvider.id,
      providerPorts: {
        github: testPort({
          email: "linked-picture@example.com",
          picture: sourceUrl,
          providerType: "github",
          subject: "linked",
        }),
      },
      realmId: realm.id,
      runtime: testkit.runtime,
      state: linkState,
    })
    expect(linkedCallback).toMatchObject({ data: { kind: "link_confirmation" }, success: true })
    expect(
      database.db
        .select({ pictureUrl: userProfileTable.pictureUrl })
        .from(userProfileTable)
        .where(eq(userProfileTable.userId, linkingLogin.data.authentication.userId))
        .get()?.pictureUrl,
    ).toContain("assets.authworks")
    if (!linkedCallback.success || linkedCallback.data.kind !== "link_confirmation") return
    expect(
      externalIdentityLinkComplete({
        database,
        input: { confirm: true, confirmationToken: linkedCallback.data.confirmationToken },
        providerId: githubProvider.id,
        realmId: realm.id,
        session: linkingLogin.data.session.session,
        userId: linkingLogin.data.authentication.userId,
        runtime: testkit.runtime,
      }).success,
    ).toBe(true)
  })
})

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
