import type * as v from "valibot"
import type { Result } from "#result"
import { oidcApiClientCreate } from "../../oidc/client/oidcApiClientCreate.js"
import { oidcConsentRevokeResponseSchema } from "../../oidc/public/oidcConsentRevokeResponseSchema.js"
import { organizationApiClientCreate } from "../../organizations/client/organizationApiClientCreate.js"
import { organizationInvitationMeAcceptResponseSchema } from "../../organizations/public/organizationInvitationMeAcceptResponseSchema.js"
import { organizationInvitationMeDeclineResponseSchema } from "../../organizations/public/organizationInvitationMeDeclineResponseSchema.js"
import { organizationInvitationMeInspectResponseSchema } from "../../organizations/public/organizationInvitationMeInspectResponseSchema.js"
import { organizationMeSwitchResponseSchema } from "../../organizations/public/organizationMeSwitchResponseSchema.js"
import { sessionBrowserRequest } from "../../sessions/client/sessionBrowserRequest.js"

type AccountAccessFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export function accountAccessApiCreate(options: { readonly baseUrl: string; readonly fetch?: AccountAccessFetch }) {
  const browserFetch: AccountAccessFetch = (input, init) =>
    (options.fetch ?? fetch)(input, { ...init, credentials: "include" })
  const organizations = organizationApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const oidc = oidcApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const mutate = <T>(realmId: string, path: string, body: unknown, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    sessionBrowserRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: { body: JSON.stringify(body), method: "POST" },
      op: "accountAccessMutation",
      path,
      realmId,
      schema,
    })

  return {
    consentList: oidc.oidcConsentMeList,
    consentRevoke: (realmId: string, clientId: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/me/consents/${encodeURIComponent(clientId)}/revoke`,
        {},
        oidcConsentRevokeResponseSchema,
      ),
    invitationAccept: (realmId: string, token: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/me/invitations/accept`,
        { token },
        organizationInvitationMeAcceptResponseSchema,
      ),
    invitationDecline: (realmId: string, token: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/me/invitations/decline`,
        { token },
        organizationInvitationMeDeclineResponseSchema,
      ),
    invitationInspect: (realmId: string, token: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/me/invitations/inspect`,
        { token },
        organizationInvitationMeInspectResponseSchema,
      ),
    invitationList: organizations.organizationInvitationMeList,
    organizationList: organizations.organizationMeList,
    organizationSwitch: (realmId: string, organizationId: string) =>
      mutate(
        realmId,
        `/realms/${encodeURIComponent(realmId)}/me/organizations/switch`,
        { organizationId },
        organizationMeSwitchResponseSchema,
      ),
    featureClients: { oidc, organizations },
  }
}
