import type { Page } from "@playwright/test"

const realmId = "01900000-0000-7000-8000-000000000001"
const organizationId = "01900000-0000-7000-8000-000000000002"
const userId = "01900000-0000-7000-8000-0000000000b1"

export async function productionAccountSessionBootstrap(page: Page): Promise<void> {
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
        organization: { id: organizationId, name: "Customer identity", realmId },
        policy: {
          allowDomainDiscovery: true,
          allowEmailOtp: true,
          allowExternalIdentity: true,
          allowPassword: true,
          allowPasswordRecovery: true,
          allowPasskey: true,
          allowRegistration: true,
          providerIds: [],
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
          authenticationMethod: "password",
          createdAt: 1_700_000_000_000,
          current: true,
          device: {},
          expiresAt: 1_700_000_900_000,
          id: "01900000-0000-7000-8000-0000000000a1",
          lastUsedAt: 1_700_000_000_000,
          realmId,
          revokedAt: null,
          subjectId: userId,
          subjectType: "user",
          userId,
        },
      },
    }),
  )
  await page.route(`**/realms/${realmId}/me`, (route) =>
    route.fulfill({
      json: {
        user: {
          createdAt: 1_700_000_000_000,
          email: "user@customer.example",
          emailVerified: true,
          id: userId,
          profile: { displayName: "Customer user" },
          realmId,
          state: "active",
          updatedAt: 1_700_000_000_000,
          userName: "customer-user",
          verificationState: "verified",
        },
      },
    }),
  )
  await page.route(`**/realms/${realmId}/me/organizations`, (route) =>
    route.fulfill({
      json: {
        items: [
          {
            membership: {
              createdAt: 1_700_000_000_000,
              id: "01900000-0000-7000-8000-000000000003",
              organizationId,
              realmId,
              roles: ["member"],
              updatedAt: 1_700_000_000_000,
              userId,
            },
            organization: {
              createdAt: 1_700_000_000_000,
              id: organizationId,
              name: "Customer identity",
              realmId,
              status: "active",
              updatedAt: 1_700_000_000_000,
            },
          },
        ],
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
