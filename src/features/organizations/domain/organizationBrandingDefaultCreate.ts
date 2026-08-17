import type { OrganizationBranding } from "../public/organizationBrandingSchema.js"

export function organizationBrandingDefaultCreate(): OrganizationBranding {
  return {
    dark: {
      backgroundColor: "#1f2937",
      fontColor: "#f9fafb",
      icon: undefined,
      logo: undefined,
      primaryColor: "#60a5fa",
      warnColor: "#f87171",
    },
    disableWatermark: false,
    font: undefined,
    legal: { privacyUrl: undefined, termsUrl: undefined },
    light: {
      backgroundColor: "#ffffff",
      fontColor: "#111827",
      icon: undefined,
      logo: undefined,
      primaryColor: "#2563eb",
      warnColor: "#dc2626",
    },
    themeMode: "system",
  }
}
