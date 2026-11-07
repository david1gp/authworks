import { afterAll, expect, mock, test } from "bun:test"
import * as v from "valibot"

// The Solid runtime is not resolvable under the test condition. The mock provides the same
// primitive surface every other UI test relies on so module mocking stays order independent.
mock.module("solid-js", () => ({
  createEffect: (effect: (previous?: unknown) => unknown) => effect(),
  createSignal: <T>(initial: T) => {
    let value = initial
    const get = () => value
    const set = (next: T | ((previous: T) => T)) => {
      value = typeof next === "function" ? (next as (previous: T) => T)(value) : next
      return value
    }
    return [get, set] as const
  },
  on: (dependency: () => unknown, handler: (value: unknown) => unknown) => () => handler(dependency()),
}))

const [
  { englishCatalog },
  { i18nStore },
  { languageApply },
  { languageBrowserPreferenceGet },
  { languageFromTagGet },
  { languageInitialize },
  { languagePreferenceKey },
  { languageResolve },
  { languageSchema },
  { languagesSupported },
  { localeDateFormat },
  { localeNumberFormat },
  { messageTranslate },
  { translationCsvParse },
  { translationPlaceholdersApply },
  { ttc },
] = await Promise.all([
  import("../../src/ui/i18n/model/englishCatalog.js"),
  import("../../src/ui/i18n/model/i18nStore.js"),
  import("../../src/ui/i18n/model/languageApply.js"),
  import("../../src/ui/i18n/model/languageBrowserPreferenceGet.js"),
  import("../../src/ui/i18n/model/languageFromTagGet.js"),
  import("../../src/ui/i18n/model/languageInitialize.js"),
  import("../../src/ui/i18n/model/languagePreferenceKey.js"),
  import("../../src/ui/i18n/model/languageResolve.js"),
  import("../../src/ui/i18n/model/languageSchema.js"),
  import("../../src/ui/i18n/model/languagesSupported.js"),
  import("../../src/ui/i18n/model/localeDateFormat.js"),
  import("../../src/ui/i18n/model/localeNumberFormat.js"),
  import("../../src/ui/i18n/model/messageTranslate.js"),
  import("../../src/ui/i18n/model/translationCsvParse.js"),
  import("../../src/ui/i18n/model/translationPlaceholdersApply.js"),
  import("../../src/ui/i18n/model/ttc.js"),
])

// The i18n store is global module state; restore the English default so file order never leaks.
afterAll(() => {
  i18nStore.language.set("en")
  i18nStore.dictionary.set({})
})

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>()

  get length(): number {
    return this.#values.size
  }

  clear(): void {
    this.#values.clear()
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.#values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value)
  }
}

type BrowserWindowOptions = {
  readonly storage?: Storage
  readonly languages?: readonly string[]
  readonly csv?: string
}

function browserWindowCreate(options: BrowserWindowOptions = {}): Window {
  const documentElement = { dir: "", lang: "" } as HTMLElement
  const storage = options.storage ?? new MemoryStorage()
  const csv = options.csv ?? "key,ar\ncommon.continue,متابعة\n"
  const browserWindow = {
    document: { documentElement },
    fetch: async () => new Response(csv, { headers: { "content-type": "text/csv" } }),
    localStorage: storage,
    navigator: {
      language: options.languages?.[0] ?? "en-US",
      languages: options.languages ?? ["en-US"],
    },
  }
  return browserWindow as unknown as Window
}

test("locale schema and metadata cover 15 locales and Arabic is RTL", () => {
  expect(languagesSupported).toHaveLength(15)
  expect(languagesSupported.at(-1)).toMatchObject({ code: "ar", dir: "rtl" })
  for (const option of languagesSupported) expect(v.safeParse(languageSchema, option.code).success).toBe(true)
})

test("browser tags and persisted preferences resolve safely", () => {
  expect(languageFromTagGet("de-CH")).toBe("de")
  expect(languageFromTagGet("unsupported")).toBeUndefined()
  expect(languageBrowserPreferenceGet(["xx-YY", "ar-EG"])).toBe("ar")

  const storage = new MemoryStorage()
  storage.setItem(languagePreferenceKey, "fr")
  expect(languageResolve(storage, ["ar-EG"])).toBe("fr")
  storage.setItem(languagePreferenceKey, "not-supported")
  expect(languageResolve(storage, ["ar-EG"])).toBe("ar")
  expect(storage.getItem(languagePreferenceKey)).toBeNull()
})

