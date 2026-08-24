import { mdiBrightnessAuto } from "@adaptive-ds/mdi/mdiBrightnessAuto.js"
import { mdiWeatherNight } from "@adaptive-ds/mdi/mdiWeatherNight.js"
import { mdiWhiteBalanceSunny } from "@adaptive-ds/mdi/mdiWhiteBalanceSunny.js"
import { createEffect, createMemo, onCleanup, onMount } from "solid-js"
import { isServer } from "solid-js/web"
import * as v from "valibot"
import { themeLocalStorageKey, themeSchema } from "#ui/interactive/theme/themeVariant.js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { loginLegalUrlsGet } from "../model/loginLegalUrlsGet.js"
import type { LoginScreen } from "../model/loginScreenSchema.js"
import type { LoginDiscovery } from "./loginAdapter.js"

export function loginFrameStateCreate<T extends Pick<LoginDiscovery, "branding">>(
  bootstrap: () => T,
  screen?: () => LoginScreen,
) {
  const preference = createSignalObject<"dark" | "light" | "os">("os")
  const systemTheme = createSignalObject<"dark" | "light">("light")
  const assetFailed = createSignalObject(false)
  let content: HTMLElement | undefined
  const effectiveTheme = createMemo<"dark" | "light">(() => {
    const forcedTheme = bootstrap().branding.themeMode
    if (forcedTheme === "dark" || forcedTheme === "light") return forcedTheme
    const preferredTheme = preference.get()
    return preferredTheme === "os" ? systemTheme.get() : preferredTheme
  })
  const theme = createMemo(() => bootstrap().branding[effectiveTheme()])
  const themeSwitchable = createMemo(() => bootstrap().branding.themeMode === "system")
  const themeSelect = (value: "dark" | "light" | "os") => {
    if (!themeSwitchable()) return
    preference.set(value)
    themePreferenceSave(value)
  }

  createEffect(() => {
    if (isServer) return
    const selectedTheme = effectiveTheme()
    document.documentElement.classList.toggle("dark", selectedTheme === "dark")
    document.documentElement.dataset.theme = selectedTheme
    document.documentElement.style.colorScheme = selectedTheme
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", theme().backgroundColor)
  })

  createEffect(() => {
    theme().logoUrl
    assetFailed.set(false)
  })

  createEffect(() => {
    screen?.()
    if (isServer) return
    if (screen === undefined) return
    queueMicrotask(() => content?.querySelector<HTMLHeadingElement>("h1[tabindex='-1']")?.focus())
  })

  onMount(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const systemThemeApply = () => systemTheme.set(media.matches ? "dark" : "light")
    const preferenceLoad = () => preference.set(themePreferenceLoad())
    const storageApply = (event: StorageEvent) => {
      if (event.key === themeLocalStorageKey) preferenceLoad()
    }

    systemThemeApply()
    preferenceLoad()
    media.addEventListener("change", systemThemeApply)
    window.addEventListener("storage", storageApply)
    onCleanup(() => {
      media.removeEventListener("change", systemThemeApply)
      window.removeEventListener("storage", storageApply)
    })
  })

  return {
    assetFail: () => assetFailed.set(true),
    assetUrl: () => (assetFailed.get() ? undefined : (theme().logoUrl ?? theme().iconUrl)),
    bootstrap,
    contentRegister: (element: HTMLElement) => {
      content = element
    },
    effectiveTheme,
    legal: () => loginLegalUrlsGet(bootstrap().branding.legal ?? bootstrap().branding.legalUrls),
    theme,
    themeOptions: [
      {
        icon: mdiWhiteBalanceSunny,
        label: () => messageTranslate("common.theme.light"),
        onSelect: () => themeSelect("light"),
        pressed: () => preference.get() === "light",
      },
      {
        icon: mdiWeatherNight,
        label: () => messageTranslate("common.theme.dark"),
        onSelect: () => themeSelect("dark"),
        pressed: () => preference.get() === "dark",
      },
      {
        icon: mdiBrightnessAuto,
        label: () => messageTranslate("common.theme.system"),
        onSelect: () => themeSelect("os"),
        pressed: () => preference.get() === "os",
      },
    ],
    themeSwitchable,
  }
}

function themePreferenceLoad(): "dark" | "light" | "os" {
  const storage = themePreferenceStorageGet()
  if (storage === undefined) return "os"

  let stored: string | null
  try {
    stored = storage.getItem(themeLocalStorageKey)
  } catch {
    return "os"
  }
  const parsed = v.safeParse(themeSchema, stored)
  return parsed.success ? parsed.output : "os"
}

function themePreferenceSave(value: "dark" | "light" | "os"): void {
  const storage = themePreferenceStorageGet()
  if (storage === undefined) return
  try {
    storage.setItem(themeLocalStorageKey, value)
  } catch {
    // Browser storage is an optional enhancement to the sign-in flow.
  }
}

function themePreferenceStorageGet(): Storage | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined
    return localStorage
  } catch {
    return undefined
  }
}
