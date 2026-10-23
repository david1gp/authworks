import * as v from "valibot"
import { directoryMembershipSchema } from "./directoryMembershipSchema.js"
import { directoryProjectAssignmentRoleSchema } from "./directoryProjectAssignmentRoleSchema.js"

export const directoryProjectAssignmentSchema = v.strictObject({
  assignmentId: v.pipe(v.string(), v.minLength(1)),
  projectId: v.pipe(v.string(), v.minLength(1)),
  projectName: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  projectOrganizationId: v.pipe(v.string(), v.minLength(1)),
  roleKeys: v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  roles: v.array(directoryProjectAssignmentRoleSchema),
})

export const directoryUserAccessSchema = v.strictObject({
  memberships: v.array(directoryMembershipSchema),
  projectAssignments: v.array(directoryProjectAssignmentSchema),
  realmAdministrator: v.boolean(),
})

export type DirectoryUserAccess = v.InferOutput<typeof directoryUserAccessSchema>
export type DirectoryProjectAssignment = v.InferOutput<typeof directoryProjectAssignmentSchema>