test("CSV catalogs support quoted fields, stable keys, and malformed input", () => {
  const parsed = translationCsvParse('key,de\n"common.continue","Weiter, bitte"\n"common.note","Line 1\nLine 2"\n')
  expect(parsed).toEqual({
    data: {
      "common.continue": "Weiter, bitte",
      "common.note": "Line 1\nLine 2",
    },
    success: true,
  })
  expect(translationCsvParse('english,de\n"Broken\n').success).toBe(false)
  expect(translationCsvParse("wrong,de\nvalue,translation\n").success).toBe(false)
})

test("non-English catalogs contain only typed Authworks messages with matching placeholders", async () => {
  const catalogKeys = Object.keys(englishCatalog).sort()
  for (const option of languagesSupported.filter((entry) => entry.code !== "en")) {
    const csv = await Bun.file(new URL(`../../public/i18n/${option.code}.csv`, import.meta.url)).text()
    const parsed = translationCsvParse(csv)
    expect(parsed.success).toBe(true)
    if (!parsed.success) continue

    expect(Object.keys(parsed.data).sort()).toEqual(catalogKeys)
    expect(csv).not.toMatch(/\b(?:SMS|U2F|ZITADEL)\b/)
    for (const key of catalogKeys) {
      expect(parsed.data[key]).toBeTruthy()
      expect(translationPlaceholdersGet(parsed.data[key] ?? "")).toEqual(
        translationPlaceholdersGet(englishCatalog[key as keyof typeof englishCatalog]),
      )
    }
  }
})

test("translation falls back to English and replaces both placeholder styles", () => {
  i18nStore.language.set("de")
  i18nStore.dictionary.set({ Continue: "Weiter" })
  expect(messageTranslate("common.cancel")).toBe("Cancel")
  expect(ttc("Continue")).toBe("Weiter")
  expect(translationPlaceholdersApply("{missing} [X]", ["value"])).toBe("{missing} value")
})

test("a partial loaded catalog falls back per typed key", () => {
  i18nStore.language.set("fr")
  i18nStore.dictionary.set({ "common.language": "Langue" })
  expect(messageTranslate("common.language")).toBe("Langue")
  expect(messageTranslate("common.save")).toBe("Save")
})

test("locale application is reactive, loads catalogs, and applies Arabic direction", async () => {
  const browserWindow = browserWindowCreate({ csv: "key,ar\ncommon.continue,متابعة\n" })
  await languageApply("ar", browserWindow)
  expect(browserWindow.document.documentElement.lang).toBe("ar")
  expect(browserWindow.document.documentElement.dir).toBe("rtl")
  expect(i18nStore.language.get()).toBe("ar")
  expect(messageTranslate("common.continue")).toBe("متابعة")

  await languageApply("en", browserWindow)
  expect(browserWindow.document.documentElement.dir).toBe("ltr")
  expect(messageTranslate("common.continue")).toBe("Continue")
})

test("bootstrap prefers persisted locale and Intl formatting follows the active locale", async () => {
  const storage = new MemoryStorage()
  storage.setItem(languagePreferenceKey, "de")
  const browserWindow = browserWindowCreate({ storage, languages: ["ar-EG"], csv: "key,de\n" })
  await languageInitialize(browserWindow)
  expect(i18nStore.language.get()).toBe("de")
  expect(localeNumberFormat(1234567.89)).toBe(new Intl.NumberFormat("de").format(1234567.89))
  expect(localeDateFormat(0, { timeZone: "UTC", dateStyle: "medium" })).toBe(
    new Intl.DateTimeFormat("de", { timeZone: "UTC", dateStyle: "medium" }).format(0),
  )
})

test("German login description renders translated instead of fallback English", async () => {
  const deCsv = await Bun.file(new URL("../../public/i18n/de.csv", import.meta.url)).text()
  const parsed = translationCsvParse(deCsv)
  expect(parsed.success).toBe(true)
  if (!parsed.success) return

  i18nStore.language.set("de")
  i18nStore.dictionary.set(parsed.data)

  expect(messageTranslate("login.status.unavailableDescription")).toBe(
    "Diese Anmeldeanfrage kann nicht abgeschlossen werden. Kehren Sie zur Anwendung zurück und versuchen Sie es erneut.",
  )
  expect(messageTranslate("login.status.unavailableTitle")).toBe("Anmeldung nicht verfügbar")
})

