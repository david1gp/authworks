import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { User } from "../../users/public/userSchema.js"
import type { DirectoryUser } from "../public/directoryUserSchema.js"

export function directoryUserViewCreate(user: User): Result<DirectoryUser> {
  return resultCreate({
    createdAt: user.createdAt,
    ...(user.profile.displayName === undefined ? {} : { displayName: user.profile.displayName }),
    email: user.email,
    emailVerified: user.emailVerified,
    id: user.id,
    ...(user.lastSignInAt === undefined ? {} : { lastSignInAt: user.lastSignInAt }),
    ...(user.profile.picture?.url === undefined ? {} : { pictureUrl: user.profile.picture.url }),
    state: user.state,
    userName: user.userName,
    verificationState: user.verificationState,
  })
}
