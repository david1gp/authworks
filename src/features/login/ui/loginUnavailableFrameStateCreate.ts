import { loginFrameStateCreate } from "./loginFrameStateCreate.js"

export function loginUnavailableFrameStateCreate() {
  return loginFrameStateCreate(() => ({
    branding: {
      dark: {
        backgroundColor: "#17191c",
        fontColor: "#f4f5f5",
        primaryColor: "#d7f06c",
        warnColor: "#ff756f",
      },
      disableWatermark: true,
      light: {
        backgroundColor: "#f5f3ed",
        fontColor: "#15201d",
        primaryColor: "#1d5c4b",
        warnColor: "#a9362b",
      },
      themeMode: "system" as const,
    },
  }))
}
