import {
  type AdminServiceListIDPsRequest,
  adminServiceListIDPs,
  type ListIDPsResponse,
} from "@adaptive-ds/zitadel-cli/legacy_v1"
import {
  type ApplicationServiceListApplicationsRequest,
  applicationServiceListApplications,
  type ListApplicationsResponse,
  type ListOrganizationDomainsResponse,
  type ListProjectGrantsResponse,
  type ListProjectRolesResponse,
  type ListProjectsResponse,
  type OrganizationServiceListOrganizationDomainsRequest,
  organizationServiceListOrganizationDomains,
  organizationServiceListOrganizations,
  type ProjectServiceListProjectGrantsRequest,
  type ProjectServiceListProjectRolesRequest,
  type ProjectServiceListProjectsRequest,
  projectServiceListProjectGrants,
  projectServiceListProjectRoles,
  projectServiceListProjects,
  type UserServiceListIDPLinksRequest,
  userServiceListIDPLinks,
  userServiceListUsers,
} from "@adaptive-ds/zitadel-cli/v2"
import { zitadelConfigSchema, type ZitadelConfig } from "@adaptive-ds/zitadel-cli/config"
import * as v from "valibot"
import type { Transport } from "@connectrpc/connect"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

type ZitadelRecord = Readonly<Record<string, unknown>>
type ZitadelApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
const paginationMaxPages = 10_000
const paginationMaxRecords = 1_000_000
const providerTemplateListResponseSchema = v.object({
  details: v.object({ totalResult: v.union([v.number(), v.string()]) }),
  result: v.array(v.record(v.string(), v.unknown())),
})

type ProviderTemplateScope =
  | { readonly kind: "instance" }
  | { readonly kind: "organization"; readonly organizationId: string }

export type ZitadelApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: ZitadelApiFetch
  readonly pageSize?: number
  readonly token: string
  readonly transport?: Transport
}

