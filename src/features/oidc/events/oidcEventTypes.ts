export const oidcEventTypes = {
  clientCreated: "oidc.client_created",
  clientSecretRotated: "oidc.client_secret_rotated",
  clientStatusChanged: "oidc.client_status_changed",
  clientUpdated: "oidc.client_updated",
  signingKeyCreated: "oidc.signing_key_created",
  signingKeyRetired: "oidc.signing_key_retired",
} as const
