import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"

const oidcConsentScopeLabels: Readonly<Record<string, MessageKey>> = {
  address: "oidc.consent.address",
  email: "oidc.consent.email",
  offline_access: "oidc.consent.offlineAccess",
  openid: "oidc.consent.openid",
  phone: "oidc.consent.phone",
  profile: "oidc.consent.profile",
  resourceowner: "oidc.consent.resourceOwner",
  "urn:zitadel:iam:user:resourceowner": "oidc.consent.resourceOwner",
}

/** Maps a requested scope to its plain-language catalog key. Unknown scopes stay raw. */
export function oidcConsentScopeLabelSelect(scope: string): MessageKey | undefined {
  return oidcConsentScopeLabels[scope]
}
