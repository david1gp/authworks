import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import { eventApiClientCreate } from "../../events/client/eventApiClientCreate.js"
import { sessionBrowserRequest } from "../../sessions/client/sessionBrowserRequest.js"
import { sessionBootstrapAdminSignInResponseSchema } from "../../sessions/public/sessionBootstrapAdminSignInResponseSchema.js"
import { sessionRevocationResponseSchema } from "../../sessions/public/sessionRevocationResponseSchema.js"
import { realmApiClientCreate } from "../../realms/client/realmApiClientCreate.js"
import { sessionApiClientCreate } from "../../sessions/client/sessionApiClientCreate.js"
import { userApiClientCreate } from "../../users/client/userApiClientCreate.js"

type AdminFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/** Builds the cookie-and-CSRF administration surface from completed feature clients. */
export function adminApiCreate(options: { readonly baseUrl: string; readonly fetch?: AdminFetch }) {
  const browserFetch: AdminFetch = (input, init) => (options.fetch ?? fetch)(input, { ...init, credentials: "include" })
  const users = userApiClientCreate({ baseUrl: options.baseUrl, fetch: options.fetch })
  const realms = realmApiClientCreate({ baseUrl: options.baseUrl, fetch: options.fetch })
  const events = eventApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })
  const sessions = sessionApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch })

  return {
    // Sign-in runs before any session cookie exists, so it cannot use the CSRF exchange. The
    // credential is only ever passed through as a request body and is never persisted here.
    adminSignIn: (realmId: string, secret: string) =>
      httpApiClientRequest({
        baseUrl: options.baseUrl,
        fetch: options.fetch,
        init: {
          body: JSON.stringify({ secret }),
          credentials: "include",
          headers: { "content-type": "application/json" },
          method: "POST",
        },
        op: "adminBootstrapSignIn",
        path: `/realms/${encodeURIComponent(realmId)}/admin/sign-in`,
        schema: sessionBootstrapAdminSignInResponseSchema,
      }),
    adminSignOut: (realmId: string) =>
      sessionBrowserRequest({
        baseUrl: options.baseUrl,
        fetch: options.fetch,
        init: { body: "{}", headers: { "content-type": "application/json" }, method: "POST" },
        op: "adminSignOut",
        path: `/realms/${encodeURIComponent(realmId)}/sessions/logout`,
        realmId,
        schema: sessionRevocationResponseSchema,
      }),
    eventList: events.eventTenantList,
    realmGet: realms.realmTenantGet,
    realmUpdate: realms.realmTenantUpdate,
    sessionCurrent: sessions.sessionCurrent,
    sessionList: sessions.sessionList,
    userAuthenticationMethodsGet: users.userTenantAuthenticationMethodsGet,
    userSessionRevoke: (realmId: string, userId: string, sessionId: string) =>
      sessionBrowserRequest({
        baseUrl: options.baseUrl,
        fetch: options.fetch,
        init: { method: "DELETE" },
        op: "adminUserSessionRevoke",
        path: `/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
        realmId,
        schema: sessionRevocationResponseSchema,
      }),
    userSessionsList: sessions.sessionUserList,
    userCreate: users.userTenantCreate,
    userDelete: users.userTenantDelete,
    userGet: users.userTenantGet,
    userList: users.userTenantList,
    userProfileUpdate: users.userTenantProfileUpdate,
    userLifecycleSet: users.userTenantLifecycleSet,
    userVerificationSet: users.userTenantVerificationSet,
    // Keep the completed feature clients reachable for later administration increments.
    featureClients: { events, realms, sessions, users },
  }
}
