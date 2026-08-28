import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

const [{ authenticatedImageFallbackStateCreate }, { authenticatedSelectAriaControlsApply }, { englishCatalog }] =
  await Promise.all([
    import("../../src/ui/authenticated/authenticatedImageFallbackStateCreate.js"),
    import("../../src/ui/authenticated/authenticatedSelectAriaControlsApply.js"),
    import("../../src/ui/i18n/model/englishCatalog.js"),
  ])

test("an unreachable picture URL degrades to the placeholder and recovers for a new URL", () => {
  createRoot((dispose) => {
    let url = "https://assets.example.com/avery-stone.png"
    const picture = authenticatedImageFallbackStateCreate(() => url)
    expect(picture.failed()).toBe(false)

    picture.onError()
    expect(picture.failed()).toBe(true)

    // A replacement picture must be attempted again rather than inherit the previous failure.
    url = "https://assets.example.com/avery-updated.png"
    expect(picture.failed()).toBe(false)

    url = ""
    expect(picture.failed()).toBe(true)
    dispose()
  })
})

test("the unavailable-picture label is a typed catalog key", () => {
  expect(englishCatalog["account.profile.pictureUnavailable"]).toBe("Profile picture could not be loaded")
})

test("a closed select trigger keeps no aria-controls reference and restores it when reopened", () => {
  const attributes = new Map<string, string>([["aria-controls", "listbox-1"]])
  const trigger = {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    removeAttribute: (name: string) => void attributes.delete(name),
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
  } as unknown as Element

  const closed = authenticatedSelectAriaControlsApply({ open: false, trigger })
  expect(closed).toBe("listbox-1")
  expect(attributes.has("aria-controls")).toBe(false)

  const opened = authenticatedSelectAriaControlsApply({ open: true, rememberedId: closed, trigger })
  expect(opened).toBe("listbox-1")
  expect(attributes.get("aria-controls")).toBe("listbox-1")

  // Reopening must not overwrite the id the vendored trigger writes itself.
  attributes.set("aria-controls", "listbox-2")
  expect(authenticatedSelectAriaControlsApply({ open: true, rememberedId: "listbox-1", trigger })).toBe("listbox-1")
  expect(attributes.get("aria-controls")).toBe("listbox-2")
})

test("a missing trigger leaves the remembered reference untouched", () => {
  expect(authenticatedSelectAriaControlsApply({ open: false, rememberedId: "listbox-9" })).toBe("listbox-9")
})

test("the invitation overview owns a translated open action in every locale", async () => {
  expect(englishCatalog["account.access.invitationOpen"]).toBe("Open invitation")

  const locales = ["ar", "de", "es", "fr", "hu", "it", "ja", "nl", "pl", "pt", "ru", "tr", "uk", "zh"] as const
  for (const key of ["account.access.invitationOpen", "account.profile.pictureUnavailable"] as const) {
    for (const locale of locales) {
      const csv = await Bun.file(new URL(`../../public/i18n/${locale}.csv`, import.meta.url)).text()
      const line = csv.split("\n").find((entry) => entry.startsWith(`${key},`))
      expect(line, `${locale}/${key}`).toBeString()
      expect(line, `${locale}/${key}`).not.toBe(`${key},${englishCatalog[key]}`)
    }
  }
})
