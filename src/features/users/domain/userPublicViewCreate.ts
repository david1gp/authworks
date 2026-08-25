import * as v from "valibot"
import type { UserRecord } from "../persistence/userRepositoryCreate.js"
import { userPictureAssetSchema } from "../public/userPictureAssetSchema.js"
import type { User } from "../public/userSchema.js"

function userProfileStringValueGet(value: string | null, maxLength: number): string | undefined {
  return value !== null && value.length >= 1 && value.length <= maxLength ? value : undefined
}

export function userPublicViewCreate(row: UserRecord): User {
  const registrationVerified =
    row.registrationVerifiedAt !== null &&
    ((row.registrationVerificationMethod === "email" && row.emailVerifiedAt !== null) ||
      (row.registrationVerificationMethod === "whatsapp" && row.phoneNumberVerifiedAt !== null))
  const displayName = userProfileStringValueGet(row.profile.displayName, 128)
  const firstName = userProfileStringValueGet(row.profile.firstName, 128)
  const gender = userProfileStringValueGet(row.profile.gender, 64)
  const lastName = userProfileStringValueGet(row.profile.lastName, 128)
  const nickName = userProfileStringValueGet(row.profile.nickName, 128)
  const preferredLanguage = userProfileStringValueGet(row.profile.preferredLanguage, 16)
  const picture =
    row.profile.pictureUrl === null
      ? undefined
      : v.safeParse(userPictureAssetSchema, {
          ...(row.profile.pictureContentType === null ? {} : { contentType: row.profile.pictureContentType }),
          url: row.profile.pictureUrl,
        })
  const pictureAsset = picture?.success ? picture.output : undefined
  const profile = {
    ...(displayName === undefined ? {} : { displayName }),
    ...(firstName === undefined ? {} : { firstName }),
    ...(gender === undefined ? {} : { gender }),
    ...(lastName === undefined ? {} : { lastName }),
    ...(nickName === undefined ? {} : { nickName }),
    ...(pictureAsset === undefined ? {} : { picture: pictureAsset }),
    ...(preferredLanguage === undefined ? {} : { preferredLanguage }),
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
