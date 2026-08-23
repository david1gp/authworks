import { afterEach, describe, expect, mock, test } from "bun:test"
import { readFileSync } from "node:fs"
import type { DemoFixtureState } from "../../src/features/demo/demoFixtureStateSchema.js"

let mockLocation = { pathname: "/demo/admin/realm", search: "" }
let mockParams: { userId?: string } = {}

mock.module("@solidjs/router", () => ({
  useLocation: () => mockLocation,
  useNavigate: () => () => {},
  useParams: () => mockParams,
}))

mock.module("solid-js", () => ({
  createEffect: (effect: (previous?: unknown) => unknown) => effect(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [
      () => value,
      (next: T | ((previous: T) => T)) => {
        value = typeof next === "function" ? (next as (previous: T) => T)(value) : next
        return value
      },
    ] as const
  },
  on: (dependency: () => unknown, handler: (value: unknown) => unknown) => () => handler(dependency()),
}))

const [{ adminDemoAdapterCreate }, { adminDemoStateCreate }, { i18nStore }, { translationCsvParse }] =
  await Promise.all([
    import("../../src/features/admin/ui/adminDemoAdapterCreate.js"),
    import("../../src/features/admin/ui/adminDemoStateCreate.js"),
    import("../../src/ui/i18n/model/i18nStore.js"),
    import("../../src/ui/i18n/model/translationCsvParse.js"),
  ])

const deParsed = translationCsvParse(readFileSync("public/i18n/de.csv", "utf8"))
const arParsed = translationCsvParse(readFileSync("public/i18n/ar.csv", "utf8"))
const deDictionary = deParsed.success ? deParsed.data : {}
const arDictionary = arParsed.success ? arParsed.data : {}

afterEach(() => {
  i18nStore.language.set("en")
  i18nStore.dictionary.set({})
  mockLocation = { pathname: "/demo/admin/realm", search: "" }
  mockParams = { userId: undefined }
})

const adapterFor = (fixtureState: DemoFixtureState) =>
  adminDemoAdapterCreate(() => fixtureState, { signedInInitially: true })

describe("admin demo adapter", () => {
  test("serves a deterministic realm and administrator session for the success state", async () => {
    const adapter = adapterFor("success")

    const realm = await adapter.realmGet()
    const session = await adapter.sessionCurrent()

    expect(realm.success && realm.data.realm.name).toBe("Northwind customer identity")
    expect(realm.success && realm.data.realm.status).toBe("active")
    expect(session.success && session.data.subjectType).toBe("bootstrap_admin")
  })

  test("applies settings and lifecycle mutations to its local fixture", async () => {
    const adapter = adapterFor("success")

    const renamed = await adapter.realmUpdate({ domains: ["one.example", "two.example"], name: "Renamed realm" })
    const disabled = await adapter.realmUpdate({ status: "disabled" })

    expect(renamed.success && renamed.data.realm.domain).toBe("one.example")
    expect(renamed.success && renamed.data.realm.name).toBe("Renamed realm")
    expect(disabled.success && disabled.data.realm.status).toBe("disabled")
    expect(disabled.success && disabled.data.realm.name).toBe("Renamed realm")
  })

  test("starts the sign-in screen without an administrator session", async () => {
    const adapter = adminDemoAdapterCreate(() => "success")

    expect((await adapter.sessionCurrent()).success).toBe(false)
    expect((await adapter.adminSignIn("c".repeat(40))).success).toBe(true)
    expect((await adapter.sessionCurrent()).success).toBe(true)
  })

  test("rejects short bootstrap credentials and accepts complete ones", async () => {
    const adapter = adapterFor("success")

    expect((await adapter.adminSignIn("too-short")).success).toBe(false)
    expect((await adapter.adminSignIn("b".repeat(40))).success).toBe(true)
  })

  test("exposes error, expiry, and permission fixture states", async () => {
    const failing = await adapterFor("error").realmGet()
    const expired = await adapterFor("expired").sessionCurrent()
    const denied = await adapterFor("permission-denied").realmUpdate({ name: "Nope" })
    const readable = await adapterFor("permission-denied").realmGet()

    expect(failing.success).toBe(false)
    expect(!expired.success && expired.code).toBe("sessions.unauthorized")
    expect(!denied.success && denied.code).toBe("realms.forbidden")
    expect(readable.success).toBe(true)
  })

  test("ends an administrator session without any network access", async () => {
    const result = await adapterFor("success").adminSignOut()

    expect(result.success && result.data.revoked).toBe(true)
  })

  test("serves safe user-security metadata and revokes a fixture session", async () => {
    const adapter = adapterFor("success")

    const methods = await adapter.userAuthenticationMethodsGet("01900000-0000-7000-8000-000000000021")
    const sessions = await adapter.userSessionsList("01900000-0000-7000-8000-000000000021")

    expect(methods.success && methods.data.passkeys.credentials).toHaveLength(1)
    expect(methods.success && JSON.stringify(methods.data)).not.toMatch(/secret|privateKey|recoveryCodes.*codes/i)
    expect(sessions.success && sessions.data.items.map((session) => session.device.description)).toEqual([
      "Firefox on Linux",
      "Safari on iPhone",
    ])

    const sessionId = sessions.success ? sessions.data.items[0]?.id : undefined
    expect(sessionId).toBeDefined()
    if (sessionId === undefined) return
    expect((await adapter.userSessionRevoke("01900000-0000-7000-8000-000000000021", sessionId)).success).toBe(true)
    const remaining = await adapter.userSessionsList("01900000-0000-7000-8000-000000000021")
    expect(remaining.success && remaining.data.items.some((session) => session.id === sessionId)).toBe(false)
  })

  test("provides empty user-security fixtures", async () => {
    const adapter = adapterFor("empty")

    const methods = await adapter.userAuthenticationMethodsGet("user")
    const sessions = await adapter.userSessionsList("user")

    expect(methods.success && methods.data.passkeys.credentials).toEqual([])
    expect(methods.success && methods.data.totp.enrolled).toBe(false)
    expect(sessions.success && sessions.data.items).toEqual([])
  })
})