test("Arabic account-session labels, guard, and navigation text render translated rather than fallback English", async () => {
  const arCsv = await Bun.file(new URL("../../public/i18n/ar.csv", import.meta.url)).text()
  const parsed = translationCsvParse(arCsv)
  expect(parsed.success).toBe(true)
  if (!parsed.success) return

  i18nStore.language.set("ar")
  i18nStore.dictionary.set(parsed.data)

  // Account session labels
  expect(messageTranslate("account.sessionExpired")).toBe("انتهت صلاحية جلستك")
  expect(messageTranslate("account.sessions.current")).toBe("الجلسة الحالية")
  expect(messageTranslate("account.sessions.description")).toBe(
    "راجع الأجهزة التي تم تسجيل الدخول إلى حسابك منها، وقم بإلغاء أي جلسة لا تتعرف عليها.",
  )
  expect(messageTranslate("account.sessions.empty")).toBe("لا توجد جلسات نشطة")
  expect(messageTranslate("account.sessions.lastUsed", { date: "اليوم" })).toBe("آخر استخدام في اليوم")
  expect(messageTranslate("account.sessions.revoke")).toBe("إلغاء الجلسة")
  expect(messageTranslate("account.sessions.unknownDevice")).toBe("جهاز غير معروف")
  expect(messageTranslate("account.status.available")).toBe("متاح")
  expect(messageTranslate("account.status.configured")).toBe("تمت التهيئة")
  expect(messageTranslate("account.status.notConfigured")).toBe("غير مهيأ")
  expect(messageTranslate("account.status.unavailable")).toBe("غير متاح")

  // Guard text by typed key
  expect(messageTranslate("shell.guard.signInRequired")).toBe("تسجيل الدخول مطلوب")
  expect(messageTranslate("shell.guard.signInRequiredDetail")).toBe("سجل الدخول للمتابعة إلى هذه الوجهة.")
  expect(messageTranslate("shell.guard.contextRequired")).toBe("السياق مطلوب")
  expect(messageTranslate("shell.guard.contextRequiredDetail")).toBe("اختر النطاق أو المنظمة المطلوبة قبل المتابعة.")
  expect(messageTranslate("shell.guard.destinationUnavailable")).toBe("الوجهة غير متاحة")
  expect(messageTranslate("shell.guard.destinationUnavailableDetail")).toBe("الوجهة المطلوبة ليست جزءاً من هذا التطبيق.")
  expect(messageTranslate("shell.guard.pageNotFound")).toBe("الصفحة غير موجودة")
  expect(messageTranslate("shell.guard.accessUnavailable")).toBe("الوصول غير متاح")

  // Navigation text by typed key
  expect(messageTranslate("shell.nav.security")).toBe("الأمان")
  expect(messageTranslate("shell.nav.access")).toBe("الوصول")
  expect(messageTranslate("shell.nav.applications")).toBe("التطبيقات")
  expect(messageTranslate("shell.nav.sessionsDevices")).toBe("الجلسات والأجهزة")
  expect(messageTranslate("login.signedIn.title")).toBe("تم تسجيل الدخول")
  expect(messageTranslate("common.signOut")).toBe("تسجيل الخروج")
  expect(messageTranslate("shell.nav.chooseDestination")).toBe("اختر وجهة")
  expect(messageTranslate("shell.nav.navigationTitle", { title: messageTranslate("shell.nav.account") })).toBe(
    "تنقل الحساب",
  )
})

test("duplicate English catalog values resolve by the intended key rather than a reverse lookup", async () => {
  const deCsv = await Bun.file(new URL("../../public/i18n/de.csv", import.meta.url)).text()
  const parsed = translationCsvParse(deCsv)
  expect(parsed.success).toBe(true)
  if (!parsed.success) return

  i18nStore.language.set("de")
  i18nStore.dictionary.set(parsed.data)

  // Each pair shares one English source value but must translate through its own key.
  const duplicates = [
    ["shell.nav.password", "login.password.label"],
    ["shell.nav.passkeys", "account.factors.passkeys"],
    ["shell.nav.applicationConsents", "admin.oidc.consents.title"],
  ] as const

  for (const [shellKey, featureKey] of duplicates) {
    expect(englishCatalog[shellKey]).toBe(englishCatalog[featureKey])
    expect(messageTranslate(shellKey)).toBe(parsed.data[shellKey] as string)
    expect(messageTranslate(shellKey)).not.toBe(englishCatalog[shellKey])
  }

  // "Impersonation" previously fell back to English through the reverse map.
  expect(messageTranslate("shell.nav.impersonation")).toBe("Identitätsübernahme")

  i18nStore.language.set("en")
  i18nStore.dictionary.set({})
})