export function zitadelApiClientCreate(options: ZitadelApiClientCreateOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "")
  const fetcher = options.fetch ?? fetch
  const pageSize = options.pageSize ?? 100

  const parsedConfig = v.safeParse(zitadelConfigSchema, { baseUrl, token: options.token })
  const config: ZitadelConfig | undefined = parsedConfig.success ? parsedConfig.output : undefined
  const typed = {
    config,
    ...(options.transport === undefined ? {} : { transport: options.transport }),
  }
  const typedList = async (
    kind: "organizations" | "users",
    organizationId?: string,
  ): Promise<Result<ZitadelRecord[]>> => {
    const records: ZitadelRecord[] = []
    const seenPages = new Set<string>()
    const seenRecords = new Set<string>()
    let pages = 0
    let expectedTotal: number | undefined
    let rawRows = 0
    let offset = 0n
    for (;;) {
      if (++pages > paginationMaxPages || records.length > paginationMaxRecords)
        return sourceIncomplete("zitadelApiClientTypedList", "pagination budget exceeded")
      const request = {
        query: { asc: true, limit: pageSize, offset },
        ...(organizationId
          ? {
              sortingColumn: 1,
              queries: [
                { query: { case: "organizationIdQuery", value: { organizationId } } },
                { query: { case: "typeQuery", value: { type: 1 } } },
              ],
            }
          : {}),
      }
      const response =
        kind === "organizations"
          ? await organizationServiceListOrganizations({ ...typed, request: request as never })
          : await userServiceListUsers({ ...typed, request: request as never })
      if (!response.success)
        return resultErrorCodedCreate(
          "zitadelApiClientTypedList",
          response.errorMessage,
          "zitadel-migration.source-request-failed",
        )
      const typedResponse = response.data as {
        result?: readonly ZitadelRecord[]
        organizations?: readonly ZitadelRecord[]
        users?: readonly ZitadelRecord[]
      }
      const page = typedResponse.result ?? typedResponse.organizations ?? typedResponse.users ?? []
      const fingerprint = pageFingerprint(page)
      if (page.length > 0 && seenPages.has(fingerprint))
        return sourceIncomplete("zitadelApiClientTypedList", "page repeated")
      seenPages.add(fingerprint)
      rawRows += page.length
      const before = records.length
      for (const record of page.map((record) =>
        kind === "organizations"
          ? {
              ...record,
              id: record.organizationId ?? record.id,
              name: record.organizationName ?? record.name,
            }
          : record,
      )) {
        const id = stringGet(record.id) ?? recordFingerprint(record)
        if (seenRecords.has(id)) continue
        seenRecords.add(id)
        records.push(record)
      }
      const total = numberGet(response.data.details?.totalResult)
      if (page.length === 0 && expectedTotal !== undefined && rawRows < expectedTotal)
        return sourceIncomplete("zitadelApiClientTypedList", "premature empty page")
      if (page.length === 0 && (expectedTotal === undefined || rawRows >= expectedTotal)) return resultCreate(records)
      if (expectedTotal !== undefined && total !== undefined && total !== expectedTotal)
        return sourceIncomplete("zitadelApiClientTypedList", "totalResult changed")
      expectedTotal ??= total
      if (total !== undefined && total < rawRows)
        return sourceIncomplete("zitadelApiClientTypedList", "totalResult is inconsistent")
      if (page.length > 0 && records.length === before)
        return sourceIncomplete("zitadelApiClientTypedList", "page added no records")
      if (
        page.length === 0 ||
        (total !== undefined && rawRows >= total) ||
        (total === undefined && page.length < pageSize)
      )
        return resultCreate(records)
      const nextOffset = offset + BigInt(page.length)
      if (nextOffset <= offset) return sourceIncomplete("zitadelApiClientTypedList", "offset did not advance")
      offset = nextOffset
    }
  }

  const typedProjectsList = async (): Promise<Result<ZitadelRecord[]>> =>
    typedPaged(
      (request: ProjectServiceListProjectsRequest) => projectServiceListProjects({ ...typed, request }),
      (response: ListProjectsResponse) => response.projects,
      (record) => recordIdentityGet(record, "projectId"),
      [],
    )

  const typedProjectRolesList = async (projectId: string): Promise<Result<ZitadelRecord[]>> =>
    typedPaged(
      (request: ProjectServiceListProjectRolesRequest) => projectServiceListProjectRoles({ ...typed, request }),
      (response: ListProjectRolesResponse) => response.projectRoles,
      (record) => recordIdentityGet(record, "projectId", "key"),
      [],
      projectId,
    )

  const typedProjectGrantsList = async (): Promise<Result<ZitadelRecord[]>> =>
    typedPaged(
      (request: ProjectServiceListProjectGrantsRequest) => projectServiceListProjectGrants({ ...typed, request }),
      (response: ListProjectGrantsResponse) => response.projectGrants,
      (record) => recordIdentityGet(record, "organizationId", "projectId", "grantedOrganizationId"),
      [],
    )

  const typedApplicationsList = async (projectId: string): Promise<Result<ZitadelRecord[]>> =>
    typedPaged<ApplicationServiceListApplicationsRequest, ListApplicationsResponse>(
      (request) => applicationServiceListApplications({ ...typed, request: request as never }),
      (response) => response.applications.map(applicationNormalize),
      (record) => recordIdentityGet(record, "id"),
      [{ filter: { case: "projectIdFilter" as const, value: { projectId } } }],
      undefined,
      undefined,
      pageSize,
    )

  const typedDomainsList = async (organizationId: string): Promise<Result<ZitadelRecord[]>> =>
    typedPaged<OrganizationServiceListOrganizationDomainsRequest, ListOrganizationDomainsResponse>(
      (request) => organizationServiceListOrganizationDomains({ ...typed, request: request as never }),
      (response) =>
        response.domains.map((domain) => ({
          domain: domain.domain,
          id: domain.domain,
          organizationId: domain.organizationId || organizationId,
          isVerified: domain.isVerified,
          isPrimary: domain.isPrimary === true,
        })),
      (record) => recordIdentityGet(record, "id"),
      [],
      undefined,
      (request) => ({ ...(request as object), organizationId }) as OrganizationServiceListOrganizationDomainsRequest,
      pageSize,
    )

  const search = async (
    path: string,
    organizationId?: string,
    query: Readonly<Record<string, unknown>> = {},
  ): Promise<Result<ZitadelRecord[]>> => {
    const op = "zitadelApiClientSearch"
    if (options.token.length === 0)
      return resultErrorCodedCreate(
        op,
        "A ZITADEL service account token is required.",
        "zitadel-migration.credentials-required",
      )
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000)
      return resultErrorCodedCreate(op, "The ZITADEL page size is invalid.", "zitadel-migration.invalid")

    const records: ZitadelRecord[] = []
    const seen = new Set<string>()
    let pages = 0
    let expectedTotal: number | undefined
    let rawRows = 0
    let offset = 0
    for (;;) {
      if (++pages > paginationMaxPages || records.length > paginationMaxRecords)
        return sourceIncomplete(op, "pagination budget exceeded")
      let response: Response
      try {
        response = await fetcher(`${baseUrl}${path}`, {
          body: JSON.stringify({ query: { asc: true, limit: pageSize, offset, ...query } }),
          headers: {
            Authorization: `Bearer ${options.token}`,
            "Content-Type": "application/json",
            ...(organizationId === undefined ? {} : { "x-zitadel-orgid": organizationId }),
          },
          method: "POST",
        })
      } catch (_error) {
        return resultErrorCodedCreate(
          op,
          "The ZITADEL API could not be reached.",
          "zitadel-migration.source-unavailable",
        )
      }
      if (!response.ok)
        return resultErrorCodedCreate(
          op,
          `The ZITADEL API returned HTTP ${response.status}.`,
          "zitadel-migration.source-request-failed",
        )

      let payload: unknown
      try {
        payload = await response.json()
      } catch (_error) {
        return resultErrorCodedCreate(op, "The ZITADEL API response was not JSON.", "zitadel-migration.source-invalid")
      }
      const page = recordGet(payload)
      const pageRecords = page?.result === undefined && page?.details !== undefined ? [] : arrayRecordGet(page?.result)
      if (pageRecords === undefined)
        return resultErrorCodedCreate(
          op,
          "The ZITADEL API response had no result array.",
          "zitadel-migration.source-invalid",
        )
      const fingerprint = pageFingerprint(pageRecords)
      if (pageRecords.length > 0 && seen.has(fingerprint)) return sourceIncomplete(op, "page repeated")
      seen.add(fingerprint)
      rawRows += pageRecords.length
      const existing = new Set(records.map(recordFingerprint))
      records.push(...pageRecords)
      const added = pageRecords.filter((record) => !existing.has(recordFingerprint(record))).length

      const total = numberGet(page?.details && recordGet(page.details)?.totalResult)
      if (pageRecords.length === 0 && expectedTotal !== undefined && rawRows < expectedTotal)
        return sourceIncomplete(op, "premature empty page")
      if (pageRecords.length === 0 && (expectedTotal === undefined || rawRows >= expectedTotal))
        return resultCreate(records)
      if (expectedTotal !== undefined && total !== undefined && total !== expectedTotal)
        return sourceIncomplete(op, "totalResult changed")
      expectedTotal ??= total
      if (total !== undefined && total < rawRows) return sourceIncomplete(op, "totalResult is inconsistent")
      if (pageRecords.length > 0 && added === 0) return sourceIncomplete(op, "page added no records")
      if (
        pageRecords.length === 0 ||
        (total !== undefined && rawRows >= total) ||
        (total === undefined && pageRecords.length < pageSize)
      )
        return resultCreate(records)
      if (offset + pageRecords.length <= offset) return sourceIncomplete(op, "offset did not advance")
      offset += pageRecords.length
    }
  }

  const listByOrganizations = async (
    path: string,
    organizationIds: readonly string[],
    query: Readonly<Record<string, unknown>> = {},
  ): Promise<Result<ZitadelRecord[]>> => {
    const recordsById = new Map<string, ZitadelRecord>()
    const recordsWithoutId: ZitadelRecord[] = []
    let incomplete: Result<never> | undefined
    for (const organizationId of organizationIds) {
      const result = await search(path, organizationId, query)
      if (!result.success) {
        incomplete ??= result
        continue
      }
      for (const record of result.data) {
        const ownedRecord = { ...record, organizationId: record.organizationId ?? organizationId }
        const id = stringGet(record.id)
        if (id === undefined) recordsWithoutId.push(ownedRecord)
        else recordsById.set(id, ownedRecord)
      }
    }
    if (incomplete !== undefined) return incomplete
    return resultCreate([...recordsById.values(), ...recordsWithoutId])
  }

  return {
    async organizationsList(): Promise<Result<ZitadelRecord[]>> {
      return typedList("organizations")
    },

    async usersList(organizationIds: readonly string[]): Promise<Result<ZitadelRecord[]>> {
      const records: ZitadelRecord[] = []
      for (const organizationId of organizationIds) {
        const result = await typedList("users", organizationId)
        if (!result.success) return result
        records.push(
          ...result.data
            .filter((record) => (record.type as { case?: string } | undefined)?.case === "human")
            .map((record) => {
              const type = record.type as { value: Record<string, unknown> }
              return {
                ...record,
                id: record.userId,
                userName: record.username,
                human: { ...type.value, idpLinks: [] },
              }
            }),
        )
      }
      return resultCreate(records)
    },

    async userIdentityLinksList(userId: string): Promise<Result<ZitadelRecord[]>> {
      return typedPaged<UserServiceListIDPLinksRequest, unknown>(
        (request) => userServiceListIDPLinks({ ...typed, request }),
        (response) =>
          (response as { result: readonly { idpId: string; userId: string }[] }).result.map((link) => ({
            idpId: link.idpId,
            userId: link.userId,
          })),
        (record) => recordIdentityGet(record, "userId", "idpId"),
        [],
        undefined,
        (request) => ({ ...request, userId }) as typeof request,
        pageSize,
      )
    },

    async organizationMembershipsList(organizationId: string): Promise<Result<ZitadelRecord[]>> {
      return search("/management/v1/orgs/me/members/_search", organizationId)
    },

    async projectsList(organizationIds: readonly string[]): Promise<Result<ZitadelRecord[]>> {
      void organizationIds
      return typedProjectsList()
    },

    async projectRolesList(projectId: string, organizationId: string): Promise<Result<ZitadelRecord[]>> {
      void organizationId
      return typedProjectRolesList(projectId)
    },

    async projectGrantsList(organizationIds: readonly string[]): Promise<Result<ZitadelRecord[]>> {
      void organizationIds
      return typedProjectGrantsList()
    },

    async projectApplicationsList(projectId: string, organizationId: string): Promise<Result<ZitadelRecord[]>> {
      void organizationId
      return typedApplicationsList(projectId)
    },

    async machineUsersList(organizationIds: readonly string[]): Promise<Result<ZitadelRecord[]>> {
      const result = await listByOrganizations("/management/v1/users/_search", organizationIds, {
        typeQuery: { type: "TYPE_MACHINE" },
      })
      if (!result.success) return result
      return resultCreate(
        result.data.filter((record) => {
          const type = record.type
          return (
            type === "TYPE_MACHINE" ||
            (typeof type === "object" && type !== null && (type as { case?: string }).case === "machine") ||
            record.machine !== undefined
          )
        }),
      )
    },

    async organizationDomainsList(organizationId: string): Promise<Result<ZitadelRecord[]>> {
      return typedDomainsList(organizationId)
    },

    async organizationLoginPolicyGet(organizationId: string): Promise<Result<ZitadelRecord>> {
      const op = "zitadelApiClientOrganizationLoginPolicyGet"
      if (options.token.length === 0)
        return resultErrorCodedCreate(
          op,
          "A ZITADEL service account token is required.",
          "zitadel-migration.credentials-required",
        )
      try {
        const response = await fetcher(`${baseUrl}/management/v1/policies/login`, {
          headers: { Authorization: `Bearer ${options.token}`, "x-zitadel-orgid": organizationId },
          method: "GET",
        })
        if (!response.ok)
          return resultErrorCodedCreate(
            op,
            `The ZITADEL API returned HTTP ${response.status}.`,
            "zitadel-migration.source-request-failed",
          )
        const payload = recordGet(await response.json())
        const policy = recordGet(payload?.policy)
        // ZITADEL returns the effective default policy without an organization
        // override. Preserve that distinction for the exporter: it must not
        // turn an inherited policy into an organization snapshot row.
        if (policy === undefined && payload?.isDefault === true) return resultCreate({ isDefault: true })
        if (policy === undefined)
          return resultErrorCodedCreate(
            op,
            "The ZITADEL login policy response was malformed.",
            "zitadel-migration.source-invalid",
          )
        return resultCreate({
          ...policy,
          ...(typeof payload?.isDefault === "boolean" ? { isDefault: payload.isDefault } : {}),
        })
      } catch (_error) {
        return resultErrorCodedCreate(
          op,
          "The ZITADEL API could not be reached.",
          "zitadel-migration.source-unavailable",
        )
      }
    },

    async identityProvidersList(organizationIds: readonly string[]): Promise<Result<ZitadelRecord[]>> {
      // The typed package intentionally only exposes the legacy IDP listing. The
      // template endpoints are the source of truth for current installations and
      // are also the only listing that includes organization-owned templates.
      // Keep the transport-backed path for callers/tests that explicitly provide
      // a Connect transport for the legacy compatibility operation.
      if (options.transport === undefined)
        return identityProviderTemplatesList({
          baseUrl,
          fetcher,
          organizationIds,
          pageSize,
          token: options.token,
        })
      const organizationIdSet = new Set(organizationIds)
      const result = await typedPaged<AdminServiceListIDPsRequest, ListIDPsResponse>(
        (request) =>
          adminServiceListIDPs({
            ...typed,
            request,
          }),
        (response) =>
          response.result.map((idp) => {
            const config = idp.config.case === "oidcConfig" ? idp.config.value : undefined
            const provider = identityProviderTypeGet(config?.issuer)
            const owner = idp.owner === 2 ? idp.details?.resourceOwner : undefined
            return {
              id: idp.id,
              name: idp.name,
              ...(provider === undefined ? {} : { type: provider }),
              ...(config === undefined
                ? {}
                : { oidcConfig: { clientId: config.clientId, issuer: config.issuer, scopes: [...config.scopes] } }),
              ...(owner === undefined ? {} : { organizationId: owner }),
              autoRegister: idp.autoRegister,
              enabled: idp.state === 1,
              owner: idp.owner,
              ...(providerTemplateTimestampGet(idp.details?.creationDate) === undefined
                ? {}
                : { createdAt: providerTemplateTimestampGet(idp.details?.creationDate) }),
              ...(providerTemplateTimestampGet(idp.details?.changeDate) === undefined
                ? {}
                : { updatedAt: providerTemplateTimestampGet(idp.details?.changeDate) }),
            }
          }),
        (record) => recordIdentityGet(record, "id"),
        [],
        undefined,
        (request) => {
          const pagination = (request as unknown as { pagination?: { limit: number; offset: bigint } }).pagination
          return {
            query: { asc: true, limit: pagination?.limit ?? pageSize, offset: pagination?.offset ?? 0n },
            sortingColumn: 0,
            queries: [],
          } as AdminServiceListIDPsRequest
        },
        pageSize,
      )
      if (!result.success) return result
      return resultCreate(
        result.data.filter((record) => {
          const organizationId = stringGet(record.organizationId)
          return organizationId === undefined || organizationIdSet.has(organizationId)
        }),
      )
    },
  }
}

