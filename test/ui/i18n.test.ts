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
  i18nStore.dictionary.set({
    "common.signInWithProvider": "Mit {provider} anmelden",
    Continue: "Weiter",
  })
  expect(messageTranslate("common.signInWithProvider", { provider: "GitHub" })).toBe("Mit GitHub anmelden")
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
  expect(messageTranslate("login.chooser.description", { organization: "Acme" })).toBe(
    "Wählen Sie aus, wie Sie sich bei Acme anmelden möchten.",
  )
  expect(messageTranslate("login.password.description", { organization: "Acme" })).toBe(
    "Geben Sie die Zugangsdaten für Ihr Acme-Konto ein.",
  )
})

test("Arabic account-session labels, guard, and navigation text render translated rather than fallback English", async () => {
  const arCsv = await Bun.file(new URL("../../public/i18n/ar.csv", import.meta.url)).text()
  const parsed = translationCsvParse(arCsv)
  expect(parsed.success).toBe(true)
  if (!parsed.success) return

  i18nStore.language.set("ar")
  i18nStore.dictionary.set(parsed.data)

  // Account session labels
  expect(messageTranslate("account.security.label")).toBe("إدارة أمان الحساب")
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
  expect(messageTranslate("shell.nav.personalInformation")).toBe("المعلومات الشخصية")
  expect(messageTranslate("shell.nav.security")).toBe("الأمان")
  expect(messageTranslate("shell.nav.access")).toBe("الوصول")
  expect(messageTranslate("shell.nav.realm")).toBe("النطاق")
  expect(messageTranslate("shell.nav.directory")).toBe("الدليل")
  expect(messageTranslate("shell.nav.applications")).toBe("التطبيقات")
  expect(messageTranslate("shell.nav.operations")).toBe("العمليات")
  expect(messageTranslate("shell.nav.overview")).toBe("نظرة عامة")
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
    ["shell.nav.emailAddress", "account.profile.email"],
    ["shell.nav.password", "login.password.label"],
    ["shell.nav.profile", "admin.users.profileTitle"],
    ["shell.nav.passkeys", "account.factors.passkeys"],
    ["shell.nav.organization", "admin.projects.detail.organization"],
    ["shell.nav.applicationConsents", "admin.oidc.consents.title"],
  ] as const

  for (const [shellKey, featureKey] of duplicates) {
    expect(englishCatalog[shellKey]).toBe(englishCatalog[featureKey])
    expect(messageTranslate(shellKey)).toBe(parsed.data[shellKey] as string)
    expect(messageTranslate(shellKey)).not.toBe(englishCatalog[shellKey])
  }

  // "Impersonation" and "Organization" previously fell back to English through the reverse map.
  expect(messageTranslate("shell.nav.impersonation")).toBe("Identitätsübernahme")
  expect(messageTranslate("shell.nav.organization")).toBe("Organisation")

  i18nStore.language.set("en")
  i18nStore.dictionary.set({})
})

// Protocol names and proper nouns stay identical to their English source in every locale.
const untranslatedProtocolKeys = new Set(["shell.nav.openIdConnect"])

// Locale/key pairs whose correct translation is spelled exactly like the English word.
const identicalWordTranslations = new Set([
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
      if (untranslatedProtocolKeys.has(key)) {
        expect(translated, `${option.code}/${key} is an intentional protocol name`).toBe(
          englishCatalog[key as keyof typeof englishCatalog],
        )
        continue
      }
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
  "account.access.makeActiveOrganization",
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

function translationPlaceholdersGet(value: string): string[] {
  return [...value.matchAll(/\{[^}]+\}/g)].map(([placeholder]) => placeholder).sort()
}
