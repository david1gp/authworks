import { afterEach, describe, expect, mock, test } from "bun:test"
import { Window } from "happy-dom"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { accountDemoUserFixture } from "./accountDemoUserFixture.js"

const hostedPictureUrl = "https://assets.authworks.contentoren.de/user-pictures/avery.stone_3_9f2c4a.png"
const linkNonce = "nonce-github-1"

let linkCompleteMode: "failure" | "success" = "success"
let popup: { closed: boolean; close: () => void; location: { href: string } } | undefined

const emptyMethods = {
  emailOtp: { available: false },
  passkeys: { credentials: [] },
  password: { available: false },
  recoveryCodes: { available: false, generatedAt: null, remaining: 0 },
  totp: { enrolled: false, enrollments: [] },
}

const githubProvider = {
  allowAccountCreation: true,
  clientId: "client-github",
  createdAt: 1,
  displayName: "GitHub",
  enabled: true,
  id: "github",
  realmId: "realm-1",
  redirectUri: "https://auth.example.com/callback",
  scopes: [],
  type: "github",
  updatedAt: 1,
  version: 1,
}

mock.module("./accountSecurityApiCreate.js", () => ({
  accountSecurityApiCreate: () => ({
    identitiesList: async () => resultCreate({ items: [] }),
    identityLinkComplete: async () =>
      linkCompleteMode === "success"
        ? resultCreate({ linked: true as const })
        : resultErrorCodedCreate(
            "accountSecurityIdentityLinkComplete",
            "The provider rejected the link.",
            "external-identities.invalid",
          ),
    identityLinkStart: async () =>
      resultCreate({
        authorizationUrl: "https://github.example/login",
        callbackOrigin: window.location.origin,
        expiresAt: Date.now() + 600_000,
        messageNonce: linkNonce,
      }),
    identityProvidersList: async () => resultCreate({ items: [githubProvider] }),
    methodsGet: async () => ({ data: emptyMethods, status: "current" as const, success: true as const }),
    passkeyList: async () => resultCreate({ items: [] }),
    userGet: async () => ({
      data: { user: accountDemoUserFixture },
      status: "current" as const,
      success: true as const,
    }),
  }),
}))

const { accountPageStateCreate } = await import("./accountPageStateCreate.js")
const { accountSecurityProductionStateCreate } = await import("./accountSecurityProductionStateCreate.js")
const { accountDemoAdapterCreate } = await import("./accountDemoAdapterCreate.js")
const { createRoot } = await import("solid-js")

type Fixture = ReturnType<typeof fixtureCreate>

const globalValues = globalThis as unknown as Record<string, unknown>
const previousGlobals = new Map<string, unknown>()
const cleanups: (() => void)[] = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  for (const [name, previous] of previousGlobals) {
    if (previous === undefined) delete globalValues[name]
    else globalValues[name] = previous
  }
  previousGlobals.clear()
  popup = undefined
  linkCompleteMode = "success"
})

function profileUserCreate(withPicture: boolean) {
  const base = structuredClone(accountDemoUserFixture)
  if (withPicture)
    return {
      ...base,
      profile: { ...base.profile, picture: { contentType: "image/png", url: hostedPictureUrl } },
    }
  const { picture: _removed, ...profile } = base.profile
  return { ...base, profile }
}

function fixtureCreate() {
  const browserWindow = new Window({ url: "https://auth.example.com/account" })
  previousGlobals.set("document", globalValues.document)
  previousGlobals.set("window", globalValues.window)
  globalValues.document = browserWindow.document
  globalValues.window = browserWindow

  let backendUser = profileUserCreate(false)
  let profileLoads = 0
  let linkedNotifications = 0

  let dispose: (() => void) | undefined
  const states = createRoot((rootDispose) => {
    dispose = rootDispose
    const adapter = accountDemoAdapterCreate(() => "success")
    const profile = accountPageStateCreate({
      adapter: {
        ...adapter,
        loadUser: async () => {
          profileLoads += 1
          return resultCreate({ user: backendUser })
        },
      },
      initialStatus: "ready",
      kind: "overview",
    })
    const security = accountSecurityProductionStateCreate({
      apiBaseUrl: "https://auth.example.com",
      onIdentityLinked: () => {
        linkedNotifications += 1
        void profile.load(true)
      },
      realmId: () => "realm-1",
      screen: () => "overview",
    })
    return { profile, security }
  })
  const browser = browserWindow as unknown as Record<string, unknown>
  browser.open = (() => {
    const next = {
      closed: false,
      close() {
        next.closed = true
      },
      location: { href: "" },
    }
    popup = next
    return next
  }) as unknown

  cleanups.push(() => {
    dispose?.()
  })

  return {
    backendUserSet: (next: ReturnType<typeof profileUserCreate>) => {
      backendUser = next
    },
    browserWindow,
    linkedNotifications: () => linkedNotifications,
    profile: states.profile,
    profileLoads: () => profileLoads,
    security: states.security,
  }
}

