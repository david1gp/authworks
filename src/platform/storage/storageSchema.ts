import type { ExtractTablesWithRelations } from "drizzle-orm"
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"
import type { SQLiteTransaction } from "drizzle-orm/sqlite-core"
import { emailOtpChallengeTable } from "../../features/emailOtp/persistence/emailOtpChallengeTable.js"
import { externalIdentityOAuthTransactionTable } from "../../features/externalIdentities/persistence/externalIdentityOAuthTransactionTable.js"
import { externalIdentityProviderTable } from "../../features/externalIdentities/persistence/externalIdentityProviderTable.js"
import { externalIdentityTable } from "../../features/externalIdentities/persistence/externalIdentityTable.js"
import { instanceBootstrapAdminTable } from "../../features/instances/persistence/instanceBootstrapAdminTable.js"
import { instanceDomainTable } from "../../features/instances/persistence/instanceDomainTable.js"
import { instanceTable } from "../../features/instances/persistence/instanceTable.js"
import { organizationInvitationTable } from "../../features/organizations/persistence/organizationInvitationTable.js"
import { organizationMembershipTable } from "../../features/organizations/persistence/organizationMembershipTable.js"
import { organizationTable } from "../../features/organizations/persistence/organizationTable.js"
import { passwordChallengeTable } from "../../features/passwords/persistence/passwordChallengeTable.js"
import { passwordCredentialTable } from "../../features/passwords/persistence/passwordCredentialTable.js"
import { passwordLockoutTable } from "../../features/passwords/persistence/passwordLockoutTable.js"
import { passwordPolicyTable } from "../../features/passwords/persistence/passwordPolicyTable.js"
import { projectApplicationTable } from "../../features/projects/persistence/projectApplicationTable.js"
import { projectGrantTable } from "../../features/projects/persistence/projectGrantTable.js"
import { projectRoleTable } from "../../features/projects/persistence/projectRoleTable.js"
import { projectTable } from "../../features/projects/persistence/projectTable.js"
import { sessionTable } from "../../features/sessions/persistence/sessionTable.js"
import { userProfileTable } from "../../features/users/persistence/userProfileTable.js"
import { userTable } from "../../features/users/persistence/userTable.js"
import { storageCurrentStateTable } from "./storageCurrentStateTable.js"
import { storageEventTable } from "./storageEventTable.js"

export const storageSchema = {
  emailOtpChallengeTable,
  externalIdentityOAuthTransactionTable,
  externalIdentityProviderTable,
  externalIdentityTable,
  instanceBootstrapAdminTable,
  instanceDomainTable,
  instanceTable,
  organizationInvitationTable,
  organizationMembershipTable,
  organizationTable,
  passwordChallengeTable,
  passwordCredentialTable,
  passwordLockoutTable,
  passwordPolicyTable,
  projectApplicationTable,
  projectGrantTable,
  projectRoleTable,
  projectTable,
  sessionTable,
  userProfileTable,
  userTable,
  storageCurrentStateTable,
  storageEventTable,
}

export type StorageClient = BunSQLiteDatabase<typeof storageSchema>
export type StorageTransaction = SQLiteTransaction<
  "sync",
  void,
  typeof storageSchema,
  ExtractTablesWithRelations<typeof storageSchema>
>
export type StorageExecutor = StorageClient | StorageTransaction
