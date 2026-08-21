import type { ExternalIdentityProvider } from "../externalIdentities/public/externalIdentityProviderSchema.js"

export const demoAdminOrganizationProviders: ExternalIdentityProvider[] = [
  {
    allowAccountCreation: true,
    clientId: "882910446103-acme.apps.googleusercontent.com",
    createdAt: 1_754_054_400_000,
    displayName: "Google Workspace",
    enabled: true,
    id: "01900000-0000-7000-8000-000000000081",
    organizationId: "01900000-0000-7000-8000-000000000011",
    realmId: "01900000-0000-7000-8000-000000000001",
    redirectUri: "https://auth.example/realms/acme/external-identity/google/callback",
    scopes: ["openid", "email", "profile"],
    type: "google",
    updatedAt: 1_755_782_400_000,
    version: 4,
  },
  {
    allowAccountCreation: false,
    clientId: "Iv1.9f2c7b41d0a63e58",
    createdAt: 1_754_918_400_000,
    displayName: "GitHub",
    enabled: false,
    id: "01900000-0000-7000-8000-000000000082",
    organizationId: "01900000-0000-7000-8000-000000000011",
    realmId: "01900000-0000-7000-8000-000000000001",
    redirectUri: "https://auth.example/realms/acme/external-identity/github/callback",
    scopes: ["read:user", "user:email"],
    type: "github",
    updatedAt: 1_755_609_600_000,
    version: 2,
  },
] satisfies ExternalIdentityProvider[]
