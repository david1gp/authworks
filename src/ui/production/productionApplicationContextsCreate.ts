import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { httpApiClientRequest } from "../../platform/http/httpApiClientRequest.js"
import { resultCreate } from "../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../platform/errors/resultErrorCodedCreate.js"
import { organizationDiscoveryResponseSchema } from "../../features/organizations/public/organizationDiscoveryResponseSchema.js"
import { organizationMeListResponseSchema } from "../../features/organizations/public/organizationMeListResponseSchema.js"
import { organizationResourceIdSchema } from "../../features/organizations/public/organizationResourceIdSchema.js"
import { organizationMeSwitchResponseSchema } from "../../features/organizations/public/organizationMeSwitchResponseSchema.js"
import { realmResponseSchema } from "../../features/realms/public/realmResponseSchema.js"
import { sessionBrowserRequest } from "../../features/sessions/client/sessionBrowserRequest.js"
import { sessionSchema } from "../../features/sessions/public/sessionSchema.js"
import { userCurrentResponseSchema } from "../../features/users/public/userCurrentResponseSchema.js"
import type { ProductionApiContextValue } from "./productionApiContextValue.js"
import type { ProductionRouteGuardContext } from "./productionRouteGuardContext.js"
import type { ProductionSessionContextValue } from "./productionSessionContextValue.js"

const sessionCurrentResponseSchema = v.strictObject({ session: sessionSchema })

export async function productionApplicationContextsCreate(): Promise<{
  readonly api: ProductionApiContextValue
  readonly session: ProductionSessionContextValue
}> {
  const discovery = await productionJsonGet(
    "/organization-discovery",
    organizationDiscoveryResponseSchema,
    "productionOrganizationDiscoveryGet",
  )
  if (discovery === undefined || !discovery.found) return productionAnonymousContextsCreate()

  const realmId = discovery.organization.realmId
  const current = await productionJsonGet(
    `/realms/${encodeURIComponent(realmId)}/sessions/current`,
    sessionCurrentResponseSchema,
    "productionSessionCurrentGet",
  )
  if (current === undefined) {
    return productionContextsCreate({
      api: { content: "ready", retry: () => undefined },
      session: productionAnonymousSessionCreate(realmId, discovery.organization.id, discovery.organization.name),
    })
  }

  const session = current.session
  const user =
    session.subjectType === "user"
      ? await productionJsonGet(
          `/realms/${encodeURIComponent(realmId)}/me`,
          userCurrentResponseSchema,
          "productionUserMeGet",
          { cache: "no-store" },
        )
      : undefined
  const memberships =
    session.subjectType === "user"
      ? await productionJsonGet(
          `/realms/${encodeURIComponent(realmId)}/me/organizations`,
          organizationMeListResponseSchema,
          "productionOrganizationMeList",
        )
      : undefined
  const realm = await productionJsonGet(
    `/realms/${encodeURIComponent(realmId)}`,
    realmResponseSchema,
    "productionRealmGet",
  )
  const organizations = memberships?.items.map((item) => ({
    id: item.organization.id,
    label: item.organization.name,
  })) ?? [{ id: discovery.organization.id, label: discovery.organization.name }]
  const requestedOrganization = v.safeParse(
    organizationResourceIdSchema,
    new URL(window.location.href).searchParams.get("organization"),
  )
  const selectedOrganization =
    organizations.find((item) => item.id === session.organizationId) ??
    (session.organizationId === undefined
      ? organizations.find((item) => item.id === (requestedOrganization.success ? requestedOrganization.output : ""))
      : undefined) ??
    organizations.find((item) => item.id === discovery.organization.id) ??
    organizations[0]

  const organization = createSignalObject<ProductionRouteGuardContext["organization"]>(
    selectedOrganization === undefined ? "missing" : { organizationId: selectedOrganization.id, status: "available" },
  )
  const organizationSwitchPending = createSignalObject(false)
  let organizationSwitchGeneration = 0
  const organizationSelect = async (organizationId: string) => {
    const selected = v.safeParse(organizationResourceIdSchema, organizationId)
    if (!selected.success)
      return resultErrorCodedCreate(
        "productionOrganizationSelect",
        "The organization selection is invalid.",
        "organizations.invalid",
      )
    if (!organizations.some((item) => item.id === selected.output))
      return resultErrorCodedCreate(
        "productionOrganizationSelect",
        "The organization is not available in this realm.",
        "organizations.not-found",
      )
    if (organizationSwitchPending.get())
      return resultErrorCodedCreate(
        "productionOrganizationSelect",
        "An organization switch is already in progress.",
        "organizations.pending",
      )
    const currentOrganization = organization.get()
    if (typeof currentOrganization === "object" && currentOrganization.organizationId === selected.output) {
      productionOrganizationUrlUpdate(selected.output)
      return resultCreate(undefined)
    }

    const generation = ++organizationSwitchGeneration
    organizationSwitchPending.set(true)
    const result = await sessionBrowserRequest({
      baseUrl: window.location.origin,
      init: { body: JSON.stringify({ organizationId: selected.output }), method: "POST" },
      op: "productionOrganizationSelect",
      path: `/realms/${encodeURIComponent(realmId)}/me/organizations/switch`,
      realmId,
      schema: organizationMeSwitchResponseSchema,
    })
    if (generation !== organizationSwitchGeneration) return resultCreate(undefined)
    organizationSwitchPending.set(false)
    if (!result.success) return result
    if (
      result.data.activeOrganizationId !== selected.output ||
      result.data.context.organizationId !== selected.output ||
      result.data.context.realmId !== realmId ||
      result.data.context.actorId !== (session.userId ?? session.subjectId) ||
      (result.data.context.actor.realmId !== undefined && result.data.context.actor.realmId !== realmId) ||
      result.data.organization.id !== selected.output ||
      result.data.organization.realmId !== realmId
    )
      return resultErrorCodedCreate(
        "productionOrganizationSelect",
        "The organization switch response is invalid.",
        "platform.invalid-response",
      )
    organization.set({ organizationId: selected.output, status: "available" })
    productionOrganizationUrlUpdate(selected.output)
    return resultCreate(undefined)
  }

  return productionContextsCreate({
    api: { content: "ready", retry: () => undefined },
    session: {
      actorLabel: user?.user.profile.displayName ?? user?.user.email ?? "Administrator",
      guard: {
        authentication: { status: "authenticated", userId: session.userId ?? session.subjectId },
        get organization() {
          return organization.get()
        },
        permission:
          session.subjectType === "user"
            ? user?.capabilities?.realmRead === true
              ? "granted"
              : "denied"
            : realm === undefined
              ? "denied"
              : "granted",
        realm: { realmId, status: "available" },
      },
      impersonation:
        session.impersonated === true
          ? {
              actorLabel: session.impersonatorId ?? session.subjectId,
              subjectLabel: session.userId ?? session.subjectId,
            }
          : null,
      organizations,
      organizationSelect,
      organizationSwitchPending: organizationSwitchPending.get,
      realms: [{ id: realmId, label: realm?.realm.name ?? realmId }],
    },
  })
}

