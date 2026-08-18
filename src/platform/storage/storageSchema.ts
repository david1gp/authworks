import type { ExtractTablesWithRelations } from "drizzle-orm"
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"
import type { SQLiteTransaction } from "drizzle-orm/sqlite-core"
import { emailOtpChallengeTable } from "../../features/emailOtp/persistence/emailOtpChallengeTable.js"
import { externalIdentityOAuthTransactionTable } from "../../features/externalIdentities/persistence/externalIdentityOAuthTransactionTable.js"
import { externalIdentityProviderTable } from "../../features/externalIdentities/persistence/externalIdentityProviderTable.js"
import { externalIdentityTable } from "../../features/externalIdentities/persistence/externalIdentityTable.js"
import { realmBootstrapAdminTable } from "../../features/realms/persistence/realmBootstrapAdminTable.js"
import { realmDomainTable } from "../../features/realms/persistence/realmDomainTable.js"
import { realmTable } from "../../features/realms/persistence/realmTable.js"
import { organizationInvitationTable } from "../../features/organizations/persistence/organizationInvitationTable.js"
import { organizationBrandingTable } from "../../features/organizations/persistence/organizationBrandingTable.js"
import { organizationDomainTable } from "../../features/organizations/persistence/organizationDomainTable.js"
import { realmLoginPolicyTable } from "../../features/organizations/persistence/realmLoginPolicyTable.js"
import { organizationLoginPolicyTable } from "../../features/organizations/persistence/organizationLoginPolicyTable.js"
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
import { machineCredentialTable } from "../../features/machineUsers/persistence/machineCredentialTable.js"
import { machineUserTable } from "../../features/machineUsers/persistence/machineUserTable.js"
import { oidcAccessTokenTable } from "../../features/oidc/persistence/oidcAccessTokenTable.js"
import { oidcAuthorizationCodeTable } from "../../features/oidc/persistence/oidcAuthorizationCodeTable.js"
import { oidcAuthorizationRequestTable } from "../../features/oidc/persistence/oidcAuthorizationRequestTable.js"
import { oidcClientTable } from "../../features/oidc/persistence/oidcClientTable.js"
import { oidcConsentTable } from "../../features/oidc/persistence/oidcConsentTable.js"
import { oidcRefreshTokenTable } from "../../features/oidc/persistence/oidcRefreshTokenTable.js"
import { oidcSigningKeyTable } from "../../features/oidc/persistence/oidcSigningKeyTable.js"
import { passkeyCeremonyTable } from "../../features/passkeys/persistence/passkeyCeremonyTable.js"
import { passkeyCredentialTable } from "../../features/passkeys/persistence/passkeyCredentialTable.js"
import { sessionTable } from "../../features/sessions/persistence/sessionTable.js"
import { mfaChallengeTable } from "../../features/mfa/persistence/mfaChallengeTable.js"
import { mfaLockoutTable } from "../../features/mfa/persistence/mfaLockoutTable.js"
import { mfaPolicyTable } from "../../features/mfa/persistence/mfaPolicyTable.js"
import { mfaRecoveryCodeTable } from "../../features/mfa/persistence/mfaRecoveryCodeTable.js"
import { mfaTotpEnrollmentTable } from "../../features/mfa/persistence/mfaTotpEnrollmentTable.js"
import { userProfileTable } from "../../features/users/persistence/userProfileTable.js"
import { userTable } from "../../features/users/persistence/userTable.js"
import { storageCurrentStateTable } from "./storageCurrentStateTable.js"
import { storageEventTable } from "./storageEventTable.js"

export const storageSchema = {
  emailOtpChallengeTable,
  externalIdentityOAuthTransactionTable,
  externalIdentityProviderTable,
  externalIdentityTable,
  realmBootstrapAdminTable,
  realmDomainTable,
  realmTable,
  organizationInvitationTable,
  organizationBrandingTable,
  organizationDomainTable,
  realmLoginPolicyTable,
  organizationLoginPolicyTable,
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
  machineCredentialTable,
  machineUserTable,
  oidcAccessTokenTable,
  oidcAuthorizationCodeTable,
  oidcAuthorizationRequestTable,
  oidcClientTable,
  oidcConsentTable,
  oidcRefreshTokenTable,
  oidcSigningKeyTable,
  passkeyCeremonyTable,
  passkeyCredentialTable,
  sessionTable,
  mfaChallengeTable,
  mfaLockoutTable,
  mfaPolicyTable,
  mfaRecoveryCodeTable,
  mfaTotpEnrollmentTable,
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
