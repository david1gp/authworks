import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { OrganizationBranding } from "../public/organizationBrandingSchema.js"
import { organizationBrandingSchema } from "../public/organizationBrandingSchema.js"
import type { OrganizationBrandingTheme } from "../public/organizationBrandingThemeSchema.js"
import type { organizationAdminFormStateCreate } from "./organizationAdminFormStateCreate.js"
import type { organizationAdminPageStateCreate } from "./organizationAdminPageStateCreate.js"

export type OrganizationConfigurationThemeKey = "dark" | "light"
export type OrganizationConfigurationThemeColorKey = "backgroundColor" | "fontColor" | "primaryColor" | "warnColor"

type ConfigurationPage = ReturnType<typeof organizationAdminPageStateCreate>
type ConfigurationForm = ReturnType<typeof organizationAdminFormStateCreate>

const hexColorSchema = v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/))
const httpsUrlSchema = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => new URL(value).protocol === "https:"),
)

/**
 * Owns the unsaved branding draft for the configuration shell: edits the in-memory form with a
 * debounced localStorage mirror until save, and reports dirtiness against the saved value.
 */
export function organizationConfigurationBrandingStateCreate(options: {
  readonly form: ConfigurationForm
  readonly organizationId: () => string
  readonly page: ConfigurationPage
}) {
  const colorError = createSignalObject<string | undefined>(undefined)
  const urlError = createSignalObject<string | undefined>(undefined)
  const fontFamilyVersion = createSignalObject(0)
  const previewTheme = createSignalObject<"dark" | "light">(configurationPreviewThemeStorageGet())

  const saved = () => options.page.branding()
  const draft = () => options.form.branding.get() ?? saved()
  const legalMerged = () => ({
    privacyUrl: draft().legal?.privacyUrl ?? draft().legalUrls?.privacyUrl,
    termsUrl: draft().legal?.termsUrl ?? draft().legalUrls?.termsUrl,
  })

  const draftUpdate = (next: OrganizationBranding) => {
    options.form.branding.set(next)
    options.form.brandingLocalWrite(options.organizationId(), next)
  }
  const themeUpdate = (theme: OrganizationConfigurationThemeKey, patch: Partial<OrganizationBrandingTheme>) =>
    draftUpdate({ ...draft(), [theme]: { ...draft()[theme], ...patch } })

  return {
    branding: draft,
    colorError: colorError.get,
    previewTheme: previewTheme.get,
    previewThemeSet: (theme: "dark" | "light") => {
      previewTheme.set(theme)
      configurationPreviewThemeStorageSet(theme)
    },
    dirty: () => JSON.stringify(draft()) !== JSON.stringify(saved()),
    discard: () => {
      colorError.set(undefined)
      urlError.set(undefined)
      options.form.branding.set(saved())
      options.form.brandingLocalClear(options.organizationId())
    },
    fontFamily: () => {
      fontFamilyVersion.get()
      return configurationFontFamilyStorageGet()
    },
    fontFamilySet: (value: string) => {
      configurationFontFamilyStorageSet(value)
      fontFamilyVersion.set(fontFamilyVersion.get() + 1)
    },
    fontUrl: () => draft().fontUrl ?? "",
    fontUrlSet: (value: string) => draftUpdate({ ...draft(), fontUrl: value.length === 0 ? undefined : value }),
    legalPrivacyUrl: () => legalMerged().privacyUrl ?? "",
    legalTermsUrl: () => legalMerged().termsUrl ?? "",
    legalUrlSet: (key: "privacyUrl" | "termsUrl", value: string) => {
      const trimmed = value.length === 0 ? undefined : value
      return draftUpdate({
        ...draft(),
        legal: { ...draft().legal, [key]: trimmed },
        legalUrls: undefined,
      })
    },
    save: async () => {
      colorError.set(undefined)
      urlError.set(undefined)
      const parsed = v.safeParse(organizationBrandingSchema, draft())
      if (!parsed.success) {
        const issues = parsed.issues.map((issue) => issue.path?.map((item) => String(item.key)).join(".") ?? "")
        const colorBad = issues.some((path) => path.includes("Color"))
        if (colorBad) colorError.set("colorInvalid")
        const urlBad = issues.some((path) => path.includes("Url") || path === "fontUrl")
        if (urlBad) urlError.set("urlInvalid")
        if (!colorBad && !urlBad) urlError.set("invalid")
        return false
      }
      const ok = await options.page.brandingSave(draft())
      if (!ok) return false
      options.form.brandingLocalClear(options.organizationId())
      options.form.branding.set(options.page.branding())
      return true
    },
    themeAsset: (theme: OrganizationConfigurationThemeKey, key: "iconUrl" | "logoUrl") => draft()[theme][key] ?? "",
    themeAssetSet: (theme: OrganizationConfigurationThemeKey, key: "iconUrl" | "logoUrl", value: string) =>
      themeUpdate(theme, { [key]: value.length === 0 ? undefined : value }),
    themeColor: (theme: OrganizationConfigurationThemeKey, key: OrganizationConfigurationThemeColorKey) =>
      draft()[theme][key],
    themeColorSet: (
      theme: OrganizationConfigurationThemeKey,
      key: OrganizationConfigurationThemeColorKey,
      value: string,
    ) => {
      const normalized = value.startsWith("#") ? value : `#${value}`
      if (!v.safeParse(hexColorSchema, normalized).success) {
        themeUpdate(theme, { [key]: value })
        colorError.set("colorInvalid")
        return
      }
      colorError.set(undefined)
      themeUpdate(theme, { [key]: normalized })
    },
    themeColorValid: (value: string) => v.safeParse(hexColorSchema, value).success,
    themeMode: () => draft().themeMode,
    themeModeSet: (value: "dark" | "light" | "system") => draftUpdate({ ...draft(), themeMode: value }),
    urlError: urlError.get,
    urlValid: (value: string) => value.length === 0 || v.safeParse(httpsUrlSchema, value).success,
    watermark: () => draft().disableWatermark,
    watermarkToggle: () => draftUpdate({ ...draft(), disableWatermark: !draft().disableWatermark }),
  }
}

export type OrganizationConfigurationBrandingState = ReturnType<typeof organizationConfigurationBrandingStateCreate>

function configurationPreviewThemeStorageGet(): "dark" | "light" {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return "light"
  try {
    return window.localStorage.getItem("authworks.admin.configuration.preview-theme") === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

function configurationPreviewThemeStorageSet(theme: "dark" | "light"): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return
  try {
    window.localStorage.setItem("authworks.admin.configuration.preview-theme", theme)
  } catch {
    // Browsers may block storage; the preview simply falls back to light.
  }
}

function configurationFontFamilyStorageGet(): string {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return ""
  try {
    return window.localStorage.getItem("authworks.admin.configuration.font-family") ?? ""
  } catch {
    return ""
  }
}

function configurationFontFamilyStorageSet(value: string): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return
  try {
    if (value.length === 0) window.localStorage.removeItem("authworks.admin.configuration.font-family")
    else window.localStorage.setItem("authworks.admin.configuration.font-family", value)
  } catch {
    // Browsers may block storage; the family simply falls back to empty.
  }
}
