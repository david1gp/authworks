import type * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { organizationInvitationSchema } from "./organizationInvitationSchema.js"

export const organizationInvitationListResponseSchema = listResponseSchemaCreate(organizationInvitationSchema)

export type OrganizationInvitationListResponse = v.InferOutput<typeof organizationInvitationListResponseSchema>
