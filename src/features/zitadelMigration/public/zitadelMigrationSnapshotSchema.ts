import * as v from "valibot"
import { oidcClientCompatibilitySettingsValidate } from "../../oidc/public/oidcClientCompatibilitySettingsValidate.js"
import { organizationMembershipResourceIdSchema } from "../../organizations/public/organizationMembershipResourceIdSchema.js"
import { organizationResourceIdSchema } from "../../organizations/public/organizationResourceIdSchema.js"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"

const timestampSchema = v.pipe(v.number(), v.integer(), v.minValue(0))
const nullableTimestampSchema = v.nullable(timestampSchema)
const profileTextSchema = v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(128)))
const projectRoleTextSchema = v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(200)))
const sourceIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(640))
const sourceInstanceSchema = v.pipe(
  v.string(),
  v.url(),
  v.transform((value) => value.replace(/\/+$/, "").toLowerCase()),
)
const entityCompletenessSchema = v.strictObject({
  complete: v.boolean(),
  count: v.pipe(v.number(), v.integer(), v.minValue(0)),
})
const credentialMetadataSchema = v.strictObject({
  available: v.boolean(),
  type: v.picklist(["password", "client-secret", "machine-secret"]),
  portable: v.boolean(),
})

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
  id: organizationMembershipResourceIdSchema,
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

const oidcApplicationSchema = v.strictObject({
  // Kept optional so snapshots written before task 16 remain readable.  The
  // endpoint is source-wide in ZITADEL and has no per-application Authworks
  // setting, so new exports do not write it and imports intentionally ignore it.
  authorizationEndpoint: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  allowedScopes: v.optional(
    v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(100))), v.minLength(1), v.maxLength(100)),
  ),
  accessTokenRoleAssertion: v.optional(v.boolean(), false),
  additionalOrigins: v.optional(
    v.pipe(
      v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
      v.maxLength(100),
      v.check(
        (additionalOrigins) =>
          oidcClientCompatibilitySettingsValidate({
            accessTokenRoleAssertion: false,
            additionalOrigins,
            idTokenUserinfoAssertion: false,
          }).success,
        "Additional origins must be valid, normalized, and unique.",
      ),
    ),
    [],
  ),
  clientType: v.picklist(["public", "confidential"]),
  credentials: v.array(credentialMetadataSchema),
  clientId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(320))),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  projectId: v.pipe(v.string(), v.minLength(1), v.maxLength(320)),
  redirectUris: v.array(v.pipe(v.string(), v.url())),
  postLogoutRedirectUris: v.optional(v.array(v.pipe(v.string(), v.url()))),
  createdAt: timestampSchema,
  status: v.picklist(["active", "inactive", "removed"]),
  sourceId: sourceIdSchema,
  tokenEndpointAuthMethod: v.picklist(["none", "client_secret_basic", "client_secret_post"]),
  requireConsent: v.optional(v.boolean()),
  trusted: v.optional(v.boolean()),
  idTokenUserinfoAssertion: v.optional(v.boolean(), false),
  updatedAt: timestampSchema,
})

const machineUserSchema = v.strictObject({
  credentials: v.array(credentialMetadataSchema),
  createdAt: v.optional(timestampSchema),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  organizationId: sourceIdSchema,
  sourceId: sourceIdSchema,
  updatedAt: v.optional(timestampSchema),
})

const domainSchema = v.strictObject({
  createdAt: v.optional(timestampSchema),
  domain: v.pipe(v.string(), v.minLength(1), v.maxLength(253)),
  isPrimary: v.optional(v.boolean(), false),
  organizationId: sourceIdSchema,
  sourceId: sourceIdSchema,
  verified: v.boolean(),
  updatedAt: v.optional(timestampSchema),
})

const loginPolicySchema = v.strictObject({
  allowUsernamePassword: v.boolean(),
  allowExternalIdp: v.boolean(),
  organizationId: sourceIdSchema,
  sourceId: sourceIdSchema,
  createdAt: v.optional(timestampSchema),
  updatedAt: v.optional(timestampSchema),
})

