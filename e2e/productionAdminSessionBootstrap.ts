import type { Page } from "@playwright/test"

type ProductionAdminSessionBootstrapOptions = {
  readonly organizationId: string
  readonly organizationName: string
  readonly realmId: string
}

export async function productionAdminSessionBootstrap(
  page: Page,
  options: ProductionAdminSessionBootstrapOptions,
): Promise<void> {
  const { organizationId, organizationName, realmId } = options
  await page.route("**/organization-discovery", (route) =>
    route.fulfill({
      json: {
        branding: {
          dark: { backgroundColor: "#111827", fontColor: "#f9fafb", primaryColor: "#60a5fa", warnColor: "#f87171" },
          disableWatermark: true,
          light: { backgroundColor: "#f8fafc", fontColor: "#111827", primaryColor: "#2563eb", warnColor: "#dc2626" },
          themeMode: "system",
        },
        domain: "customer.example",
        found: true,
        organization: { id: organizationId, name: organizationName, realmId },
        policy: {
          allowDomainDiscovery: true,
          allowEmailOtp: true,
          allowExternalIdentity: true,
          allowExternalIdentityAutoLinking: true,
          allowPassword: true,
          allowPasswordRecovery: true,
          allowPasskey: true,
          allowRegistration: true,
          allowedFactors: ["totp", "email_otp", "passkey"],
          minimumStepUpAssurance: "authenticated",
          preferredFactorOrder: ["totp", "email_otp", "passkey"],
          providerIds: [],
          requiredMfa: false,
        },
        providers: [],
      },
    }),
  )
  await page.route(`**/realms/${realmId}/sessions/current`, (route) =>
    route.fulfill({
      json: {
        session: {
          assurance: "authenticated",
          authenticationMethod: "bootstrap_admin",
          createdAt: 1_700_000_000_000,
          current: true,
          device: {},
          expiresAt: 1_700_000_900_000,
          id: "01900000-0000-7000-8000-0000000000a1",
          lastUsedAt: 1_700_000_000_000,
          realmId,
          revokedAt: null,
          subjectId: "01900000-0000-7000-8000-0000000000b1",
          subjectType: "bootstrap_admin",
        },
      },
    }),
  )
  await page.route(`**/realms/${realmId}`, (route) =>
    route.fulfill({
      json: {
        realm: {
          createdAt: 1_700_000_000_000,
          domain: "customer.example",
          domains: ["customer.example"],
          id: realmId,
          name: "customer-identity",
          status: "active",
          updatedAt: 1_700_000_100_000,
        },
      },
    }),
  )
}