function identityProviderTypeGet(issuer: string | undefined): "GOOGLE" | "GITHUB" | "MICROSOFT" | undefined {
  const normalized = issuer?.trim().replace(/\/+$/, "").toLowerCase()
  if (normalized === "https://accounts.google.com") return "GOOGLE"
  if (normalized === "https://github.com") return "GITHUB"
  if (normalized?.startsWith("https://login.microsoftonline.com/") && normalized.endsWith("/v2.0")) return "MICROSOFT"
  return undefined
}

async function identityProviderTemplatesList(options: {
  readonly baseUrl: string
  readonly fetcher: ZitadelApiFetch
  readonly organizationIds: readonly string[]
  readonly pageSize: number
  readonly token: string
}): Promise<Result<ZitadelRecord[]>> {
  const instanceResult = await identityProviderTemplatesSearch({
    baseUrl: options.baseUrl,
    fetcher: options.fetcher,
    pageSize: options.pageSize,
    scope: { kind: "instance" },
    token: options.token,
  })
  if (!instanceResult.success) return instanceResult

  const organizationIdSet = new Set(options.organizationIds)
  const candidates: ZitadelRecord[] = instanceResult.data.filter((record) => {
    const organizationId = stringGet(record.organizationId)
    return organizationId === undefined || organizationIdSet.has(organizationId)
  })
  for (const organizationId of options.organizationIds) {
    const organizationResult = await identityProviderTemplatesSearch({
      baseUrl: options.baseUrl,
      fetcher: options.fetcher,
      pageSize: options.pageSize,
      scope: { kind: "organization", organizationId },
      token: options.token,
    })
    if (!organizationResult.success) return organizationResult
    candidates.push(...organizationResult.data)
  }

  const providers = new Map<string, ZitadelRecord>()
  for (const candidate of candidates) {
    const sourceId = stringGet(candidate.id)
    if (sourceId === undefined)
      return sourceIncomplete("zitadelApiClientIdentityProviderTemplates", "provider id missing")
    const prior = providers.get(sourceId)
    if (prior === undefined) {
      providers.set(sourceId, candidate)
      continue
    }
    const priorOrganizationId = stringGet(prior.organizationId)
    const organizationId = stringGet(candidate.organizationId)
    // An instance-owned provider is inherited into every organization response.
    // Deduplicate that copy without assigning it the queried organization.
    if (priorOrganizationId === undefined && organizationId === undefined) continue
    if (priorOrganizationId !== undefined && priorOrganizationId === organizationId) continue
    return sourceIncomplete("zitadelApiClientIdentityProviderTemplates", "provider ownership conflicted")
  }
  return resultCreate([...providers.values()])
}

