import { mdiBrightnessAuto } from "@adaptive-ds/mdi/mdiBrightnessAuto.js"
import { mdiWeatherNight } from "@adaptive-ds/mdi/mdiWeatherNight.js"
import { mdiWhiteBalanceSunny } from "@adaptive-ds/mdi/mdiWhiteBalanceSunny.js"
import { onMount } from "solid-js"
import { themeInit, themeSet, themeSignal } from "#ui/interactive/theme/themeSignal.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"

export function authenticatedThemeToggleStateCreate() {
  onMount(themeInit)
  return {
    options: [
      {
        icon: mdiWhiteBalanceSunny,
        label: () => messageTranslate("common.theme.light"),
        select: () => themeSet("light", true),
        pressed: () => themeSignal.get() === "light",
      },
      {
        icon: mdiWeatherNight,
        label: () => messageTranslate("common.theme.dark"),
        select: () => themeSet("dark", true),
        pressed: () => themeSignal.get() === "dark",
      },
      {
        icon: mdiBrightnessAuto,
        label: () => messageTranslate("common.theme.system"),
        select: () => themeSet("os", true),
        pressed: () => themeSignal.get() === "os",
      },
    ],
  }
}