// Locale/key pairs whose correct translation is spelled exactly like the English word.
// Task 5 translators kept these identical deliberately: each is a valid cognate,
// standard tech loanword, acronym, or proper noun in that language.
const identicalWordTranslations = new Set([
  ...languagesSupported.filter((entry) => entry.code !== "en").map((entry) => `${entry.code}/shell.nav.oidcGroup`),
  ...languagesSupported.filter((entry) => entry.code !== "en").map((entry) => `${entry.code}/shell.nav.whatsapp`),
  "de/common.theme.system",
  "pl/common.theme.system",
  "es/demo.fixture.error",
  "it/demo.fixture.crossTenant",
  "nl/demo.fixture.crossTenant",
  "de/demo.nav.label",
  "es/demo.nav.label",
  "it/demo.nav.label",
  "nl/demo.nav.label",
  "pl/demo.nav.label",
  "pt/demo.nav.label",
  "tr/demo.nav.label",
  // "Authenticator" is also the natural German term for this credential.
  "de/account.factors.authenticator",
  "de/account.factors.passkeys",
  "de/account.securityHistory.category.passkeys",
  "de/account.securityOverview.passkeys",
  "de/admin.events.systemActor",
  "de/admin.impersonation.actor",
  "de/admin.machine.credentials.name",
  "de/admin.machine.credentials.scopes",
  "de/admin.machine.status",
  "de/admin.machine.users.scopes",
  "de/admin.navigation.label",
  "de/admin.oidc.consents.user",
  "de/admin.oidc.documents.jwksTitle",
  "de/admin.oidc.status",
  "de/admin.organizations.detail.realm",
  "de/admin.organizations.policy.factor.passkey",
  "de/admin.organizations.policy.passkey",
  "de/admin.organizations.providers.scopes",
  "de/admin.organizations.status",
  "de/admin.projects.status",
  "de/admin.realm.domains",
  "de/admin.realm.status",
  "de/admin.users.lifecycle.initial",
  "de/admin.users.sessions.region",
  "de/admin.whatsapp.status",
  "de/demo.account.scenario.passkeys.title",
  "de/demo.admin.group.realm.title",
  "de/demo.admin.scenario.branding.title",
  "de/ui.authenticated.demo.avatarTitle",
  "de/ui.authenticated.demo.chipsTitle",
  "de/ui.authenticated.demo.profileName",
  "de/ui.authenticated.demo.tabsTitle",
  "es/account.access.roles",
  "es/admin.activity.actor",
  "es/admin.events.actor",
  "es/admin.organizations.detail.realm",
  "es/admin.organizations.memberships.roles",
  "es/admin.projects.detail.rolesTab",
  "es/admin.redesign.tokens",
  "es/admin.userProfile.membershipRoles",
  "es/admin.whatsapp.endpoint",
  "es/demo.admin.group.realm.title",
  "es/ui.authenticated.demo.avatarTitle",
  "es/ui.authenticated.demo.profileName",
  "fr/account.securityHistory.category.sessions",
  "fr/admin.impersonation.durationMinutes",
  "fr/admin.navigation.label",
  "fr/admin.oidc.clients.application",
  "fr/admin.oidc.clients.consentOptions",
  "fr/admin.oidc.clients.typePublic",
  "fr/admin.oidc.consents.client",
  "fr/admin.organizations.detail.realm",
  "fr/admin.organizations.invitations.title",
  "fr/admin.projects.applications.title",
  "fr/admin.projects.detail.applicationsTab",
  "fr/admin.redesign.actions",
  "fr/admin.redesign.documents",
  "fr/admin.users.directorySubtitleInvitations",
  "fr/admin.users.directorySubtitleInvitationsOne",
  "fr/admin.users.lifecycle.initial",
  "fr/common.pagination",
  "fr/demo.admin.scenario.applications.title",
  "fr/demo.admin.scenario.invitations.title",
  "fr/demo.admin.scenario.sessions.title",
  "fr/demo.consent.clientId",
  "fr/demo.nav.compact",
  "fr/oidc.consent.clientId",
  "fr/ui.authenticated.demo.avatarTitle",
  "fr/ui.authenticated.demo.profileName",
  "hu/admin.oidc.documents.jwksUri",
  "hu/admin.organizations.policy.factor.passkey",
  "hu/admin.organizations.policy.passkey",
  "hu/ui.authenticated.demo.avatarTitle",
  "hu/ui.authenticated.demo.profileName",
  "it/account.access.email",
  "it/account.securityOverview.email",
  "it/account.securityOverview.password",
  "it/admin.events.payload",
  "it/admin.organizations.detail.realm",
  "it/admin.organizations.policy.factor.passkey",
  "it/admin.organizations.policy.password",
  "it/admin.organizations.providers.type",
  "it/admin.users.nickName",
  "it/admin.whatsapp.endpoint",
  "it/demo.account.scenario.password.title",
  "it/demo.admin.group.realm.title",
  "it/demo.nav.account",
  "it/ui.authenticated.demo.avatarTitle",
  "it/ui.authenticated.demo.profileName",
  "ja/admin.oidc.documents.jwksUri",
  "nl/account.factors.passkeyCount",
  "nl/account.factors.passkeys",
  "nl/account.profile.gender.man",
  "nl/account.refreshTokens.scopeCount",
  "nl/account.security.authenticators",
  "nl/account.securityHistory.category.passkeys",
  "nl/account.securityOverview.passkeys",
  "nl/admin.activity.actor",
  "nl/admin.events.actor",
  "nl/admin.events.payload",
  "nl/admin.machine.credentials.scopes",
  "nl/admin.machine.status",
  "nl/admin.machine.users.scopes",
  "nl/admin.oidc.clients.project",
  "nl/admin.oidc.documents.jwksTitle",
  "nl/admin.oidc.status",
  "nl/admin.organizations.detail.realm",
  "nl/admin.organizations.policy.factor.passkey",
  "nl/admin.organizations.policy.passkey",
  "nl/admin.organizations.providers.scopes",
  "nl/admin.organizations.providers.type",
  "nl/admin.organizations.status",
  "nl/admin.projects.status",
  "nl/admin.realm.status",
  "nl/admin.redesign.tokens",
  "nl/admin.whatsapp.endpoint",
  "nl/admin.whatsapp.status",
  "nl/demo.account.scenario.passkeys.title",
  "nl/demo.admin.group.realm.title",
  "nl/demo.nav.account",
  "nl/demo.nav.compact",
  "nl/ui.authenticated.demo.avatarTitle",
  "nl/ui.authenticated.demo.chipsTitle",
  "nl/ui.authenticated.demo.profileName",
  "nl/ui.authenticated.demo.tabsTitle",
  "pl/admin.events.systemActor",
  "pl/admin.impersonation.actor",
  "pl/admin.organizations.detail.realm",
  "pl/admin.users.sessions.region",
  "pl/admin.whatsapp.status",
  "pl/demo.admin.group.realm.title",
  "pl/demo.admin.scenario.branding.title",
  "pl/ui.authenticated.demo.profileName",
  "pt/account.factors.passkeyCount",
  "pt/account.factors.passkeys",
  "pt/account.securityHistory.category.passkeys",
  "pt/account.securityOverview.passkeys",
  "pt/admin.events.payload",
  "pt/admin.organizations.detail.realm",
  "pt/admin.organizations.policy.factor.passkey",
  "pt/admin.organizations.policy.passkey",
  "pt/admin.redesign.tokens",
  "pt/admin.whatsapp.endpoint",
  "pt/demo.account.scenario.passkeys.title",
  "pt/demo.admin.group.realm.title",
  "pt/ui.authenticated.demo.avatarTitle",
  "pt/ui.authenticated.demo.profileName",
  "ru/admin.organizations.detail.realm",
  "tr/ui.authenticated.demo.avatarTitle",
  "tr/ui.authenticated.demo.profileName",
  "uk/admin.organizations.detail.realm",
  "zh/admin.oidc.documents.jwksUri",
])

