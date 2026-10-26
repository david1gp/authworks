import type { SessionRow } from "../../sessions/persistence/sessionTable.js"
import type { UserProfileRow } from "../../users/persistence/userProfileTable.js"
import type { UserRow } from "../../users/persistence/userTable.js"
import { oidcResourceOwnerClaim } from "../public/oidcResourceOwnerClaim.js"
import type { OidcUserInfo } from "../public/oidcUserInfoSchema.js"
import { oidcResourceOwnerScope } from "./oidcResourceOwnerScope.js"

type OidcUserInfoClaimsSubject = {
  readonly profile: UserProfileRow | null
  readonly resourceOwnerOrganizationId: string | undefined
  readonly session: SessionRow
  readonly user: UserRow
}

// acr carries the session assurance verbatim ("none", "authenticated", or
// "multi_factor") and amr carries the distinct session authentication and MFA
// method names (password, passkey, totp, email_otp, and their peers). Both
// match the ID-token mapping in oidcTokenIssue, and auth_time is the session
// creation second. All three are always present so callers never infer
// single-factor from an absent claim.
export function oidcUserInfoClaimsCreate(subject: OidcUserInfoClaimsSubject, scope: readonly string[]): OidcUserInfo {
  const claims: OidcUserInfo = {
    acr: subject.session.assurance as OidcUserInfo["acr"],
    amr: [
      ...new Set(
        [subject.session.authenticationMethod, subject.session.mfaMethod ?? undefined].filter(
          (value): value is string => value !== undefined,
        ),
      ),
    ],
    auth_time: Math.floor(subject.session.createdAt / 1_000),
    sub: subject.user.id,
  }
  if (subject.session.impersonatorId !== null) claims.act = { sub: subject.session.impersonatorId }
  if (scope.includes("email")) {
    claims.email = subject.user.email
    claims.email_verified = subject.user.emailVerifiedAt !== null
  }
  if (scope.includes("profile")) {
    claims.preferred_username = subject.user.userName
    if (subject.profile?.displayName !== null && subject.profile?.displayName !== undefined)
      claims.name = subject.profile.displayName
    if (subject.profile?.firstName !== null && subject.profile?.firstName !== undefined)
      claims.given_name = subject.profile.firstName
    if (subject.profile?.lastName !== null && subject.profile?.lastName !== undefined)
      claims.family_name = subject.profile.lastName
    if (subject.profile?.nickName !== null && subject.profile?.nickName !== undefined)
      claims.nickname = subject.profile.nickName
    if (subject.profile?.preferredLanguage !== null && subject.profile?.preferredLanguage !== undefined)
      claims.locale = subject.profile.preferredLanguage
  }
  if (scope.includes("phone")) {
    if (subject.user.phoneNumber !== null) claims.phone_number = subject.user.phoneNumber
    claims.phone_number_verified = subject.user.phoneNumberVerifiedAt !== null
  }
  // Users have no address fields, so the accepted `address` scope yields no
  // address claim. OIDC Core allows authorized claims to be absent, so the
  // scope succeeds with an empty address result instead of an error.
  if (scope.includes(oidcResourceOwnerScope) && subject.resourceOwnerOrganizationId !== undefined)
    claims[oidcResourceOwnerClaim] = subject.resourceOwnerOrganizationId
  return claims
}
