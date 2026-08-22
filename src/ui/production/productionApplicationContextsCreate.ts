import * as v from "valibot"
import { organizationDiscoveryResponseSchema } from "../../features/organizations/public/organizationDiscoveryResponseSchema.js"
import { organizationMeListResponseSchema } from "../../features/organizations/public/organizationMeListResponseSchema.js"
import { organizationResourceIdSchema } from "../../features/organizations/public/organizationResourceIdSchema.js"
import { realmResponseSchema } from "../../features/realms/public/realmResponseSchema.js"
import { sessionSchema } from "../../features/sessions/public/sessionSchema.js"
import { userResponseSchema } from "../../features/users/public/userResponseSchema.js"
import type { ProductionApiContextValue } from "./productionApiContextValue.js"
import type { ProductionSessionContextValue } from "./productionSessionContextValue.js"

const sessionCurrentResponseSchema = v.strictObject({ session: sessionSchema })

export async function productionApplicationContextsCreate(): Promise<{
  readonly api: ProductionApiContextValue
  readonly session: ProductionSessionContextValue
}> {
  const discovery = await productionJsonGet("/organization-discovery", organizationDiscoveryResponseSchema)
  if (discovery === undefined || !discovery.found) return productionAnonymousContextsCreate()

  const realmId = discovery.organization.realmId
  const current = await productionJsonGet(
    `/realms/${encodeURIComponent(realmId)}/sessions/current`,
    sessionCurrentResponseSchema,
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
      ? await productionJsonGet(`/realms/${encodeURIComponent(realmId)}/me`, userResponseSchema)
      : undefined
  const memberships =
    session.subjectType === "user"
      ? await productionJsonGet(
          `/realms/${encodeURIComponent(realmId)}/me/organizations`,
          organizationMeListResponseSchema,
        )
      : undefined
  const realm = await productionJsonGet(`/realms/${encodeURIComponent(realmId)}`, realmResponseSchema)
  const organizations = memberships?.items.map((item) => ({
    id: item.organization.id,
    label: item.organization.name,
  })) ?? [{ id: discovery.organization.id, label: discovery.organization.name }]
  const requestedOrganization = v.safeParse(
    organizationResourceIdSchema,
    new URL(window.location.href).searchParams.get("organization"),
  )
  const selectedOrganization =
    organizations.find((item) => item.id === (requestedOrganization.success ? requestedOrganization.output : "")) ??
    organizations.find((item) => item.id === discovery.organization.id) ??
    organizations[0]

  return productionContextsCreate({
    api: { content: "ready", retry: () => undefined },
    session: {
      actorLabel: user?.user.profile.displayName ?? user?.user.email ?? "Administrator",
      guard: {
        authentication: { status: "authenticated", userId: session.userId ?? session.subjectId },
        organization:
          selectedOrganization === undefined
            ? "missing"
            : { organizationId: selectedOrganization.id, status: "available" },
        permission: realm === undefined ? "denied" : "granted",
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
      organizationSelect: (organizationId) => {
        const selected = v.safeParse(organizationResourceIdSchema, organizationId)
        if (!selected.success) return
        const next = new URL(window.location.href)
        next.searchParams.set("organization", selected.output)
        window.location.assign(next)
      },
      realms: [{ id: realmId, label: realm?.realm.name ?? realmId }],
      realmSelect: () => window.location.reload(),
    },
  })
}

async function productionJsonGet<T>(path: string, schema: v.GenericSchema<T>): Promise<T | undefined> {
  try {
    const response = await fetch(path, { credentials: "include" })
    if (!response.ok) return undefined
    const parsed = v.safeParse(schema, await response.json())
    return parsed.success ? parsed.output : undefined
  } catch (_error) {
    return undefined
  }
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
      organizationSelect: () => undefined,
      realms: [],
      realmSelect: () => undefined,
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
    organizationSelect: () => undefined,
    realms: [{ id: realmId, label: realmId }],
    realmSelect: () => undefined,
  } satisfies ProductionSessionContextValue
}

function productionContextsCreate(options: {
  readonly api: ProductionApiContextValue
  readonly session: ProductionSessionContextValue
}) {
  return options
}