async function productionJsonGet<T>(
  path: string,
  schema: v.GenericSchema<T>,
  op: string,
  options: Pick<RequestInit, "cache"> = {},
): Promise<T | undefined> {
  const result = await httpApiClientRequest({
    baseUrl: new URL(window.location.href).origin,
    init: { ...options, credentials: "include", method: "GET" },
    op,
    path,
    schema,
  })
  return result.success ? result.data : undefined
}

function productionAnonymousContextsCreate() {
  return productionContextsCreate({
    api: { content: "ready", retry: () => undefined },
    session: {
      actorLabel: "",
      guard: {
        authentication: "anonymous",
        organization: "missing",
        permission: "not-required",
        realm: "missing",
      },
      impersonation: null,
      organizations: [],
      organizationSelect: async () => resultCreate(undefined),
      organizationSwitchPending: () => false,
      realms: [],
    },
  })
}

function productionAnonymousSessionCreate(realmId: string, organizationId: string, organizationName: string) {
  return {
    actorLabel: "",
    guard: {
      authentication: "anonymous" as const,
      organization: { organizationId, status: "available" as const },
      permission: "not-required" as const,
      realm: { realmId, status: "available" as const },
    },
    impersonation: null,
    organizations: [{ id: organizationId, label: organizationName }],
    organizationSelect: async () => resultCreate(undefined),
    organizationSwitchPending: () => false,
    realms: [{ id: realmId, label: realmId }],
  } satisfies ProductionSessionContextValue
}

function productionOrganizationUrlUpdate(organizationId: string) {
  const next = new URL(window.location.href)
  next.searchParams.set("organization", organizationId)
  window.history.replaceState(window.history.state, "", `${next.pathname}${next.search}${next.hash}`)
}

function productionContextsCreate(options: {
  readonly api: ProductionApiContextValue
  readonly session: ProductionSessionContextValue
}) {
  return options
}