async function identityProviderTemplatesSearch(options: {
  readonly baseUrl: string
  readonly fetcher: ZitadelApiFetch
  readonly pageSize: number
  readonly scope: ProviderTemplateScope
  readonly token: string
}): Promise<Result<ZitadelRecord[]>> {
  const op = "zitadelApiClientIdentityProviderTemplates"
  if (options.token.length === 0)
    return resultErrorCodedCreate(
      op,
      "A ZITADEL service account token is required.",
      "zitadel-migration.credentials-required",
    )
  if (!Number.isSafeInteger(options.pageSize) || options.pageSize < 1 || options.pageSize > 1000)
    return resultErrorCodedCreate(op, "The ZITADEL page size is invalid.", "zitadel-migration.invalid")

  const path =
    options.scope.kind === "instance" ? "/admin/v1/idps/templates/_search" : "/management/v1/idps/templates/_search"
  const records: ZitadelRecord[] = []
  const seenIds = new Set<string>()
  const seenPages = new Set<string>()
  let expectedTotal: number | undefined
  let rawRows = 0
  let pageNumber = 0
  for (;;) {
    if (++pageNumber > paginationMaxPages || records.length > paginationMaxRecords)
      return sourceIncomplete(op, "pagination budget exceeded")
    let response: Response
    try {
      response = await options.fetcher(`${options.baseUrl}${path}`, {
        body: JSON.stringify({
          query: { asc: true, limit: options.pageSize, offset: (pageNumber - 1) * options.pageSize },
          queries: [],
        }),
        headers: {
          Authorization: `Bearer ${options.token}`,
          "Content-Type": "application/json",
          ...(options.scope.kind === "organization" ? { "x-zitadel-orgid": options.scope.organizationId } : {}),
        },
        method: "POST",
      })
    } catch (_error) {
      return resultErrorCodedCreate(op, "The ZITADEL API could not be reached.", "zitadel-migration.source-unavailable")
    }
    if (!response.ok)
      return resultErrorCodedCreate(
        op,
        `The ZITADEL API returned HTTP ${response.status}.`,
        "zitadel-migration.source-request-failed",
      )

    let payload: unknown
    try {
      payload = await response.json()
    } catch (_error) {
      return resultErrorCodedCreate(op, "The ZITADEL API response was not JSON.", "zitadel-migration.source-invalid")
    }
    const parsed = v.safeParse(providerTemplateListResponseSchema, payload)
    if (!parsed.success)
      return resultErrorCodedCreate(
        op,
        "The ZITADEL identity provider template response was malformed.",
        "zitadel-migration.source-invalid",
      )

    const page: ZitadelRecord[] = []
    for (const raw of parsed.output.result) {
      const mapped = identityProviderTemplateMap(raw, options.scope)
      if (!mapped.success) return mapped
      page.push(mapped.data)
    }
    const fingerprint = pageFingerprint(page)
    if (page.length > 0 && seenPages.has(fingerprint)) return sourceIncomplete(op, "page repeated")
    seenPages.add(fingerprint)
    const total = numberGet(parsed.output.details.totalResult)
    if (total === undefined) return sourceIncomplete(op, "totalResult invalid")
    if (expectedTotal !== undefined && total !== expectedTotal) return sourceIncomplete(op, "totalResult changed")
    expectedTotal ??= total
    rawRows += page.length
    if (total < rawRows) return sourceIncomplete(op, "totalResult is inconsistent")
    for (const record of page) {
      const sourceId = stringGet(record.id)
      if (sourceId === undefined) return sourceIncomplete(op, "provider id missing")
      if (seenIds.has(sourceId)) return sourceIncomplete(op, "provider repeated across pages")
      seenIds.add(sourceId)
      records.push(record)
    }
    if (rawRows === total) return resultCreate(records)
    if (page.length === 0 || page.length < options.pageSize) return sourceIncomplete(op, "partial page")
  }
}

