import type { User } from "../public/userSchema.js"
import type { UserRecord } from "../persistence/userRepositoryCreate.js"

export function userPublicViewCreate(row: UserRecord): User {
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
    realmId: row.realmId,
    profile,
    state: row.state as User["state"],
    updatedAt: row.updatedAt,
    userName: row.userName,
    verificationState: row.emailVerifiedAt === null ? "unverified" : "verified",
  }
}
