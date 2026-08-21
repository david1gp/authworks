import * as v from "valibot"
import type { Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationMeSwitchRequestSchema } from "../public/organizationMeSwitchRequestSchema.js"
import type { OrganizationMeSwitchResponse } from "../public/organizationMeSwitchResponseSchema.js"
import { organizationSubjectUserGet } from "./organizationSubjectUserGet.js"
import { organizationSwitch } from "./organizationSwitch.js"

type OrganizationMeSwitchOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly input: unknown
  readonly realmId: string
}

export function organizationMeSwitch(options: OrganizationMeSwitchOptions): Result<OrganizationMeSwitchResponse> {
  const op = "organizationMeSwitch"
  const subject = organizationSubjectUserGet(options)
  if (!subject.success) return subject
  const parsed = v.safeParse(organizationMeSwitchRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(op, "The organization switch request is invalid.", "organizations.invalid")
  return organizationSwitch({
    context: options.context,
    database: options.database,
    input: parsed.output,
    realmId: options.realmId,
  })
}