// Keys introduced with the production shell, guard, confirmation, and fixture-state work.
const shellAndProductionKeys = [
  ...Object.keys(englishCatalog).filter(
    (key) =>
      key.startsWith("shell.") ||
      key.startsWith("demo.fixture.") ||
      key.startsWith("demo.directory.") ||
      key.startsWith("demo.placeholder."),
  ),
  "admin.common.confirmTitle",
  "admin.oidc.confirmTitle",
  "admin.users.createdAt",
  "app.tagline",
  "common.disable",
  "common.disabled",
  "common.enable",
  "common.enabled",
  "common.theme.dark",
  "common.theme.light",
  "common.theme.system",
  "demo.account.title",
]

test("every production shell, guard, confirmation and fixture catalog key is translated in all non-English locales", async () => {
  // "app.name" is a brand name and stays untranslated; the tagline is visible shell chrome.
  expect(shellAndProductionKeys.length).toBeGreaterThan(0)
  for (const key of shellAndProductionKeys) expect(Object.hasOwn(englishCatalog, key), key).toBe(true)

  for (const option of languagesSupported.filter((entry) => entry.code !== "en")) {
    const parsed = translationCsvParse(
      await Bun.file(new URL(`../../public/i18n/${option.code}.csv`, import.meta.url)).text(),
    )
    expect(parsed.success).toBe(true)
    if (!parsed.success) continue

    for (const key of shellAndProductionKeys) {
      const translated = parsed.data[key]
      expect(translated, `${option.code}/${key}`).toBeTruthy()
      expect(translationPlaceholdersGet(translated ?? ""), `${option.code}/${key}`).toEqual(
        translationPlaceholdersGet(englishCatalog[key as keyof typeof englishCatalog]),
      )
      if (identicalWordTranslations.has(`${option.code}/${key}`)) continue
      expect(translated, `${option.code}/${key} must not be an English copy`).not.toBe(
        englishCatalog[key as keyof typeof englishCatalog],
      )
    }
  }
})

