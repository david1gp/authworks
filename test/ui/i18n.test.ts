import { expect, mock, test } from "bun:test"
import * as v from "valibot"

mock.module("solid-js", () => ({
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
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

function translationPlaceholdersGet(value: string): string[] {
  return [...value.matchAll(/\{[^}]+\}/g)].map(([placeholder]) => placeholder).sort()
}
