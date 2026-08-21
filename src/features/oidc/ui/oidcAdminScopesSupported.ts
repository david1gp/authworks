/** The scopes Authworks issues tokens for. Clients may only be granted a subset of these. */
export const oidcAdminScopesSupported = ["openid", "profile", "email", "offline_access"] as const