// Validation and fixture-error keys introduced with the administration UI state migration.
const stateValidationKeys = [
  "admin.machine.credentials.expiryInvalid",
  "admin.machine.credentials.expiryPast",
  "admin.machine.credentials.nameRequired",
  "admin.machine.users.invalid",
  "admin.oidc.clients.invalid",
  "admin.organizations.domains.invalid",
  "admin.organizations.invitations.emailInvalid",
  "admin.organizations.invitations.rolesInvalid",
  "admin.organizations.list.nameRequired",
  "admin.organizations.memberships.invalid",
  "admin.organizations.providers.invalid",
  "admin.projects.applications.invalid",
  "admin.projects.list.invalid",
  "demo.fixture.accountError",
] as const

test("administration state validation and fixture-error keys are translated in every non-English locale", async () => {
  for (const key of stateValidationKeys) expect(Object.hasOwn(englishCatalog, key), key).toBe(true)

  for (const option of languagesSupported.filter((entry) => entry.code !== "en")) {
    const parsed = translationCsvParse(
      await Bun.file(new URL(`../../public/i18n/${option.code}.csv`, import.meta.url)).text(),
    )
    expect(parsed.success).toBe(true)
    if (!parsed.success) continue

    for (const key of stateValidationKeys) {
      const translated = parsed.data[key]
      expect(translated, `${option.code}/${key}`).toBeTruthy()
      expect(translated, `${option.code}/${key} must not be an English copy`).not.toBe(englishCatalog[key])
      expect(translationPlaceholdersGet(translated ?? ""), `${option.code}/${key}`).toEqual(
        translationPlaceholdersGet(englishCatalog[key]),
      )
    }
  }
})

const accountOrganizationAccessKeys = [
  "account.access.organizationCount",
  "account.access.organizationCountOne",
  "account.access.organizationDescription",
  "account.access.organizationSelector",
] as const

test("organization viewing labels are localized in every maintained catalog", async () => {
  for (const key of accountOrganizationAccessKeys) expect(Object.hasOwn(englishCatalog, key), key).toBe(true)

  for (const option of languagesSupported.filter((entry) => entry.code !== "en")) {
    const parsed = translationCsvParse(
      await Bun.file(new URL(`../../public/i18n/${option.code}.csv`, import.meta.url)).text(),
    )
    expect(parsed.success).toBe(true)
    if (!parsed.success) continue

    for (const key of accountOrganizationAccessKeys) {
      expect(parsed.data[key], `${option.code}/${key}`).toBeTruthy()
      expect(parsed.data[key], `${option.code}/${key} must not be an English copy`).not.toBe(englishCatalog[key])
      expect(translationPlaceholdersGet(parsed.data[key] ?? ""), `${option.code}/${key}`).toEqual(
        translationPlaceholdersGet(englishCatalog[key]),
      )
    }
  }
})

const accountOverviewDialogKeys = [
  "account.profile.edit",
  "account.profile.cancel",
  "account.profile.notSet",
  "account.profile.picturePreview",
  "account.workspace.devicesTitle",
] as const

test("account overview and dialog labels are translated in every non-English catalog", async () => {
  for (const key of accountOverviewDialogKeys) expect(Object.hasOwn(englishCatalog, key), key).toBe(true)

  for (const option of languagesSupported.filter((entry) => entry.code !== "en")) {
    const parsed = translationCsvParse(
      await Bun.file(new URL(`../../public/i18n/${option.code}.csv`, import.meta.url)).text(),
    )
    expect(parsed.success).toBe(true)
    if (!parsed.success) continue

    for (const key of accountOverviewDialogKeys) {
      const translated = parsed.data[key]
      expect(translated, `${option.code}/${key}`).toBeTruthy()
      expect(translated, `${option.code}/${key} must not be an English copy`).not.toBe(englishCatalog[key])
      expect(translationPlaceholdersGet(translated ?? ""), `${option.code}/${key}`).toEqual(
        translationPlaceholdersGet(englishCatalog[key]),
      )
    }
  }
})

