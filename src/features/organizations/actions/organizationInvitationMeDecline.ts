import * as v from "valibot"
import type { Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationInvitationMeDeclineRequestSchema } from "../public/organizationInvitationMeDeclineRequestSchema.js"
import type { OrganizationInvitationMeDeclineResponse } from "../public/organizationInvitationMeDeclineResponseSchema.js"
import { organizationInvitationDecline } from "./organizationInvitationDecline.js"
import { organizationSubjectUserGet } from "./organizationSubjectUserGet.js"

type OrganizationInvitationMeDeclineOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly input: unknown
  readonly realmId: string
}

export function organizationInvitationMeDecline(
  options: OrganizationInvitationMeDeclineOptions,
): Result<OrganizationInvitationMeDeclineResponse> {
  const subject = organizationSubjectUserGet(options)
  if (!subject.success) return subject
  const parsed = v.safeParse(organizationInvitationMeDeclineRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(
      "organizationInvitationMeDecline",
      "The organization invitation decline is invalid.",
      "organizations.invalid",
    )
  return organizationInvitationDecline({
    database: options.database,
    input: { token: parsed.output.token, userId: subject.data.userId },
    subject: { email: subject.data.email, realmId: options.realmId, userId: subject.data.userId },
  })
}
