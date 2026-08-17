export const externalIdentityEventTypes = {
  accountCreated: "external_identity.account_created",
  authenticationFailed: "external_identity.authentication_failed",
  authenticationStarted: "external_identity.authentication_started",
  authenticationSucceeded: "external_identity.authentication_succeeded",
  linked: "external_identity.linked",
  providerCreated: "external_identity.provider_created",
  providerDisabled: "external_identity.provider_disabled",
  providerUpdated: "external_identity.provider_updated",
  unlinked: "external_identity.unlinked",
} as const
