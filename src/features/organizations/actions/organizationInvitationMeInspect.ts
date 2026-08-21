import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationInvitationPublicViewCreate } from "../domain/organizationInvitationPublicViewCreate.js"
import { organizationInvitationTokenHashCreate } from "../domain/organizationInvitationTokenHashCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import {
  type OrganizationInvitationMeInspectRequest,
  organizationInvitationMeInspectRequestSchema,
} from "../public/organizationInvitationMeInspectRequestSchema.js"
import type { OrganizationInvitationMeInspectResponse } from "../public/organizationInvitationMeInspectResponseSchema.js"
import { organizationSubjectUserGet } from "./organizationSubjectUserGet.js"

type OrganizationInvitationMeInspectOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly input: OrganizationInvitationMeInspectRequest
  readonly realmId: string
}

export function organizationInvitationMeInspect(
  options: OrganizationInvitationMeInspectOptions,
): Result<OrganizationInvitationMeInspectResponse> {
  const op = "organizationInvitationMeInspect"
  const subject = organizationSubjectUserGet(options)
  if (!subject.success) return subject
  const parsed = v.safeParse(organizationInvitationMeInspectRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(op, "The organization invitation token is invalid.", "organizations.invalid")
  const repository = organizationRepositoryCreate(options.database.db)
  const invitation = repository.organizationInvitationGetByTokenHash(
    organizationInvitationTokenHashCreate(parsed.output.token),
  )
  if (!invitation.success) return invitation
  if (invitation.data === null || invitation.data.realmId !== options.realmId)
    return resultErrorCodedCreate(op, "The organization invitation was not found.", "organizations.not-found")
  if (invitation.data.status !== "pending" || invitation.data.email !== subject.data.email)
    return resultErrorCodedCreate(op, "The organization invitation was not found.", "organizations.not-found")
  const organization = repository.organizationGet(invitation.data.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.realmId !== options.realmId ||
    organization.data.status !== "active"
  )
    return resultErrorCodedCreate(op, "The organization invitation was not found.", "organizations.not-found")
  if (options.database.runtime.now() >= invitation.data.expiresAt)
    return resultErrorCodedCreate(op, "The organization invitation has expired.", "organizations.expired")
  const view = organizationInvitationPublicViewCreate(invitation.data)
  if (!view.success) return view
  return resultCreate({ invitation: view.data })
}
