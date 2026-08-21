import * as v from "valibot"
import type { Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationInvitationMeAcceptRequestSchema } from "../public/organizationInvitationMeAcceptRequestSchema.js"
import type { OrganizationInvitationMeAcceptResponse } from "../public/organizationInvitationMeAcceptResponseSchema.js"
import { organizationInvitationAccept } from "./organizationInvitationAccept.js"
import { organizationSubjectUserGet } from "./organizationSubjectUserGet.js"

type OrganizationInvitationMeAcceptOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly input: unknown
  readonly realmId: string
}

export function organizationInvitationMeAccept(
  options: OrganizationInvitationMeAcceptOptions,
): Result<OrganizationInvitationMeAcceptResponse> {
  const subject = organizationSubjectUserGet(options)
  if (!subject.success) return subject
  const parsed = v.safeParse(organizationInvitationMeAcceptRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(
      "organizationInvitationMeAccept",
      "The organization invitation acceptance is invalid.",
      "organizations.invalid",
    )
  return organizationInvitationAccept({
    database: options.database,
    input: { token: parsed.output.token, userId: subject.data.userId },
    subject: { email: subject.data.email, realmId: options.realmId, userId: subject.data.userId },
  })
}
