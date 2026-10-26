export const passkeyEventTypes = {
  authenticationCompleted: "passkey.authentication_completed",
  authenticationStarted: "passkey.authentication_started",
  credentialAdministratorRevoked: "passkey.credential_administrator_revoked",
  credentialRenamed: "passkey.credential_renamed",
  credentialRevoked: "passkey.credential_revoked",
  credentialUsed: "passkey.credential_used",
  registrationCompleted: "passkey.registration_completed",
  registrationStarted: "passkey.registration_started",
} as const