function linkConfirmationDispatch(fixture: Fixture) {
  const event = new fixture.browserWindow.MessageEvent("message", {
    data: {
      confirmationToken: "confirmation-token-abc",
      expiresAt: Date.now() + 600_000,
      kind: "link_confirmation",
      messageNonce: linkNonce,
      providerId: "github",
    },
    origin: fixture.browserWindow.location.origin,
  })
  Object.defineProperty(event, "origin", { value: fixture.browserWindow.location.origin })
  Object.defineProperty(event, "source", { value: popup })
  fixture.browserWindow.dispatchEvent(event)
}

async function pictureWaitFor(get: () => string, wanted: string) {
  for (let attempt = 0; attempt < 200 && get() !== wanted; attempt += 1)
    await new Promise((resolve) => setTimeout(resolve, 5))
  return get()
}

describe("workspace identity picture refresh", () => {
  test("refreshes the missing profile picture with the hosted import after successful identity link", async () => {
    const fixture = fixtureCreate()
    await fixture.profile.load(true)
    expect(fixture.profile.pictureUrl.get()).toBe("")
    const loadsBeforeLink = fixture.profileLoads()

    await fixture.security.identityLinkStart("github")
    linkConfirmationDispatch(fixture)
    expect(fixture.security.identityLinkConfirmation()).toBeDefined()

    // The backend imports the GitHub picture while completing the link.
    fixture.backendUserSet(profileUserCreate(true))
    await fixture.security.identityLinkConfirm()
    expect(fixture.linkedNotifications()).toBe(1)
    expect(await pictureWaitFor(() => fixture.profile.pictureUrl.get(), hostedPictureUrl)).toBe(hostedPictureUrl)
    expect(fixture.security.identityLinkConfirmation()).toBeUndefined()
    expect(fixture.security.error()).toBeUndefined()
    expect(fixture.profileLoads()).toBeGreaterThan(loadsBeforeLink)
  })

  test("preserves the missing picture with no profile refresh on failed or cancelled identity link", async () => {
    const fixture = fixtureCreate()
    await fixture.profile.load(true)
    expect(fixture.profile.pictureUrl.get()).toBe("")
    const loadsBeforeLink = fixture.profileLoads()

    linkCompleteMode = "failure"
    await fixture.security.identityLinkStart("github")
    linkConfirmationDispatch(fixture)
    await fixture.security.identityLinkConfirm()
    expect(fixture.security.error()).toBeTruthy()
    expect(fixture.security.identityLinkConfirmation()).toBeDefined()
    expect(fixture.linkedNotifications()).toBe(0)
    expect(fixture.profileLoads()).toBe(loadsBeforeLink)
    expect(fixture.profile.pictureUrl.get()).toBe("")

    // A cancelled link clears the pending confirmation without touching the profile.
    fixture.security.identityLinkCancel()
    expect(fixture.security.identityLinkConfirmation()).toBeUndefined()
    expect(fixture.linkedNotifications()).toBe(0)
    expect(fixture.profileLoads()).toBe(loadsBeforeLink)
    expect(fixture.profile.pictureUrl.get()).toBe("")
  })
})

test("workspace wires profile reload to successful identity links", async () => {
  const source = await Bun.file(new URL("./accountWorkspaceProductionAdapterStateCreate.ts", import.meta.url)).text()
  expect(source).toMatch(/onIdentityLinked:\s*\(\)\s*=>\s*void profile\.load\(true\)/)
})