const accountRedesignKeys = [
  "account.factors.authenticator",
  "account.factors.configured",
  "account.factors.count",
  "account.factors.missing",
  "account.passkeys.manage",
  "account.profile.copy",
  "account.profile.copied",
  "account.profile.copyFailed",
  "account.profile.emailMissing",
  "account.profile.emailDescription",
  "account.refreshTokens.activeShown",
  "account.refreshTokens.countOneShown",
  "account.refreshTokens.countShown",
  "account.refreshTokens.loadMore",
  "account.refreshTokens.manage",
  "account.refreshTokens.noneActive",
  "account.securityHistory.countOneShown",
  "account.securityHistory.countShown",
  "account.sessions.count",
  "account.sessions.countOne",
  "account.sessions.manage",
] as const

test("compact account redesign messages are localized without falling back to English", async () => {
  for (const option of languagesSupported.filter((entry) => entry.code !== "en")) {
    const parsed = translationCsvParse(
      await Bun.file(new URL(`../../public/i18n/${option.code}.csv`, import.meta.url)).text(),
    )
    expect(parsed.success).toBe(true)
    if (!parsed.success) continue

    for (const key of accountRedesignKeys) {
      const translated = parsed.data[key]
      expect(translated, `${option.code}/${key}`).toBeTruthy()
      expect(translationPlaceholdersGet(translated ?? ""), `${option.code}/${key}`).toEqual(
        translationPlaceholdersGet(englishCatalog[key]),
      )
      // "Authenticator" is also the natural German term for this credential.
      if (option.code === "de" && key === "account.factors.authenticator") continue
      expect(translated, `${option.code}/${key} must not be an English copy`).not.toBe(englishCatalog[key])
    }
  }
})

test("administration state validation keys render translated German and Arabic text", async () => {
  for (const locale of ["de", "ar"] as const) {
    const parsed = translationCsvParse(
      await Bun.file(new URL(`../../public/i18n/${locale}.csv`, import.meta.url)).text(),
    )
    expect(parsed.success).toBe(true)
    if (!parsed.success) continue

    i18nStore.language.set(locale)
    i18nStore.dictionary.set(parsed.data)
    for (const key of stateValidationKeys) {
      expect(messageTranslate(key), `${locale}/${key}`).toBe(parsed.data[key] as string)
    }
  }

  expect(messageTranslate("admin.oidc.clients.invalid")).toBe(
    "أدخل اسم عميل، ومعرّف URI واحداً على الأقل لإعادة التوجيه المطابق تماماً، ونطاقاً واحداً على الأقل.",
  )

  i18nStore.language.set("en")
  i18nStore.dictionary.set({})
  expect(messageTranslate("admin.organizations.list.nameRequired")).toBe("Enter an organization name.")
})

const intentionalIdenticalLoginTranslations = new Set([
  "de/demo.login.scenario.passkey.title",
  "de/login.chooser.passkeyLabel",
  "de/login.mfa.passkey",
  "es/demo.fixture.error",
  "hu/demo.login.scenario.passkey.title",
  "hu/login.chooser.passkeyLabel",
  "hu/login.mfa.passkey",
  "it/demo.fixture.crossTenant",
  "it/demo.login.scenario.password.title",
  "it/demo.login.scenario.passkey.title",
  "it/login.chooser.passwordLabel",
  "it/login.password.label",
  "nl/demo.fixture.crossTenant",
  "nl/demo.login.scenario.passkey.title",
  "pt/demo.login.scenario.passkey.title",
])

test("login and demo catalogs do not leak new English source literals", async () => {
  const loginKeys = Object.keys(englishCatalog).filter(
    (key) => key.startsWith("login.") || key.startsWith("demo.login.") || key.startsWith("demo.fixture."),
  )
  for (const option of languagesSupported.filter((entry) => entry.code !== "en")) {
    const parsed = translationCsvParse(
      await Bun.file(new URL(`../../public/i18n/${option.code}.csv`, import.meta.url)).text(),
    )
    expect(parsed.success).toBe(true)
    if (!parsed.success) continue
    for (const key of loginKeys) {
      if (intentionalIdenticalLoginTranslations.has(`${option.code}/${key}`)) continue
      expect(parsed.data[key], `${option.code}/${key}`).not.toBe(englishCatalog[key as keyof typeof englishCatalog])
    }
  }
})

