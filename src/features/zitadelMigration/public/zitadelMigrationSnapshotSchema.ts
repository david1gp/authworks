import * as v from "valibot"
import { organizationResourceIdSchema } from "../../organizations/public/organizationResourceIdSchema.js"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"

const timestampSchema = v.pipe(v.number(), v.integer(), v.minValue(0))
const nullableTimestampSchema = v.nullable(timestampSchema)
const profileTextSchema = v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(128)))
const nullableTextSchema = v.nullable(v.pipe(v.string(), v.maxLength(320)))
const projectRoleTextSchema = v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(200)))

const userProfileSchema = v.strictObject({
  displayName: profileTextSchema,
  firstName: profileTextSchema,
  gender: v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(64))),
  lastName: profileTextSchema,
  nickName: profileTextSchema,
  preferredLanguage: v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(16))),
})

const userSchema = v.strictObject({
  createdAt: timestampSchema,
  deletedAt: nullableTimestampSchema,
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  emailVerified: v.boolean(),
  emailVerifiedAt: nullableTimestampSchema,
  id: userResourceIdSchema,
  profile: userProfileSchema,
  state: v.picklist(["initial", "active", "inactive", "locked", "suspended", "deleted"]),
  updatedAt: timestampSchema,
  userName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
})

const organizationSchema = v.strictObject({
  createdAt: timestampSchema,
  id: organizationResourceIdSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  status: v.picklist(["active", "inactive", "removed"]),
  updatedAt: timestampSchema,
})

const organizationMembershipSchema = v.strictObject({
  createdAt: timestampSchema,
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(640)),
  organizationId: organizationResourceIdSchema,
  roles: v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(320))),
  updatedAt: timestampSchema,
  userId: userResourceIdSchema,
})

const projectSchema = v.strictObject({
  authorizationRequired: v.boolean(),
  createdAt: timestampSchema,
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(320)),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  organizationId: organizationResourceIdSchema,
  projectAccessRequired: v.boolean(),
  status: v.picklist(["active", "inactive", "removed"]),
  updatedAt: timestampSchema,
})

const projectRoleSchema = v.strictObject({
  createdAt: timestampSchema,
  displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  group: projectRoleTextSchema,
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(640)),
  key: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  projectId: v.pipe(v.string(), v.minLength(1), v.maxLength(320)),
  updatedAt: timestampSchema,
})

const projectGrantSchema = v.strictObject({
  createdAt: timestampSchema,
  grantedOrganizationId: organizationResourceIdSchema,
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(320)),
  organizationId: organizationResourceIdSchema,
  projectId: v.pipe(v.string(), v.minLength(1), v.maxLength(320)),
  roleKeys: v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  status: v.picklist(["active", "inactive", "removed"]),
  updatedAt: timestampSchema,
})

const skippedRecordSchema = v.strictObject({
  entity: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
  reason: v.pipe(v.string(), v.minLength(1), v.maxLength(320)),
  sourceId: v.pipe(v.string(), v.minLength(1), v.maxLength(640)),
})

export const zitadelMigrationSnapshotSchema = v.strictObject({
  organizations: v.array(organizationSchema),
  organizationMemberships: v.array(organizationMembershipSchema),
  projectGrants: v.array(projectGrantSchema),
  projectRoles: v.array(projectRoleSchema),
  projects: v.array(projectSchema),
  unsupported: v.array(skippedRecordSchema),
  users: v.array(userSchema),
  version: v.literal(1),
})

export type ZitadelMigrationSnapshot = v.InferOutput<typeof zitadelMigrationSnapshotSchema>
