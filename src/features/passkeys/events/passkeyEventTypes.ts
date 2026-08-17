export const passkeyEventTypes = {
  authenticationCompleted: "passkey.authentication_completed",
  authenticationStarted: "passkey.authentication_started",
  credentialRevoked: "passkey.credential_revoked",
  credentialUsed: "passkey.credential_used",
  registrationCompleted: "passkey.registration_completed",
  registrationStarted: "passkey.registration_started",
} as const
