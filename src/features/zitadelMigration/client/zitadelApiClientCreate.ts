import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

type ZitadelRecord = Readonly<Record<string, unknown>>
type ZitadelApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type ZitadelApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: ZitadelApiFetch
  readonly pageSize?: number
  readonly token: string
}

export function zitadelApiClientCreate(options: ZitadelApiClientCreateOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "")
  const fetcher = options.fetch ?? fetch
  const pageSize = options.pageSize ?? 100

  const search = async (path: string, organizationId?: string): Promise<Result<ZitadelRecord[]>> => {
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
    let offset = 0
    for (;;) {
      let response: Response
      try {
        response = await fetcher(`${baseUrl}${path}`, {
          body: JSON.stringify({ query: { asc: true, limit: pageSize, offset } }),
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
      records.push(...pageRecords)

      const total = numberGet(page?.details && recordGet(page.details)?.totalResult)
      if (pageRecords.length === 0 || pageRecords.length < pageSize || (total !== undefined && records.length >= total))
        return resultCreate(records)
      offset += pageRecords.length
    }
  }

  const listByOrganizations = async (
    path: string,
    organizationIds: readonly string[],
  ): Promise<Result<ZitadelRecord[]>> => {
    const recordsById = new Map<string, ZitadelRecord>()
    const recordsWithoutId: ZitadelRecord[] = []
    for (const organizationId of organizationIds) {
      const result = await search(path, organizationId)
      if (!result.success) return result
      for (const record of result.data) {
        const id = stringGet(record.id)
        if (id === undefined) recordsWithoutId.push(record)
        else recordsById.set(id, record)
      }
    }
    return resultCreate([...recordsById.values(), ...recordsWithoutId])
  }

  return {
    async organizationsList(): Promise<Result<ZitadelRecord[]>> {
      return search("/admin/v1/orgs/_search")
    },

    async usersList(organizationIds: readonly string[]): Promise<Result<ZitadelRecord[]>> {
      return listByOrganizations("/management/v1/users/_search", organizationIds)
    },

    async organizationMembershipsList(organizationId: string): Promise<Result<ZitadelRecord[]>> {
      return search("/management/v1/orgs/me/members/_search", organizationId)
    },

    async projectsList(organizationIds: readonly string[]): Promise<Result<ZitadelRecord[]>> {
      return listByOrganizations("/management/v1/projects/_search", organizationIds)
    },

    async projectRolesList(projectId: string, organizationId: string): Promise<Result<ZitadelRecord[]>> {
      return search(`/management/v1/projects/${encodeURIComponent(projectId)}/roles/_search`, organizationId)
    },

    async projectGrantsList(organizationIds: readonly string[]): Promise<Result<ZitadelRecord[]>> {
      return listByOrganizations("/management/v1/projectgrants/_search", organizationIds)
    },
  }
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
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value)
    if (Number.isSafeInteger(parsed)) return parsed
  }
  return undefined
}