const identityProviderSchema = v.strictObject({
  clientId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(320))),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  provider: v.picklist(["oidc", "saml"]),
  authworksType: v.optional(v.nullable(v.picklist(["google", "github", "microsoft"]))),
  enabled: v.optional(v.boolean()),
  configuration: v.optional(
    v.strictObject({
      scopes: v.optional(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200)))),
      redirectUri: v.optional(v.pipe(v.string(), v.url())),
      allowAccountCreation: v.optional(v.boolean()),
    }),
  ),
  createdAt: v.optional(timestampSchema),
  updatedAt: v.optional(timestampSchema),
  sourceId: sourceIdSchema,
  organizationId: v.optional(sourceIdSchema),
})

const externalIdentityLinkSchema = v.strictObject({
  externalSubject: v.pipe(v.string(), v.minLength(1), v.maxLength(640)),
  identityProviderId: sourceIdSchema,
  sourceId: sourceIdSchema,
  userId: sourceIdSchema,
  createdAt: v.optional(timestampSchema),
  updatedAt: v.optional(timestampSchema),
})

const skippedRecordSchema = v.strictObject({
  entity: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
  reason: v.pipe(v.string(), v.minLength(1), v.maxLength(320)),
  sourceId: v.pipe(v.string(), v.minLength(1), v.maxLength(640)),
})

const snapshotShape = v.strictObject({
  completeness: v.strictObject({
    organizationMemberships: entityCompletenessSchema,
    organizations: entityCompletenessSchema,
    projectGrants: entityCompletenessSchema,
    projectRoles: entityCompletenessSchema,
    projects: entityCompletenessSchema,
    users: entityCompletenessSchema,
    domains: entityCompletenessSchema,
    externalIdentityLinks: entityCompletenessSchema,
    identityProviders: entityCompletenessSchema,
    loginPolicies: entityCompletenessSchema,
    machineUsers: entityCompletenessSchema,
    oidcApplications: entityCompletenessSchema,
  }),
  domains: v.array(domainSchema),
  exportedAt: timestampSchema,
  externalIdentityLinks: v.array(externalIdentityLinkSchema),
  identityProviders: v.array(identityProviderSchema),
  loginPolicies: v.array(loginPolicySchema),
  machineUsers: v.array(machineUserSchema),
  oidcApplications: v.array(oidcApplicationSchema),
  organizations: v.array(organizationSchema),
  organizationMemberships: v.array(organizationMembershipSchema),
  projectGrants: v.array(projectGrantSchema),
  projectRoles: v.array(projectRoleSchema),
  projects: v.array(projectSchema),
  unsupported: v.array(skippedRecordSchema),
  users: v.array(userSchema),
  sourceInstance: sourceInstanceSchema,
  version: v.literal(2),
})

export const zitadelMigrationSnapshotSchema = v.pipe(
  snapshotShape,
  v.check(
    (snapshot) =>
      snapshot.completeness.organizationMemberships.count === snapshot.organizationMemberships.length &&
      snapshot.completeness.organizations.count === snapshot.organizations.length &&
      snapshot.completeness.projectGrants.count === snapshot.projectGrants.length &&
      snapshot.completeness.projectRoles.count === snapshot.projectRoles.length &&
      snapshot.completeness.projects.count === snapshot.projects.length &&
      snapshot.completeness.users.count === snapshot.users.length &&
      snapshot.completeness.domains.count === snapshot.domains.length &&
      snapshot.completeness.externalIdentityLinks.count === snapshot.externalIdentityLinks.length &&
      snapshot.completeness.identityProviders.count === snapshot.identityProviders.length &&
      snapshot.completeness.loginPolicies.count === snapshot.loginPolicies.length &&
      snapshot.completeness.machineUsers.count === snapshot.machineUsers.length &&
      snapshot.completeness.oidcApplications.count === snapshot.oidcApplications.length,
    "Completeness counts must match their entity collections.",
  ),
)

export type ZitadelMigrationSnapshot = v.InferOutput<typeof zitadelMigrationSnapshotSchema>
