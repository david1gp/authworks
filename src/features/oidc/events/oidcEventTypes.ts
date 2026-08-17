export const oidcEventTypes = {
  authorizationCodeConsumed: "oidc.authorization_code_consumed",
  authorizationCodeIssued: "oidc.authorization_code_issued",
  authorizationRequestValidated: "oidc.authorization_request_validated",
  clientCreated: "oidc.client_created",
  clientSecretRotated: "oidc.client_secret_rotated",
  clientStatusChanged: "oidc.client_status_changed",
  clientUpdated: "oidc.client_updated",
  signingKeyCreated: "oidc.signing_key_created",
  signingKeyRetired: "oidc.signing_key_retired",
} as const
