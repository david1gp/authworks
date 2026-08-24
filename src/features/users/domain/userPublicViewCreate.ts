import type { UserRecord } from "../persistence/userRepositoryCreate.js"
import type { User } from "../public/userSchema.js"

export function userPublicViewCreate(row: UserRecord): User {
  const registrationVerified =
    row.registrationVerifiedAt !== null &&
    ((row.registrationVerificationMethod === "email" && row.emailVerifiedAt !== null) ||
      (row.registrationVerificationMethod === "whatsapp" && row.phoneNumberVerifiedAt !== null))
  const profile = {
    ...(row.profile.displayName === null ? {} : { displayName: row.profile.displayName }),
    ...(row.profile.firstName === null ? {} : { firstName: row.profile.firstName }),
    ...(row.profile.gender === null ? {} : { gender: row.profile.gender }),
    ...(row.profile.lastName === null ? {} : { lastName: row.profile.lastName }),
    ...(row.profile.nickName === null ? {} : { nickName: row.profile.nickName }),
    ...(row.profile.preferredLanguage === null ? {} : { preferredLanguage: row.profile.preferredLanguage }),
  }
  return {
    createdAt: row.createdAt,
    ...(row.deletedAt === null ? {} : { deletedAt: row.deletedAt }),
    email: row.email,
    emailVerified: row.emailVerifiedAt !== null,
    ...(row.emailVerifiedAt === null ? {} : { emailVerifiedAt: row.emailVerifiedAt }),
    id: row.id,
    ...(row.phoneNumber === null ? {} : { phoneNumber: row.phoneNumber }),
    ...(row.phoneNumberVerifiedAt === null ? {} : { phoneNumberVerifiedAt: row.phoneNumberVerifiedAt }),
    realmId: row.realmId,
    profile,
    ...(row.registrationVerifiedAt === null ? {} : { registrationVerifiedAt: row.registrationVerifiedAt }),
    ...(row.registrationVerificationMethod === null
      ? {}
      : {
          registrationVerificationMethod: row.registrationVerificationMethod as User["registrationVerificationMethod"],
        }),
    state: row.state as User["state"],
    updatedAt: row.updatedAt,
    userName: row.userName,
    verificationState: registrationVerified ? "verified" : "unverified",
  }
}
