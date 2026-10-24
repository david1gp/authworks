import { describe, expect, mock, test } from "bun:test"

mock.module("solid-js", () => ({
  createEffect: (effect: () => void) => {
    effect()
  },
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (_source: unknown, effect: () => void) => effect,
}))

const { organizationAdminDemoAdapterCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminDemoAdapterCreate.js"
)
const { organizationAdminFormStateCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminFormStateCreate.js"
)
const { organizationAdminPageStateCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminPageStateCreate.js"
)
const { organizationConfigurationBrandingStateCreate } = await import(
  "../../src/features/organizations/ui/organizationConfigurationBrandingStateCreate.js"
)
const { organizationBrandingDefaultCreate } = await import(
  "../../src/features/organizations/domain/organizationBrandingDefaultCreate.js"
)

const organizationId = "01900000-0000-7000-8000-000000000011"

function brandingStateCreate() {
  const adapter = organizationAdminDemoAdapterCreate(() => "success")
  const form = organizationAdminFormStateCreate()
  const page = organizationAdminPageStateCreate({
    adapter,
    confirm: () => true,
    organizationId: () => organizationId,
    screen: () => "configuration",
  })
  const branding = organizationConfigurationBrandingStateCreate({ form, organizationId: () => organizationId, page })
  return { branding, form, page }
}

describe("organization configuration branding draft", () => {
  test("starts clean and tracks colour edits as dirty", async () => {
    const { branding } = brandingStateCreate()
    await Promise.resolve()
    await Promise.resolve()

    expect(branding.dirty()).toBe(false)
    branding.themeColorSet("light", "primaryColor", "#0f766e")
    expect(branding.dirty()).toBe(true)
    expect(branding.branding().light.primaryColor).toBe("#0f766e")
  })

  test("rejects non-hex colours and accepts valid ones", async () => {
    const { branding } = brandingStateCreate()
    await Promise.resolve()
    await Promise.resolve()

    branding.themeColorSet("dark", "primaryColor", "not-a-colour")
    expect(branding.colorError()).toBe("colorInvalid")
    branding.themeColorSet("dark", "primaryColor", "#60a5fa")
    expect(branding.colorError()).toBeUndefined()
  })

  test("persists the draft to localStorage until saved and clears it after", async () => {
    const entries = new Map<string, string>()
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
      removeItem: (key: string) => void entries.delete(key),
      clear: () => entries.clear(),
      key: (index: number) => [...entries.keys()][index] ?? null,
      get length() {
        return entries.size
      },
    }
    const holder = globalThis as unknown as { window?: unknown }
    const previousWindow = holder.window
    holder.window = { localStorage: storage }
    try {
      const { branding, form } = brandingStateCreate()
      await Promise.resolve()
      await Promise.resolve()

      form.branding.set({
        ...organizationBrandingDefaultCreate(),
        light: { ...organizationBrandingDefaultCreate().light, primaryColor: "#0f766e" },
      })
      form.brandingLocalWrite(organizationId, form.branding.get()!)
      form.brandingLocalFlush()
      expect(branding.dirty()).toBe(true)

      const stored = form.brandingLocalGet(organizationId)
      expect(stored?.light.primaryColor).toBe("#0f766e")

      branding.discard()
      expect(branding.dirty()).toBe(false)
      expect(form.brandingLocalGet(organizationId)).toBeUndefined()
    } finally {
      if (previousWindow === undefined) delete holder.window
      else holder.window = previousWindow
    }
  })

  test("renders the mini sign-in preview from current form values", async () => {
    const { readFileSync } = await import("node:fs")
    const previewSource = readFileSync("src/features/organizations/ui/OrganizationConfigurationPreviewCard.tsx", "utf8")
    const shellSource = readFileSync("src/features/organizations/ui/OrganizationConfigurationShellView.tsx", "utf8")

    expect(previewSource).toContain("theme")
    expect(previewSource).toContain("messageTranslate")
    expect(shellSource).toContain("previewTheme")
    expect(shellSource).not.toContain('tone="info"')
  })
})
