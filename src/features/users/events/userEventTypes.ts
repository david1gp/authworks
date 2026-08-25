export const userEventTypes = {
  created: "user.created",
  deleted: "user.deleted",
  emailChangeFailed: "user.email_change_failed",
  emailChangeRequested: "user.email_change_requested",
  emailChangeVerified: "user.email_change_verified",
  emailChanged: "user.email_changed",
  emailVerificationChanged: "user.email_verification_changed",
  phoneNumberChanged: "user.phone_number_changed",
  profileUpdated: "user.profile_updated",
  registrationVerificationChanged: "user.registration_verification_changed",
  stateChanged: "user.state_changed",
} as const
