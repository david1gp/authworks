import { oidcResourceOwnerScope } from "../domain/oidcResourceOwnerScope.js"

/** The scopes Authworks issues tokens for. Clients may only be granted a subset of these. */
export const oidcAdminScopesSupported = [
  "openid",
  "profile",
  "email",
  "phone",
  "address",
  "offline_access",
  oidcResourceOwnerScope,
] as const
