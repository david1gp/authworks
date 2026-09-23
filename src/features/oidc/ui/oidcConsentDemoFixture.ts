export const oidcConsentDemoFixture = {
  applicationName: "Analytics Dashboard",
  clientId: "analytics-dashboard",
  redirectUri: "https://analytics.example.com/oidc/callback",
  scopes: ["openid", "profile", "email"],
} as const
