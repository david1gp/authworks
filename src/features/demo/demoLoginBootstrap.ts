import type { OrganizationDiscoveryResponse } from "../organizations/public/organizationDiscoveryResponseSchema.js"

export const demoLoginBootstrap = {
  branding: {
    dark: {
      backgroundColor: "#111827",
      fontColor: "#f9fafb",
      logoUrl: "/favicon.svg",
      primaryColor: "#60a5fa",
      warnColor: "#f87171",
    },
    disableWatermark: true,
    legal: {
      privacyUrl: "https://example.com/privacy",
      termsUrl: "https://example.com/terms",
    },
    light: {
      backgroundColor: "#f8fafc",
      fontColor: "#111827",
      logoUrl: "/favicon.svg",
      primaryColor: "#2563eb",
      warnColor: "#dc2626",
    },
    themeMode: "system",
  },
  domain: "acme.example",
  found: true,
  organization: {
    id: "org-acme",
    name: "Acme",
    realmId: "realm-acme",
  },
  policy: {
    allowDomainDiscovery: true,
    allowEmailOtp: true,
    allowWhatsappOtp: true,
    allowExternalIdentity: true,
    allowExternalIdentityAutoLinking: true,
    allowPassword: true,
    allowPasswordRecovery: true,
    allowPasskey: true,
    allowRegistration: true,
    providerIds: ["provider-google"],
    requiredMfa: false,
    allowedFactors: ["totp", "email_otp", "passkey"],
    preferredFactorOrder: ["totp", "email_otp", "passkey"],
    minimumStepUpAssurance: "authenticated",
  },
  providers: [
    {
      displayName: "Google",
      id: "provider-google",
      type: "google",
    },
  ],
} satisfies Extract<OrganizationDiscoveryResponse, { found: true }>
