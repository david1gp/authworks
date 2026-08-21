import type * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { organizationInvitationSchema } from "./organizationInvitationSchema.js"

export const organizationInvitationMeListResponseSchema = listResponseSchemaCreate(organizationInvitationSchema)

export type OrganizationInvitationMeListResponse = v.InferOutput<typeof organizationInvitationMeListResponseSchema>
