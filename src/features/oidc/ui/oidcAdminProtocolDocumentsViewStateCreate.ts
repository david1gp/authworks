import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { oidcAdminDocumentCopyStateCreate } from "./oidcAdminDocumentCopyStateCreate.js"
import { oidcAdminDocumentOpenHrefSelect } from "./oidcAdminDocumentOpenHrefSelect.js"
import type { OidcAdminPageState } from "./oidcAdminPageStateCreate.js"

/** View state for the read-only protocol documents: derived JSON, endpoint rows, and copy feedback. */
export function oidcAdminProtocolDocumentsViewStateCreate(options: { readonly page: OidcAdminPageState }) {
  const copyState = oidcAdminDocumentCopyStateCreate({})
  const origin = () => (typeof window === "undefined" ? undefined : window.location.origin)
  const discoveryJson = () => JSON.stringify(options.page.discovery() ?? {}, null, 2)
  const jwksJson = () => JSON.stringify(options.page.jwks() ?? {}, null, 2)

  return {
    copied: copyState.copied,
    discoveryCopy: () => copyState.copy("discovery", discoveryJson()),
    /** The endpoints a client library reads, in the order it discovers them. */
    discoveryEndpoints: () => {
      const discovery = options.page.discovery()
      if (discovery === undefined) return []
      return [
        { label: messageTranslate("admin.oidc.documents.issuer"), value: discovery.issuer },
        {
          label: messageTranslate("admin.oidc.documents.authorizationEndpoint"),
          value: discovery.authorization_endpoint,
        },
        { label: messageTranslate("admin.oidc.documents.tokenEndpoint"), value: discovery.token_endpoint },
        { label: messageTranslate("admin.oidc.documents.userinfoEndpoint"), value: discovery.userinfo_endpoint },
        { label: messageTranslate("admin.oidc.documents.jwksUri"), value: discovery.jwks_uri },
        { label: messageTranslate("admin.oidc.documents.endSessionEndpoint"), value: discovery.end_session_endpoint },
      ]
    },
    discoveryHref: () => {
      const discovery = options.page.discovery()
      if (discovery === undefined) return undefined
      return oidcAdminDocumentOpenHrefSelect(`${discovery.issuer}/.well-known/openid-configuration`, origin())
    },
    discoveryJson,
    jwksCopy: () => copyState.copy("jwks", jwksJson()),
    jwksHref: () => {
      const discovery = options.page.discovery()
      return discovery === undefined ? undefined : oidcAdminDocumentOpenHrefSelect(discovery.jwks_uri, origin())
    },
    jwksJson,
    page: options.page,
  }
}