function identityProviderTemplateMap(raw: ZitadelRecord, scope: ProviderTemplateScope): Result<ZitadelRecord> {
  const sourceId = stringGet(raw.id)
  const name = stringGet(raw.name)
  const owner = providerTemplateOwnerGet(raw.owner)
  const type = providerTemplateTypeGet(raw.type)
  const enabled = providerTemplateEnabledGet(raw.state)
  if (sourceId === undefined)
    return sourceIncomplete("zitadelApiClientIdentityProviderTemplates", "provider id missing")
  if (name === undefined) return sourceIncomplete("zitadelApiClientIdentityProviderTemplates", "provider name missing")
  if (owner === undefined)
    return sourceIncomplete("zitadelApiClientIdentityProviderTemplates", "provider owner missing")
  if (type === undefined) return sourceIncomplete("zitadelApiClientIdentityProviderTemplates", "provider type missing")
  if (enabled === undefined)
    return sourceIncomplete("zitadelApiClientIdentityProviderTemplates", "provider state unsupported")

  const details = recordGet(raw.details)
  const resourceOwner = stringGet(details?.resourceOwner)
  if (owner === "organization") {
    if (resourceOwner === undefined)
      return sourceIncomplete("zitadelApiClientIdentityProviderTemplates", "organization owner missing")
    if (scope.kind === "organization" && resourceOwner !== scope.organizationId)
      return sourceIncomplete("zitadelApiClientIdentityProviderTemplates", "organization owner conflicted")
  }

  const configuration = providerTemplateConfigurationGet(type, recordGet(raw.config))
  return resultCreate({
    id: sourceId,
    name,
    type: configuration.type ?? type,
    owner: owner === "organization" ? "IDP_OWNER_TYPE_ORG" : "IDP_OWNER_TYPE_SYSTEM",
    enabled,
    ...(owner === "organization" && resourceOwner === undefined
      ? {}
      : owner === "organization"
        ? { organizationId: resourceOwner }
        : {}),
    ...(configuration.oidcConfig === undefined ? {} : { oidcConfig: configuration.oidcConfig }),
    ...(configuration.allowAccountCreation === undefined
      ? {}
      : { allowAccountCreation: configuration.allowAccountCreation }),
    ...(providerTemplateTimestampGet(details?.creationDate) === undefined
      ? {}
      : { createdAt: providerTemplateTimestampGet(details?.creationDate) }),
    ...(providerTemplateTimestampGet(details?.changeDate) === undefined
      ? {}
      : { updatedAt: providerTemplateTimestampGet(details?.changeDate) }),
  })
}

