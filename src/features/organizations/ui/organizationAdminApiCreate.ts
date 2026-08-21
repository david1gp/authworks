import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { externalIdentityApiClientCreate } from "../../externalIdentities/client/externalIdentityApiClientCreate.js"
import { sessionCsrfTokenGet } from "../../sessions/client/sessionCsrfTokenGet.js"
import { organizationApiClientCreate } from "../client/organizationApiClientCreate.js"
import type { OrganizationAdminAdapter } from "./organizationAdminAdapter.js"

type OrganizationAdminFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/**
 * Binds the organization administration adapter to realm-scoped browser clients. Every mutation
 * first exchanges a session CSRF token so cookie-mode writes are accepted by the server.
 */
export function organizationAdminApiCreate(options: {
  readonly baseUrl: string
  readonly fetch?: OrganizationAdminFetch
  readonly realmId: () => string
}): OrganizationAdminAdapter {
  const browserFetch: OrganizationAdminFetch = (input, init) =>
    (options.fetch ?? fetch)(input, { ...init, credentials: "include" })
  const readClients = () => ({
    organizations: organizationApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
    providers: externalIdentityApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
  })
  const write = async <T>(run: (clients: ReturnType<typeof readClients>) => Promise<Result<T>>): Promise<Result<T>> => {
    const csrf = await sessionCsrfTokenGet({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      realmId: options.realmId(),
    })
    if (!csrf.success) return csrf
    return run({
      organizations: organizationApiClientCreate({
        baseUrl: options.baseUrl,
        csrfToken: csrf.data,
        fetch: browserFetch,
      }),
      providers: externalIdentityApiClientCreate({
        baseUrl: options.baseUrl,
        csrfToken: csrf.data,
        fetch: browserFetch,
      }),
    })
  }

  return {
    brandingGet: async (organizationId) => {
      const result = await readClients().organizations.organizationTenantBrandingGet(options.realmId(), organizationId)
      if (!result.success) return result
      if (result.status === "unchanged")
        return resultErrorCodedCreate(
          "organizationAdminBrandingGet",
          "The branding response was unchanged.",
          "platform.invalid-response",
        )
      return resultCreate(result.data)
    },
    brandingSet: (organizationId, input) =>
      write((clients) => clients.organizations.organizationTenantBrandingSet(options.realmId(), organizationId, input)),
    domainClaim: (organizationId, input) =>
      write((clients) => clients.organizations.organizationTenantDomainClaim(options.realmId(), organizationId, input)),
    domainDiscover: (domain) => readClients().organizations.organizationTenantDomainDiscover(domain),
    domainList: (organizationId, query?: ListQuery) =>
      readClients().organizations.organizationTenantDomainList(options.realmId(), organizationId, query),
    domainRemove: (organizationId, domain) =>
      write((clients) =>
        clients.organizations.organizationTenantDomainRemove(options.realmId(), organizationId, domain),
      ),
    domainVerify: (organizationId, domain) =>
      write((clients) =>
        clients.organizations.organizationTenantDomainVerify(options.realmId(), organizationId, domain),
      ),
    invitationCreate: (organizationId, input) =>
      write((clients) =>
        clients.organizations.organizationTenantInvitationCreate(options.realmId(), organizationId, input),
      ),
    invitationList: (organizationId, query?: ListQuery) =>
      readClients().organizations.organizationTenantInvitationList(options.realmId(), organizationId, query),
    invitationRevoke: (organizationId, invitationId) =>
      write((clients) =>
        clients.organizations.organizationTenantInvitationRevoke(options.realmId(), organizationId, invitationId),
      ),
    loginPolicyGet: (organizationId) =>
      organizationId.length === 0
        ? readClients().organizations.organizationTenantRealmLoginPolicyGet(options.realmId())
        : readClients().organizations.organizationTenantLoginPolicyGet(options.realmId(), organizationId),
    loginPolicySet: (organizationId, input) =>
      write((clients) =>
        organizationId.length === 0
          ? clients.organizations.organizationTenantRealmLoginPolicySet(options.realmId(), input)
          : clients.organizations.organizationTenantLoginPolicySet(options.realmId(), organizationId, input),
      ),
    membershipCreate: (organizationId, input) =>
      write((clients) =>
        clients.organizations.organizationTenantMembershipCreate(options.realmId(), organizationId, input),
      ),
    membershipList: (organizationId, query?: ListQuery) =>
      readClients().organizations.organizationTenantMembershipList(options.realmId(), organizationId, query),
    membershipRemove: (organizationId, membershipId) =>
      write((clients) =>
        clients.organizations.organizationTenantMembershipRemove(options.realmId(), organizationId, membershipId),
      ),
    membershipUpdate: (organizationId, membershipId, input) =>
      write((clients) =>
        clients.organizations.organizationTenantMembershipUpdate(
          options.realmId(),
          organizationId,
          membershipId,
          input,
        ),
      ),
    organizationCreate: (input) =>
      write((clients) => clients.organizations.organizationTenantCreate(options.realmId(), input)),
    organizationGet: async (organizationId) => {
      const result = await readClients().organizations.organizationTenantGet(options.realmId(), organizationId)
      if (!result.success) return result
      if (result.status === "unchanged")
        return resultErrorCodedCreate(
          "organizationAdminOrganizationGet",
          "The organization response was unchanged.",
          "platform.invalid-response",
        )
      return resultCreate(result.data)
    },
    organizationLifecycleSet: (organizationId, input) =>
      write((clients) =>
        clients.organizations.organizationTenantLifecycleSet(options.realmId(), organizationId, input),
      ),
    organizationList: (query?: ListQuery) =>
      readClients().organizations.organizationTenantList(options.realmId(), query),
    organizationUpdate: (organizationId, input) =>
      write((clients) => clients.organizations.organizationTenantUpdate(options.realmId(), organizationId, input)),
    providerCreate: (input) =>
      write((clients) => clients.providers.externalIdentityProviderTenantCreate(options.realmId(), input)),
    providerDisable: (providerId) =>
      write((clients) => clients.providers.externalIdentityProviderTenantDisable(options.realmId(), providerId)),
    providerList: (organizationId, query?: ListQuery) =>
      readClients().providers.externalIdentityProviderTenantList(options.realmId(), organizationId, query),
    providerUpdate: (providerId, input) =>
      write((clients) => clients.providers.externalIdentityProviderTenantUpdate(options.realmId(), providerId, input)),
    roleList: () => readClients().organizations.organizationTenantRoleList(options.realmId()),
  }
}