// Catalog keys whose value is legitimately identical to English in every locale.
// Source: /tmp/i18n-todo/allowlist.json from the Task 4 inventory; each entry keeps its reason.
const identicalAllowlist: readonly string[] = [
  // Brand/product name, never translated.
  "app.name",
  // Pan-locale acronym for identifier.
  "admin.redesign.id",
  // Pan-locale acronym for Internet Protocol.
  "admin.redesign.ip",
  // OpenID Connect acronym, identical in all 14 locales.
  "shell.nav.oidcGroup",
  // Official protocol/standard name (proper noun).
  "demo.admin.group.oidc.title",
  // Placeholder-only string, no translatable text.
  "account.sessions.deviceLabelBrowser",
  // Placeholder-only string, no translatable text.
  "account.sessions.deviceLabelOs",
  // Pure time-format string, no words.
  "admin.impersonation.remainingValue",
  // SI unit symbol for seconds (input suffix next to seconds-lifetime fields); identical by standard.
  "admin.redesign.s",
  // E.164 example phone number, not prose.
  "account.profile.phonePlaceholder",
  // RFC 2606 example domain used as an input placeholder.
  "admin.organizations.domains.placeholder",
  // URL scheme prefix, not prose.
  "common.urlPlaceholder",
  // Em-dash placeholder for a missing sender, not prose; identical in every locale.
  "admin.whatsapp.noSender",
  // Placeholder-only quota-bar template with no translatable words.
  "admin.whatsapp.quotaBarLabel",
]

test("no catalog cell copies English outside the allowlist and identical-word sets", async () => {
  const allowedIdentical = new Set([...identicalWordTranslations, ...intentionalIdenticalLoginTranslations])
  const catalogKeys = Object.keys(englishCatalog)
  for (const option of languagesSupported.filter((entry) => entry.code !== "en")) {
    const parsed = translationCsvParse(
      await Bun.file(new URL(`../../public/i18n/${option.code}.csv`, import.meta.url)).text(),
    )
    expect(parsed.success).toBe(true)
    if (!parsed.success) continue

    for (const key of catalogKeys) {
      if (identicalAllowlist.includes(key)) continue
      if (allowedIdentical.has(`${option.code}/${key}`)) continue
      expect(parsed.data[key], `${option.code}/${key} must not be an English copy`).not.toBe(
        englishCatalog[key as keyof typeof englishCatalog],
      )
    }
  }
})

function translationPlaceholdersGet(value: string): string[] {
  return [...value.matchAll(/\{[^}]+\}/g)].map(([placeholder]) => placeholder).sort()
}

test("a failed catalog load restores the previous locale instead of stranding English text", async () => {
  i18nStore.language.set("en")
  i18nStore.dictionary.set({})
  const browserWindow = browserWindowCreate({ csv: "key,ar\ncommon.continue,متابعة\n" })
  const workingFetch = browserWindow.fetch.bind(browserWindow)
  let mode: "working" | "rejected" | "missing" = "working"
  browserWindow.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (mode === "rejected") return Promise.reject(new Error("catalog unavailable"))
    if (mode === "missing") return Promise.resolve(new Response("not found", { status: 404 }))
    return workingFetch(input, init)
  }) as typeof fetch

  await languageApply("ar", browserWindow)
  expect(i18nStore.language.get()).toBe("ar")
  expect(messageTranslate("common.continue")).toBe("متابعة")

  mode = "rejected"
  await languageApply("fr", browserWindow)
  expect(i18nStore.language.get()).toBe("ar")
  expect(messageTranslate("common.continue")).toBe("متابعة")
  expect(browserWindow.document.documentElement.lang).toBe("ar")
  expect(browserWindow.document.documentElement.dir).toBe("rtl")

  mode = "missing"
  await languageApply("de", browserWindow)
  expect(i18nStore.language.get()).toBe("ar")
  expect(messageTranslate("common.continue")).toBe("متابعة")
  expect(browserWindow.document.documentElement.lang).toBe("ar")

  i18nStore.language.set("en")
  i18nStore.dictionary.set({})
})

test("an explicit selection that cannot load keeps the active locale and still records the choice", async () => {
  i18nStore.language.set("en")
  i18nStore.dictionary.set({})
  const { languageSelect } = await import("../../src/ui/i18n/model/languageSelect.js")
  const storage = new MemoryStorage()
  const browserWindow = browserWindowCreate({ storage })
  browserWindow.document.documentElement.lang = "en"
  browserWindow.document.documentElement.dir = "ltr"
  browserWindow.fetch = ((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.reject(new Error("catalog unavailable"))) as typeof fetch
  await languageSelect(browserWindow, "de")
  expect(i18nStore.language.get()).toBe("en")
  expect(messageTranslate("common.continue")).toBe("Continue")
  expect(browserWindow.document.documentElement.lang).toBe("en")
  expect(storage.getItem(languagePreferenceKey)).toBe("de")

  i18nStore.language.set("en")
  i18nStore.dictionary.set({})
})