function providerTemplateOwnerGet(value: unknown): "system" | "organization" | undefined {
  if (value === 1 || value === "IDP_OWNER_TYPE_SYSTEM" || value === "system" || value === "SYSTEM") return "system"
  if (value === 2 || value === "IDP_OWNER_TYPE_ORG" || value === "organization" || value === "ORG")
    return "organization"
  return undefined
}

function providerTemplateTypeGet(value: unknown): string | undefined {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : undefined
  if (value === 1 || normalized === "PROVIDER_TYPE_OIDC" || normalized === "OIDC") return "OIDC"
  if (value === 2 || normalized === "PROVIDER_TYPE_JWT" || normalized === "JWT") return "JWT"
  if (value === 3 || normalized === "PROVIDER_TYPE_LDAP" || normalized === "LDAP") return "LDAP"
  if (value === 4 || normalized === "PROVIDER_TYPE_OAUTH" || normalized === "OAUTH") return "OAUTH"
  if (value === 5 || normalized === "PROVIDER_TYPE_AZURE_AD" || normalized === "AZURE_AD" || normalized === "MICROSOFT")
    return "AZURE_AD"
  if (value === 6 || normalized === "PROVIDER_TYPE_GITHUB" || normalized === "GITHUB") return "GITHUB"
  if (value === 7 || normalized === "PROVIDER_TYPE_GITHUB_ES" || normalized === "GITHUB_ES") return "GITHUB_ES"
  if (value === 8 || normalized === "PROVIDER_TYPE_GITLAB" || normalized === "GITLAB") return "GITLAB"
  if (value === 9 || normalized === "PROVIDER_TYPE_GITLAB_SELF_HOSTED" || normalized === "GITLAB_SELF_HOSTED")
    return "GITLAB_SELF_HOSTED"
  if (value === 10 || normalized === "PROVIDER_TYPE_GOOGLE" || normalized === "GOOGLE") return "GOOGLE"
  if (value === 11 || normalized === "PROVIDER_TYPE_APPLE" || normalized === "APPLE") return "APPLE"
  if (value === 12 || normalized === "PROVIDER_TYPE_SAML" || normalized === "SAML") return "SAML"
  if (value === 13 || normalized === "PROVIDER_TYPE_ZITADEL" || normalized === "ZITADEL") return "ZITADEL"
  if (typeof value === "number" && Number.isInteger(value)) return `__numeric_${value}`
  return normalized === undefined || normalized.length === 0 ? undefined : normalized
}

function providerTemplateEnabledGet(value: unknown): boolean | undefined {
  if (value === 1 || value === "IDP_STATE_ACTIVE" || value === "active" || value === "ACTIVE") return true
  if (value === 2 || value === "IDP_STATE_INACTIVE" || value === "inactive" || value === "INACTIVE") return false
  return undefined
}