describe("admin demo scenario reactivity and locale translation", () => {
  const representativePages = [
    {
      expectedArDescKey: "demo.admin.scenario.realm_settings.description",
      expectedArTitleKey: "demo.admin.scenario.realm_settings.title",
      expectedDeDescKey: "demo.admin.scenario.realm_settings.description",
      expectedDeTitleKey: "demo.admin.scenario.realm_settings.title",
      expectedEnDesc: "Manage the current realm name, domains, status, and lifecycle.",
      expectedEnTitle: "General settings",
      params: {},
      pathname: "/demo/admin/realm",
      screen: "realm" as const,
    },
    {
      expectedArDescKey: "demo.admin.scenario.users.description",
      expectedArTitleKey: "demo.admin.scenario.users.title",
      expectedDeDescKey: "demo.admin.scenario.users.description",
      expectedDeTitleKey: "demo.admin.scenario.users.title",
      expectedEnDesc: "Browse and search human users in the current realm.",
      expectedEnTitle: "User directory",
      params: {},
      pathname: "/demo/admin/users",
      screen: "users" as const,
    },
    {
      expectedArDescKey: "demo.admin.scenario.user_detail.description",
      expectedArTitleKey: "demo.admin.scenario.user_detail.title",
      expectedDeDescKey: "demo.admin.scenario.user_detail.description",
      expectedDeTitleKey: "demo.admin.scenario.user_detail.title",
      expectedEnDesc: "Review profile, lifecycle, sessions, and safe authentication metadata.",
      expectedEnTitle: "User detail",
      params: { userId: "01900000-0000-7000-8000-000000000021" },
      pathname: "/demo/admin/users/01900000-0000-7000-8000-000000000021",
      screen: "user-detail" as const,
    },
    {
      expectedArDescKey: "demo.admin.scenario.user_authentication.description",
      expectedArTitleKey: "demo.admin.scenario.user_authentication.title",
      expectedDeDescKey: "demo.admin.scenario.user_authentication.description",
      expectedDeTitleKey: "demo.admin.scenario.user_authentication.title",
      expectedEnDesc: "Review safe factor, passkey, and recovery metadata on user detail.",
      expectedEnTitle: "Authentication methods",
      params: { userId: "01900000-0000-7000-8000-000000000021" },
      pathname: "/demo/admin/users/01900000-0000-7000-8000-000000000021/authentication",
      screen: "user-detail" as const,
    },
    {
      expectedArDescKey: "demo.admin.scenario.user_sessions.description",
      expectedArTitleKey: "demo.admin.scenario.user_sessions.title",
      expectedDeDescKey: "demo.admin.scenario.user_sessions.description",
      expectedDeTitleKey: "demo.admin.scenario.user_sessions.title",
      expectedEnDesc: "Inspect and revoke a user's active browser sessions.",
      expectedEnTitle: "User sessions",
      params: { userId: "01900000-0000-7000-8000-000000000021" },
      pathname: "/demo/admin/users/01900000-0000-7000-8000-000000000021/sessions",
      screen: "user-detail" as const,
    },
    {
      expectedArDescKey: "demo.admin.scenario.audit_events.description",
      expectedArTitleKey: "demo.admin.scenario.audit_events.title",
      expectedDeDescKey: "demo.admin.scenario.audit_events.description",
      expectedDeTitleKey: "demo.admin.scenario.audit_events.title",
      expectedEnDesc: "Browse the current fixture-backed security event stream.",
      expectedEnTitle: "Audit events",
      params: {},
      pathname: "/demo/admin/events",
      screen: "audit-events" as const,
    },
    {
      expectedArDescKey: "demo.admin.scenario.sessions.description",
      expectedArTitleKey: "demo.admin.scenario.sessions.title",
      expectedDeDescKey: "demo.admin.scenario.sessions.description",
      expectedDeTitleKey: "demo.admin.scenario.sessions.title",
      expectedEnDesc: "Review realm sessions with subject and device context.",
      expectedEnTitle: "Sessions",
      params: {},
      pathname: "/demo/admin/sessions",
      screen: "sessions" as const,
    },
    {
      expectedArDescKey: "demo.admin.scenario.admin_sign_in.description",
      expectedArTitleKey: "demo.admin.scenario.admin_sign_in.title",
      expectedDeDescKey: "demo.admin.scenario.admin_sign_in.description",
      expectedDeTitleKey: "demo.admin.scenario.admin_sign_in.title",
      expectedEnDesc: "Exchange a bootstrap credential for a short administrator browser session.",
      expectedEnTitle: "Administrator sign-in",
      params: {},
      pathname: "/demo/admin/sign-in",
      screen: "sign-in" as const,
    },
  ]

  for (const page of representativePages) {
    test(`updates ${page.pathname} (${page.screen}) across locale switches without remount`, () => {
      mockLocation = { pathname: page.pathname, search: "" }
      mockParams = page.params

      // Create state once (simulating mounted component)
      const state = adminDemoStateCreate(() => page.screen)

      // 1. Initial English state
      expect(state.scenarioTitle()).toBe(page.expectedEnTitle)
      expect(state.scenarioDescription()).toBe(page.expectedEnDesc)

      // 2. Switch to German (de) without remounting state
      i18nStore.dictionary.set(deDictionary)
      i18nStore.language.set("de")

      const expectedDeTitle = deDictionary[page.expectedDeTitleKey]
      const expectedDeDesc = deDictionary[page.expectedDeDescKey]
      expect(expectedDeTitle).toBeDefined()
      expect(expectedDeDesc).toBeDefined()
      if (expectedDeTitle === undefined || expectedDeDesc === undefined)
        throw new Error("German translation is missing")
      expect(state.scenarioTitle()).toBe(expectedDeTitle)
      expect(state.scenarioDescription()).toBe(expectedDeDesc)
      // Ensure no raw English remains in German sample
      expect(state.scenarioTitle()).not.toBe(page.expectedEnTitle)
      expect(state.scenarioDescription()).not.toBe(page.expectedEnDesc)

      // 3. Switch to Arabic (ar) without remounting state
      i18nStore.dictionary.set(arDictionary)
      i18nStore.language.set("ar")

      const expectedArTitle = arDictionary[page.expectedArTitleKey]
      const expectedArDesc = arDictionary[page.expectedArDescKey]
      expect(expectedArTitle).toBeDefined()
      expect(expectedArDesc).toBeDefined()
      if (expectedArTitle === undefined || expectedArDesc === undefined)
        throw new Error("Arabic translation is missing")
      expect(state.scenarioTitle()).toBe(expectedArTitle)
      expect(state.scenarioDescription()).toBe(expectedArDesc)
      // Ensure no raw English remains in Arabic sample
      expect(state.scenarioTitle()).not.toBe(page.expectedEnTitle)
      expect(state.scenarioDescription()).not.toBe(page.expectedEnDesc)

      // 4. Switch back to English
      i18nStore.dictionary.set({})
      i18nStore.language.set("en")

      expect(state.scenarioTitle()).toBe(page.expectedEnTitle)
      expect(state.scenarioDescription()).toBe(page.expectedEnDesc)
    })
  }
})