function providerTemplateConfigurationGet(
  type: string,
  config: ZitadelRecord | undefined,
): {
  readonly allowAccountCreation?: boolean
  readonly oidcConfig?: ZitadelRecord
  readonly type?: string
} {
  if (config === undefined) return {}
  const nested = recordGet(config.config)
  const oneof = nested ?? config
  const options = recordGet(config.options) ?? recordGet(nested?.options)
  const allowAccountCreation = typeof options?.isCreationAllowed === "boolean" ? options.isCreationAllowed : undefined
  const oneofValue = providerTemplateOneofGet(oneof)
  if (oneofValue === undefined) return { ...(allowAccountCreation === undefined ? {} : { allowAccountCreation }) }
  const nativeType =
    oneofValue.case === "google"
      ? "GOOGLE"
      : oneofValue.case === "github"
        ? "GITHUB"
        : oneofValue.case === "azureAd"
          ? "AZURE_AD"
          : undefined
  if (nativeType !== undefined) {
    if (type !== nativeType) return { ...(allowAccountCreation === undefined ? {} : { allowAccountCreation }) }
    const oidcConfig = providerTemplateOidcConfigGet(oneofValue.value)
    return {
      ...(allowAccountCreation === undefined ? {} : { allowAccountCreation }),
      ...(oidcConfig === undefined ? {} : { oidcConfig }),
    }
  }
  if (oneofValue.case !== "oidc") return { ...(allowAccountCreation === undefined ? {} : { allowAccountCreation }) }
  const oidcConfig = providerTemplateOidcConfigGet(oneofValue.value, true)
  const issuerType = identityProviderTypeGet(stringGet(oneofValue.value.issuer))
  return {
    ...(allowAccountCreation === undefined ? {} : { allowAccountCreation }),
    ...(oidcConfig === undefined ? {} : { oidcConfig }),
    ...(type === "OIDC" && issuerType !== undefined ? { type: issuerType } : {}),
  }
}

function providerTemplateOneofGet(
  config: ZitadelRecord,
): { readonly case: string; readonly value: ZitadelRecord } | undefined {
  const caseName = stringGet(config.case)
  const caseValue = recordGet(config.value)
  if (caseName !== undefined && caseValue !== undefined) return { case: caseName, value: caseValue }
  for (const name of ["google", "github", "azureAd", "oidc", "saml", "oauth", "jwt", "ldap", "apple", "zitadel"]) {
    const value = recordGet(config[name])
    if (value !== undefined) return { case: name, value }
  }
  return undefined
}

function providerTemplateOidcConfigGet(value: ZitadelRecord, includeIssuer = false): ZitadelRecord | undefined {
  const clientId = stringGet(value.clientId)
  if (clientId === undefined) return undefined
  const scopes = providerTemplateScopesGet(value.scopes)
  if (value.scopes !== undefined && scopes === undefined) return undefined
  const issuer = stringGet(value.issuer)
  if (includeIssuer && issuer === undefined) return undefined
  return {
    clientId,
    ...(scopes === undefined ? {} : { scopes }),
    ...(includeIssuer && issuer !== undefined ? { issuer } : {}),
  }
}

function providerTemplateScopesGet(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const scopes: string[] = []
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) return undefined
    const scope = item.trim()
    if (!scopes.includes(scope)) scopes.push(scope)
  }
  return scopes
}

function providerTemplateTimestampGet(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : undefined
  if (typeof value === "string") {
    const numeric = /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : Date.parse(value)
    return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : undefined
  }
  const record = recordGet(value)
  if (record === undefined) return undefined
  const seconds = numberGet(record.seconds)
  const nanos = numberGet(record.nanos) ?? 0
  return seconds === undefined || !Number.isSafeInteger(seconds * 1000 + Math.floor(nanos / 1_000_000))
    ? undefined
    : seconds * 1000 + Math.floor(nanos / 1_000_000)
}

function recordGet(value: unknown): ZitadelRecord | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined
  return value as ZitadelRecord
}

function arrayRecordGet(value: unknown): ZitadelRecord[] | undefined {
  if (!Array.isArray(value)) return undefined
  const records: ZitadelRecord[] = []
  for (const item of value) {
    const record = recordGet(item)
    if (record === undefined) return undefined
    records.push(record)
  }
  return records
}

function stringGet(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function numberGet(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value
  if (typeof value === "bigint" && value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value)
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value)
    if (Number.isSafeInteger(parsed)) return parsed
  }
  return undefined
}

async function typedPaged<TRequest, TResponse>(
  call: (request: TRequest) => Promise<Result<TResponse>>,
  recordsGet: (response: TResponse) => readonly ZitadelRecord[],
  identityGet: (record: ZitadelRecord) => string | undefined,
  filters: readonly unknown[],
  projectId?: string,
  requestTransform?: (request: TRequest) => TRequest,
  pageSize = 100,
): Promise<Result<ZitadelRecord[]>> {
  const records = new Map<string, ZitadelRecord>()
  const anonymous: ZitadelRecord[] = []
  const seen = new Set<string>()
  let pages = 0
  let expectedTotal: bigint | undefined
  let rawRows = 0n
  let offset = 0n
  for (;;) {
    if (++pages > paginationMaxPages || records.size + anonymous.length > paginationMaxRecords)
      return sourceIncomplete("zitadelApiClientTypedList", "pagination budget exceeded")
    const requestBase = {
      ...(projectId === undefined ? {} : { projectId }),
      filters: [...filters],
      pagination: { asc: true, limit: pageSize, offset },
    } as unknown as TRequest
    const request = requestTransform?.(requestBase) ?? requestBase
    let result: Result<TResponse>
    try {
      result = await call(request)
    } catch (_error) {
      return resultErrorCodedCreate(
        "zitadelApiClientTypedList",
        "The ZITADEL v2 API could not be reached.",
        "zitadel-migration.source-unavailable",
      )
    }
    if (!result.success)
      return resultErrorCodedCreate(
        "zitadelApiClientTypedList",
        result.errorMessage,
        "zitadel-migration.source-request-failed",
      )
    let page: readonly ZitadelRecord[]
    try {
      page = recordsGet(result.data)
    } catch (_error) {
      return resultErrorCodedCreate(
        "zitadelApiClientTypedList",
        "The ZITADEL v2 API response was malformed.",
        "zitadel-migration.source-invalid",
      )
    }
    const fingerprint = pageFingerprint(page)
    if (page.length > 0 && seen.has(fingerprint)) return sourceIncomplete("zitadelApiClientTypedList", "page repeated")
    seen.add(fingerprint)
    rawRows += BigInt(page.length)
    const before = records.size + anonymous.length
    for (const record of page) {
      const id = identityGet(record)
      if (id === undefined) anonymous.push(record)
      else if (!records.has(id)) records.set(id, record)
    }
    const pagination = (result.data as { pagination?: { totalResult?: bigint; appliedLimit?: bigint } }).pagination
    const total = pagination?.totalResult
    if (page.length === 0 && expectedTotal !== undefined && rawRows < expectedTotal)
      return sourceIncomplete("zitadelApiClientTypedList", "premature empty page")
    if (page.length === 0 && (expectedTotal === undefined || rawRows >= expectedTotal))
      return resultCreate([...records.values(), ...anonymous])
    if (expectedTotal !== undefined && total !== undefined && total !== expectedTotal)
      return sourceIncomplete("zitadelApiClientTypedList", "totalResult changed")
    expectedTotal ??= total
    const fetched = records.size + anonymous.length
    if (total !== undefined && total < rawRows)
      return sourceIncomplete("zitadelApiClientTypedList", "totalResult is inconsistent")
    if (page.length > 0 && fetched === before)
      return sourceIncomplete("zitadelApiClientTypedList", "page added no records")
    if ((total !== undefined && rawRows >= total) || (total === undefined && page.length < pageSize))
      return resultCreate([...records.values(), ...anonymous])
    if (offset + BigInt(page.length) <= offset)
      return sourceIncomplete("zitadelApiClientTypedList", "offset did not advance")
    offset += BigInt(page.length)
  }
}

function sourceIncomplete(op: string, reason: string): Result<never> {
  return resultErrorCodedCreate(
    op,
    `The ZITADEL source export is incomplete (${reason}).`,
    "zitadel-migration.source-incomplete",
  )
}

function recordIdentityGet(record: ZitadelRecord, ...fields: readonly string[]): string | undefined {
  const values = fields.map((field) => stringGet(record[field]))
  if (values.some((value) => value === undefined)) return undefined
  return values.join("\u0000")
}

function recordFingerprint(record: ZitadelRecord): string {
  return stableSerialize(record)
}

function pageFingerprint(records: readonly ZitadelRecord[]): string {
  return stableSerialize(records)
}

function stableSerialize(value: unknown): string {
  // Protobuf's 64-bit fields are bigint at runtime. Keep this serializer
  // private to fingerprints: snapshot JSON must retain its existing shape.
  if (typeof value === "bigint") return `{"$bigint":${JSON.stringify(value.toString())}}`
  if (value === undefined) return "undefined"
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined"
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`
}

function applicationNormalize(application: Record<string, unknown>): ZitadelRecord {
  const configuration = application.configuration as { case?: string; value?: Record<string, unknown> } | undefined
  const direct = application.oidcConfiguration
  const oidc =
    configuration?.case === "oidcConfiguration"
      ? configuration.value === undefined
        ? undefined
        : {
            ...configuration.value,
            // Generated protobuf messages omit enum fields whose value is zero.
            ...(configuration.value.authMethodType === undefined ? { authMethodType: 0 } : {}),
            ...(configuration.value.applicationType === undefined ? { applicationType: 0 } : {}),
          }
      : direct !== null && typeof direct === "object"
        ? (direct as Record<string, unknown>)
        : undefined
  return {
    id: application.applicationId,
    name: application.name,
    projectId: application.projectId,
    state: application.state,
    creationDate: application.creationDate,
    changeDate: application.changeDate,
    // Keep the wire discriminator: the exporter must classify every source
    // application before attempting to map it.  The generated client exposes
    // it as the oneof case, while hand-shaped/direct responses expose it on
    // the application itself (or its direct configuration).
    ...(application.applicationType === undefined && configuration?.case !== undefined
      ? { applicationType: configuration.case.replace(/Configuration$/, "").toLowerCase() }
      : application.applicationType === undefined &&
          direct !== null &&
          typeof direct === "object" &&
          (direct as Record<string, unknown>).applicationType !== undefined
        ? { applicationType: (direct as Record<string, unknown>).applicationType }
        : application.applicationType === undefined
          ? {}
          : { applicationType: application.applicationType }),
    ...(oidc === undefined ? {} : { oidcConfig: oidc }),
  }
}
