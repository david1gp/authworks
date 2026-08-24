import { type Result } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"
import type { StorageExecutor } from "./storageSchema.js"

export function storageSchemaCreate(database: StorageExecutor): Result<void> {
  const op = "storageSchemaCreate"

  try {
    database.run(
      "CREATE TABLE IF NOT EXISTS current_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL CHECK (json_valid(value)), version INTEGER NOT NULL CHECK (version > 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0))",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS realms (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, primary_domain TEXT NOT NULL UNIQUE, status TEXT NOT NULL, created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), bootstrap_admin_id TEXT UNIQUE, bootstrap_completed_at INTEGER CHECK (bootstrap_completed_at IS NULL OR bootstrap_completed_at >= 0))",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS realm_domains (domain TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, is_primary TEXT NOT NULL CHECK (is_primary IN ('true', 'false')), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS realm_bootstrap_admins (realm_id TEXT PRIMARY KEY NOT NULL, admin_id TEXT NOT NULL UNIQUE, secret_hash TEXT NOT NULL, created_at INTEGER NOT NULL CHECK (created_at >= 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS realm_domains_realm_id_idx ON realm_domains (realm_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'removed')), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), UNIQUE (realm_id, name), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS organizations_realm_id_idx ON organizations (realm_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS organization_domains (domain TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, organization_id TEXT NOT NULL, is_primary INTEGER NOT NULL CHECK (is_primary IN (0, 1)), verified INTEGER NOT NULL CHECK (verified IN (0, 1)), verification_token_hash TEXT NOT NULL, created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS organization_domains_realm_idx ON organization_domains (realm_id)")
    database.run(
      "CREATE INDEX IF NOT EXISTS organization_domains_organization_idx ON organization_domains (organization_id)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS organization_domains_organization_primary_idx ON organization_domains (organization_id, is_primary)",
    )
    database.run(
      "CREATE UNIQUE INDEX IF NOT EXISTS organization_domains_one_primary_idx ON organization_domains (organization_id) WHERE is_primary = 1",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS organization_branding (organization_id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, branding TEXT NOT NULL CHECK (json_valid(branding)), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS realm_login_policies (realm_id TEXT PRIMARY KEY NOT NULL, allow_domain_discovery INTEGER NOT NULL CHECK (allow_domain_discovery IN (0, 1)), allow_email_otp INTEGER NOT NULL CHECK (allow_email_otp IN (0, 1)), allow_whatsapp_otp INTEGER NOT NULL CHECK (allow_whatsapp_otp IN (0, 1)), allow_external_identity INTEGER NOT NULL CHECK (allow_external_identity IN (0, 1)), allow_password INTEGER NOT NULL CHECK (allow_password IN (0, 1)), allow_password_recovery INTEGER NOT NULL CHECK (allow_password_recovery IN (0, 1)), allow_passkey INTEGER NOT NULL CHECK (allow_passkey IN (0, 1)), allow_registration INTEGER NOT NULL CHECK (allow_registration IN (0, 1)), provider_ids TEXT CHECK (provider_ids IS NULL OR json_valid(provider_ids)), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS organization_login_policies (organization_id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, allow_domain_discovery INTEGER CHECK (allow_domain_discovery IS NULL OR allow_domain_discovery IN (0, 1)), allow_email_otp INTEGER CHECK (allow_email_otp IS NULL OR allow_email_otp IN (0, 1)), allow_whatsapp_otp INTEGER CHECK (allow_whatsapp_otp IS NULL OR allow_whatsapp_otp IN (0, 1)), allow_external_identity INTEGER CHECK (allow_external_identity IS NULL OR allow_external_identity IN (0, 1)), allow_password INTEGER CHECK (allow_password IS NULL OR allow_password IN (0, 1)), allow_password_recovery INTEGER CHECK (allow_password_recovery IS NULL OR allow_password_recovery IN (0, 1)), allow_passkey INTEGER CHECK (allow_passkey IS NULL OR allow_passkey IN (0, 1)), allow_registration INTEGER CHECK (allow_registration IS NULL OR allow_registration IN (0, 1)), provider_ids TEXT CHECK (provider_ids IS NULL OR json_valid(provider_ids)), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS organization_memberships (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, organization_id TEXT NOT NULL, user_id TEXT NOT NULL, roles TEXT NOT NULL CHECK (json_valid(roles)), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), UNIQUE (organization_id, user_id), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS organization_memberships_organization_id_idx ON organization_memberships (organization_id)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS organization_memberships_realm_id_idx ON organization_memberships (realm_id)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS organization_invitations (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, organization_id TEXT NOT NULL, email TEXT NOT NULL, roles TEXT NOT NULL CHECK (json_valid(roles)), token_hash TEXT NOT NULL UNIQUE, invited_by TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')), expires_at INTEGER NOT NULL CHECK (expires_at >= 0), accepted_at INTEGER CHECK (accepted_at IS NULL OR accepted_at >= 0), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS organization_invitations_organization_id_idx ON organization_invitations (organization_id)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS organization_invitations_realm_id_idx ON organization_invitations (realm_id)",
    )
    database.run(
      "CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_pending_email_idx ON organization_invitations (organization_id, email) WHERE status = 'pending'",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, user_name TEXT NOT NULL, email TEXT NOT NULL, state TEXT NOT NULL CHECK (state IN ('initial', 'active', 'inactive', 'locked', 'suspended', 'deleted')), email_verified_at INTEGER CHECK (email_verified_at IS NULL OR email_verified_at >= 0), phone_number TEXT, phone_number_verified_at INTEGER CHECK (phone_number_verified_at IS NULL OR phone_number_verified_at >= 0), registration_verified_at INTEGER CHECK (registration_verified_at IS NULL OR registration_verified_at >= 0), registration_verification_method TEXT CHECK (registration_verification_method IS NULL OR registration_verification_method IN ('email', 'whatsapp')), deleted_at INTEGER CHECK (deleted_at IS NULL OR deleted_at >= 0), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), UNIQUE (realm_id, user_name), UNIQUE (realm_id, email), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    try {
      database.run("ALTER TABLE users ADD COLUMN phone_number TEXT")
    } catch (error) {
      if (!storageSchemaDuplicateColumnIsExpected(error, "phone_number")) throw error
    }
    try {
      database.run(
        "ALTER TABLE users ADD COLUMN phone_number_verified_at INTEGER CHECK (phone_number_verified_at IS NULL OR phone_number_verified_at >= 0)",
      )
    } catch (error) {
      if (!storageSchemaDuplicateColumnIsExpected(error, "phone_number_verified_at")) throw error
    }
    try {
      database.run(
        "ALTER TABLE users ADD COLUMN registration_verified_at INTEGER CHECK (registration_verified_at IS NULL OR registration_verified_at >= 0)",
      )
    } catch (error) {
      if (!storageSchemaDuplicateColumnIsExpected(error, "registration_verified_at")) throw error
    }
    try {
      database.run(
        "ALTER TABLE users ADD COLUMN registration_verification_method TEXT CHECK (registration_verification_method IS NULL OR registration_verification_method IN ('email', 'whatsapp'))",
      )
    } catch (error) {
      if (!storageSchemaDuplicateColumnIsExpected(error, "registration_verification_method")) throw error
    }
    database.run(
      "CREATE UNIQUE INDEX IF NOT EXISTS users_realm_verified_phone_idx ON users (realm_id, phone_number) WHERE phone_number IS NOT NULL AND phone_number_verified_at IS NOT NULL",
    )
    database.run("CREATE INDEX IF NOT EXISTS users_realm_id_idx ON users (realm_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS user_profiles (user_id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, first_name TEXT, last_name TEXT, nick_name TEXT, display_name TEXT, preferred_language TEXT, gender TEXT, updated_at INTEGER NOT NULL CHECK (updated_at >= 0), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS user_profiles_realm_id_idx ON user_profiles (realm_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS email_otp_challenges (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, organization_id TEXT, user_id TEXT, email_hash TEXT NOT NULL, purpose TEXT NOT NULL CHECK (purpose IN ('sign_in')), code_hash TEXT NOT NULL, attempts INTEGER NOT NULL CHECK (attempts >= 0), max_attempts INTEGER NOT NULL CHECK (max_attempts > 0), expires_at INTEGER NOT NULL CHECK (expires_at >= 0), cooldown_until INTEGER NOT NULL CHECK (cooldown_until >= 0), consumed_at INTEGER CHECK (consumed_at IS NULL OR consumed_at >= 0), created_at INTEGER NOT NULL CHECK (created_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS email_otp_challenges_realm_email_idx ON email_otp_challenges (realm_id, email_hash, purpose)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS email_otp_challenges_realm_user_idx ON email_otp_challenges (realm_id, user_id, purpose)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS whatsapp_otp_challenges (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, organization_id TEXT, user_id TEXT, phone_hash TEXT NOT NULL, purpose TEXT NOT NULL CHECK (purpose IN ('sign_in')), code_hash TEXT NOT NULL, attempts INTEGER NOT NULL CHECK (attempts >= 0), max_attempts INTEGER NOT NULL CHECK (max_attempts > 0), expires_at INTEGER NOT NULL CHECK (expires_at >= 0), cooldown_until INTEGER NOT NULL CHECK (cooldown_until >= 0), consumed_at INTEGER CHECK (consumed_at IS NULL OR consumed_at >= 0), created_at INTEGER NOT NULL CHECK (created_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS whatsapp_otp_challenges_realm_phone_idx ON whatsapp_otp_challenges (realm_id, phone_hash, purpose)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS whatsapp_otp_challenges_realm_user_idx ON whatsapp_otp_challenges (realm_id, user_id, purpose)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS waha_health_candidates (endpoint_id TEXT NOT NULL, session_name TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('unknown', 'healthy', 'unhealthy')), checked_at INTEGER NOT NULL CHECK (checked_at >= 0), expires_at INTEGER NOT NULL CHECK (expires_at >= 0), failure_code TEXT, failure_message TEXT, failure_at INTEGER CHECK (failure_at IS NULL OR failure_at >= 0), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), PRIMARY KEY (endpoint_id, session_name))",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS waha_health_candidates_fresh_idx ON waha_health_candidates (status, expires_at)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS password_registration_challenges (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, user_id TEXT, identity_hash TEXT, purpose TEXT NOT NULL CHECK (purpose = 'registration'), code_hash TEXT NOT NULL UNIQUE, attempts INTEGER NOT NULL CHECK (attempts >= 0), max_attempts INTEGER NOT NULL CHECK (max_attempts > 0), expires_at INTEGER NOT NULL CHECK (expires_at >= 0), cooldown_until INTEGER NOT NULL CHECK (cooldown_until >= 0), consumed_at INTEGER CHECK (consumed_at IS NULL OR consumed_at >= 0), created_at INTEGER NOT NULL CHECK (created_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS password_registration_challenges_realm_user_idx ON password_registration_challenges (realm_id, user_id, purpose)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS password_registration_challenges_realm_identity_idx ON password_registration_challenges (realm_id, identity_hash, purpose)",
    )
    database.run(
      "CREATE UNIQUE INDEX IF NOT EXISTS password_registration_challenges_decoy_identity_idx ON password_registration_challenges (realm_id, identity_hash, purpose) WHERE user_id IS NULL AND consumed_at IS NULL",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS rate_limits (scope TEXT NOT NULL, key_hash TEXT NOT NULL, window_started_at INTEGER NOT NULL CHECK (window_started_at >= 0), expires_at INTEGER NOT NULL CHECK (expires_at >= 0), count INTEGER NOT NULL CHECK (count > 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), PRIMARY KEY (scope, key_hash))",
    )
    database.run("CREATE INDEX IF NOT EXISTS rate_limits_expires_at_idx ON rate_limits (expires_at, scope, key_hash)")
    database.run(
      "CREATE TABLE IF NOT EXISTS password_credentials (user_id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, hash TEXT NOT NULL, created_at INTEGER NOT NULL CHECK (created_at >= 0), changed_at INTEGER NOT NULL CHECK (changed_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS password_policies (realm_id TEXT PRIMARY KEY NOT NULL, minimum_length INTEGER NOT NULL CHECK (minimum_length > 0 AND minimum_length <= 72), require_lowercase INTEGER NOT NULL CHECK (require_lowercase IN (0, 1)), require_uppercase INTEGER NOT NULL CHECK (require_uppercase IN (0, 1)), require_number INTEGER NOT NULL CHECK (require_number IN (0, 1)), require_symbol INTEGER NOT NULL CHECK (require_symbol IN (0, 1)), maximum_attempts INTEGER NOT NULL CHECK (maximum_attempts > 0), lockout_duration_ms INTEGER NOT NULL CHECK (lockout_duration_ms > 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS password_lockouts (user_id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, failed_attempts INTEGER NOT NULL CHECK (failed_attempts >= 0), locked_until INTEGER CHECK (locked_until IS NULL OR locked_until >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS password_lockouts_realm_id_idx ON password_lockouts (realm_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS password_challenges (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('verification', 'recovery')), token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL CHECK (expires_at >= 0), consumed_at INTEGER CHECK (consumed_at IS NULL OR consumed_at >= 0), created_at INTEGER NOT NULL CHECK (created_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS password_challenges_user_kind_idx ON password_challenges (realm_id, user_id, kind)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, subject_id TEXT NOT NULL, subject_type TEXT NOT NULL CHECK (subject_type IN ('user', 'bootstrap_admin')), user_id TEXT, token_hash TEXT NOT NULL UNIQUE, assurance TEXT NOT NULL CHECK (assurance IN ('none', 'authenticated', 'multi_factor')), authentication_method TEXT NOT NULL CHECK (authentication_method IN ('bootstrap_admin', 'email_otp', 'external_identity', 'impersonation', 'password', 'passkey', 'recovery_code', 'totp', 'whatsapp_otp')), mfa_method TEXT CHECK (mfa_method IS NULL OR mfa_method IN ('passkey', 'recovery_code', 'totp')), impersonation_organization_id TEXT, impersonation_permissions TEXT CHECK (impersonation_permissions IS NULL OR json_valid(impersonation_permissions)), impersonation_reason TEXT, impersonator_id TEXT, device_fingerprint TEXT, device_description TEXT, ip_address TEXT, user_agent TEXT, created_at INTEGER NOT NULL CHECK (created_at >= 0), last_used_at INTEGER NOT NULL CHECK (last_used_at >= 0), expires_at INTEGER NOT NULL CHECK (expires_at >= 0), revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= 0), revocation_reason TEXT, version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS sessions_realm_subject_idx ON sessions (realm_id, subject_type, subject_id)",
    )
    database.run("CREATE INDEX IF NOT EXISTS sessions_realm_user_idx ON sessions (realm_id, user_id)")
    database.run(
      "CREATE INDEX IF NOT EXISTS sessions_realm_last_used_idx ON sessions (realm_id, user_id, last_used_at)",
    )
    database.run("CREATE INDEX IF NOT EXISTS sessions_impersonator_idx ON sessions (realm_id, impersonator_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS mfa_policies (realm_id TEXT PRIMARY KEY NOT NULL, mode TEXT NOT NULL CHECK (mode IN ('disabled', 'optional', 'required')), totp_window INTEGER NOT NULL CHECK (totp_window >= 0 AND totp_window <= 2), max_attempts INTEGER NOT NULL CHECK (max_attempts > 0), lockout_duration_ms INTEGER NOT NULL CHECK (lockout_duration_ms > 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS mfa_totp_enrollments (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, user_id TEXT NOT NULL, label TEXT NOT NULL, encrypted_secret TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'removed')), created_at INTEGER NOT NULL CHECK (created_at >= 0), confirmed_at INTEGER CHECK (confirmed_at IS NULL OR confirmed_at >= 0), last_used_step INTEGER CHECK (last_used_step IS NULL OR last_used_step >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS mfa_totp_enrollments_realm_user_idx ON mfa_totp_enrollments (realm_id, user_id)",
    )
    database.run(
      "CREATE UNIQUE INDEX IF NOT EXISTS mfa_totp_enrollments_active_user_idx ON mfa_totp_enrollments (realm_id, user_id) WHERE status = 'active'",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS mfa_recovery_codes (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, user_id TEXT NOT NULL, code_hash TEXT NOT NULL UNIQUE, consumed_at INTEGER CHECK (consumed_at IS NULL OR consumed_at >= 0), created_at INTEGER NOT NULL CHECK (created_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS mfa_recovery_codes_realm_user_idx ON mfa_recovery_codes (realm_id, user_id)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS mfa_challenges (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, user_id TEXT NOT NULL, session_id TEXT, purpose TEXT NOT NULL CHECK (purpose IN ('login', 'step_up')), token_hash TEXT NOT NULL UNIQUE, primary_authentication_method TEXT NOT NULL CHECK (primary_authentication_method IN ('email_otp', 'external_identity', 'password', 'passkey', 'whatsapp_otp')), device_fingerprint TEXT, device_description TEXT, ip_address TEXT, user_agent TEXT, required_assurance TEXT NOT NULL CHECK (required_assurance = 'multi_factor'), attempts INTEGER NOT NULL CHECK (attempts >= 0), max_attempts INTEGER NOT NULL CHECK (max_attempts > 0), expires_at INTEGER NOT NULL CHECK (expires_at >= 0), consumed_at INTEGER CHECK (consumed_at IS NULL OR consumed_at >= 0), created_at INTEGER NOT NULL CHECK (created_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS mfa_challenges_realm_user_idx ON mfa_challenges (realm_id, user_id, purpose)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS mfa_lockouts (user_id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, failed_attempts INTEGER NOT NULL CHECK (failed_attempts >= 0), locked_until INTEGER, updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS mfa_lockouts_realm_idx ON mfa_lockouts (realm_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS passkey_credentials (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, user_id TEXT NOT NULL, rp_id TEXT NOT NULL, credential_id TEXT NOT NULL, public_key BLOB NOT NULL, counter INTEGER NOT NULL CHECK (counter >= 0), aaguid TEXT NOT NULL, device_type TEXT NOT NULL CHECK (device_type IN ('singleDevice', 'multiDevice')), backed_up INTEGER NOT NULL CHECK (backed_up IN (0, 1)), transports TEXT NOT NULL CHECK (json_valid(transports)), created_at INTEGER NOT NULL CHECK (created_at >= 0), last_used_at INTEGER, revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= 0), version INTEGER NOT NULL CHECK (version > 0), UNIQUE (rp_id, credential_id), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS passkey_credentials_realm_user_idx ON passkey_credentials (realm_id, user_id)",
    )
    database.run("CREATE INDEX IF NOT EXISTS passkey_credentials_realm_rp_idx ON passkey_credentials (realm_id, rp_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS passkey_ceremonies (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, organization_id TEXT, kind TEXT NOT NULL CHECK (kind IN ('registration', 'authentication')), purpose TEXT NOT NULL CHECK (purpose IN ('passwordless', 'mfa', 'step_up')), user_id TEXT, session_id TEXT, token_hash TEXT NOT NULL UNIQUE, challenge_hash TEXT NOT NULL, rp_id TEXT NOT NULL, origins TEXT NOT NULL CHECK (json_valid(origins)), user_verification TEXT NOT NULL CHECK (user_verification IN ('required', 'preferred', 'discouraged')), expires_at INTEGER NOT NULL CHECK (expires_at >= 0), consumed_at INTEGER CHECK (consumed_at IS NULL OR consumed_at >= 0), created_at INTEGER NOT NULL CHECK (created_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS passkey_ceremonies_realm_expiry_idx ON passkey_ceremonies (realm_id, expires_at)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS passkey_ceremonies_realm_user_idx ON passkey_ceremonies (realm_id, user_id)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS external_identity_providers (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, organization_id TEXT, type TEXT NOT NULL CHECK (type IN ('google', 'github', 'microsoft')), display_name TEXT NOT NULL, enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)), allow_account_creation INTEGER NOT NULL CHECK (allow_account_creation IN (0, 1)), client_id TEXT NOT NULL, client_secret TEXT NOT NULL, redirect_uri TEXT NOT NULL, scopes TEXT NOT NULL CHECK (json_valid(scopes)), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), UNIQUE (realm_id, type, organization_id), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS external_identity_providers_realm_idx ON external_identity_providers (realm_id)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS external_identity_providers_organization_idx ON external_identity_providers (realm_id, organization_id)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS external_identities (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, user_id TEXT NOT NULL, provider_id TEXT NOT NULL, external_subject TEXT NOT NULL, username TEXT, display_name TEXT, email TEXT, email_verified INTEGER NOT NULL CHECK (email_verified IN (0, 1)), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), UNIQUE (provider_id, external_subject), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (provider_id) REFERENCES external_identity_providers(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS external_identities_realm_user_idx ON external_identities (realm_id, user_id)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS external_identities_realm_provider_idx ON external_identities (realm_id, provider_id)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS external_identity_oauth_transactions (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, provider_id TEXT NOT NULL, organization_id TEXT, user_id TEXT, intent TEXT NOT NULL CHECK (intent IN ('sign_in', 'link')), interaction_handle TEXT, state_hash TEXT NOT NULL UNIQUE, nonce_hash TEXT, nonce TEXT, pkce_verifier TEXT NOT NULL, redirect_uri TEXT NOT NULL, expires_at INTEGER NOT NULL CHECK (expires_at >= 0), consumed_at INTEGER CHECK (consumed_at IS NULL OR consumed_at >= 0), callback_validated_at INTEGER CHECK (callback_validated_at IS NULL OR callback_validated_at >= 0), confirmation_token_hash TEXT, external_subject TEXT, external_username TEXT, external_display_name TEXT, external_email TEXT, external_email_verified INTEGER CHECK (external_email_verified IS NULL OR external_email_verified IN (0, 1)), external_issuer TEXT, created_at INTEGER NOT NULL CHECK (created_at >= 0), version INTEGER NOT NULL, FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (provider_id) REFERENCES external_identity_providers(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)",
    )
    try {
      database.run("ALTER TABLE external_identity_oauth_transactions ADD COLUMN interaction_handle TEXT")
    } catch (error) {
      if (!storageSchemaDuplicateColumnIsExpected(error, "interaction_handle")) throw error
    }
    database.run(
      "CREATE INDEX IF NOT EXISTS external_identity_oauth_transactions_realm_idx ON external_identity_oauth_transactions (realm_id, provider_id)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS external_identity_oauth_transactions_expiry_idx ON external_identity_oauth_transactions (expires_at)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, organization_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'removed')), authorization_required INTEGER NOT NULL CHECK (authorization_required IN (0, 1)), project_access_required INTEGER NOT NULL CHECK (project_access_required IN (0, 1)), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), UNIQUE (organization_id, name), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS projects_realm_id_idx ON projects (realm_id)")
    database.run("CREATE INDEX IF NOT EXISTS projects_organization_id_idx ON projects (organization_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS project_applications (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, project_id TEXT NOT NULL, name TEXT NOT NULL, application_type TEXT NOT NULL CHECK (application_type IN ('oidc', 'api', 'saml')), status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'removed')), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS project_applications_realm_id_idx ON project_applications (realm_id)")
    database.run("CREATE INDEX IF NOT EXISTS project_applications_project_id_idx ON project_applications (project_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS project_roles (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, project_id TEXT NOT NULL, key TEXT NOT NULL, display_name TEXT NOT NULL, group_name TEXT, created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), UNIQUE (project_id, key), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS project_roles_realm_id_idx ON project_roles (realm_id)")
    database.run("CREATE INDEX IF NOT EXISTS project_roles_project_id_idx ON project_roles (project_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS project_grants (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, project_id TEXT NOT NULL, organization_id TEXT NOT NULL, granted_organization_id TEXT NOT NULL, role_keys TEXT NOT NULL CHECK (json_valid(role_keys)), status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'removed')), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), UNIQUE (project_id, granted_organization_id), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE, FOREIGN KEY (granted_organization_id) REFERENCES organizations(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS project_grants_realm_id_idx ON project_grants (realm_id)")
    database.run("CREATE INDEX IF NOT EXISTS project_grants_project_id_idx ON project_grants (project_id)")
    database.run(
      "CREATE INDEX IF NOT EXISTS project_grants_granted_organization_id_idx ON project_grants (granted_organization_id)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS machine_users (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, user_name TEXT NOT NULL, display_name TEXT NOT NULL, scopes TEXT NOT NULL CHECK (json_valid(scopes)), status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'removed')), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), UNIQUE (realm_id, user_name), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS machine_users_realm_id_idx ON machine_users (realm_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS machine_credentials (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, machine_user_id TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('client_secret', 'personal_access_token', 'api_key', 'access_token')), name TEXT, secret_hash TEXT NOT NULL UNIQUE, scopes TEXT NOT NULL CHECK (json_valid(scopes)), expires_at INTEGER CHECK (expires_at IS NULL OR expires_at >= 0), revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= 0), replaced_by_id TEXT, created_at INTEGER NOT NULL CHECK (created_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (machine_user_id) REFERENCES machine_users(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS machine_credentials_realm_id_idx ON machine_credentials (realm_id)")
    database.run(
      "CREATE INDEX IF NOT EXISTS machine_credentials_machine_user_id_idx ON machine_credentials (realm_id, machine_user_id)",
    )
    database.run(
      "CREATE UNIQUE INDEX IF NOT EXISTS machine_credentials_secret_hash_idx ON machine_credentials (secret_hash)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS oidc_clients (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, name TEXT NOT NULL, client_type TEXT NOT NULL CHECK (client_type IN ('public', 'confidential')), secret_hash TEXT, redirect_uris TEXT NOT NULL CHECK (json_valid(redirect_uris)), post_logout_redirect_uris TEXT NOT NULL CHECK (json_valid(post_logout_redirect_uris)), allowed_scopes TEXT NOT NULL CHECK (json_valid(allowed_scopes)), trusted INTEGER NOT NULL CHECK (trusted IN (0, 1)), require_consent INTEGER NOT NULL CHECK (require_consent IN (0, 1)), status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'removed')), project_id TEXT, application_id TEXT, created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL, FOREIGN KEY (application_id) REFERENCES project_applications(id) ON DELETE SET NULL)",
    )
    database.run("CREATE INDEX IF NOT EXISTS oidc_clients_realm_id_idx ON oidc_clients (realm_id)")
    database.run(
      "CREATE UNIQUE INDEX IF NOT EXISTS oidc_clients_realm_application_idx ON oidc_clients (realm_id, application_id)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS oidc_signing_keys (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, algorithm TEXT NOT NULL CHECK (algorithm = 'RS256'), public_jwk TEXT NOT NULL CHECK (json_valid(public_jwk)), encrypted_private_key TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('active', 'retired')), created_at INTEGER NOT NULL CHECK (created_at >= 0), retired_at INTEGER CHECK (retired_at IS NULL OR retired_at >= 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS oidc_signing_keys_realm_status_idx ON oidc_signing_keys (realm_id, status)",
    )
    database.run(
      "CREATE UNIQUE INDEX IF NOT EXISTS oidc_signing_keys_one_active_idx ON oidc_signing_keys (realm_id) WHERE status = 'active'",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS oidc_authorization_requests (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, client_id TEXT NOT NULL, user_id TEXT NOT NULL, session_id TEXT NOT NULL, redirect_uri TEXT NOT NULL, issuer TEXT NOT NULL, scope TEXT NOT NULL CHECK (json_valid(scope)), code_challenge TEXT NOT NULL, code_challenge_method TEXT NOT NULL CHECK (code_challenge_method = 'S256'), state_encrypted TEXT, nonce_encrypted TEXT, prompt TEXT, created_at INTEGER NOT NULL CHECK (created_at >= 0), expires_at INTEGER NOT NULL CHECK (expires_at >= 0), approved_at INTEGER CHECK (approved_at IS NULL OR approved_at >= 0), rejected_at INTEGER CHECK (rejected_at IS NULL OR rejected_at >= 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (client_id) REFERENCES oidc_clients(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS oidc_authorization_requests_realm_idx ON oidc_authorization_requests (realm_id)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS oidc_authorization_requests_expiry_idx ON oidc_authorization_requests (expires_at)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS oidc_interactions (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, handle_hash TEXT NOT NULL UNIQUE, binding_hash TEXT NOT NULL, request_encrypted TEXT NOT NULL, resume_path TEXT NOT NULL, authorization_request_id TEXT, session_id TEXT, user_id TEXT, created_at INTEGER NOT NULL CHECK (created_at >= 0), expires_at INTEGER NOT NULL CHECK (expires_at >= 0), completed_at INTEGER CHECK (completed_at IS NULL OR completed_at >= 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS oidc_interactions_realm_idx ON oidc_interactions (realm_id)")
    database.run("CREATE INDEX IF NOT EXISTS oidc_interactions_expiry_idx ON oidc_interactions (expires_at)")
    database.run(
      "CREATE TABLE IF NOT EXISTS oidc_authorization_codes (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, client_id TEXT NOT NULL, user_id TEXT NOT NULL, session_id TEXT NOT NULL, redirect_uri TEXT NOT NULL, issuer TEXT NOT NULL, scope TEXT NOT NULL CHECK (json_valid(scope)), code_challenge TEXT NOT NULL, code_challenge_method TEXT NOT NULL CHECK (code_challenge_method = 'S256'), token_hash TEXT NOT NULL UNIQUE, nonce_encrypted TEXT, created_at INTEGER NOT NULL CHECK (created_at >= 0), expires_at INTEGER NOT NULL CHECK (expires_at >= 0), used_at INTEGER CHECK (used_at IS NULL OR used_at >= 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (client_id) REFERENCES oidc_clients(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS oidc_authorization_codes_realm_idx ON oidc_authorization_codes (realm_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS oidc_access_tokens (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, client_id TEXT NOT NULL, user_id TEXT NOT NULL, session_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, scope TEXT NOT NULL CHECK (json_valid(scope)), refresh_family_id TEXT, created_at INTEGER NOT NULL CHECK (created_at >= 0), expires_at INTEGER NOT NULL CHECK (expires_at >= 0), revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= 0), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (client_id) REFERENCES oidc_clients(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS oidc_access_tokens_realm_user_idx ON oidc_access_tokens (realm_id, user_id)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS oidc_access_tokens_refresh_family_idx ON oidc_access_tokens (refresh_family_id)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS oidc_refresh_tokens (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, client_id TEXT NOT NULL, user_id TEXT NOT NULL, session_id TEXT NOT NULL, family_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, nonce_encrypted TEXT, scope TEXT NOT NULL CHECK (json_valid(scope)), created_at INTEGER NOT NULL CHECK (created_at >= 0), expires_at INTEGER NOT NULL CHECK (expires_at >= 0), revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= 0), replaced_by_hash TEXT, FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (client_id) REFERENCES oidc_clients(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS oidc_refresh_tokens_realm_user_idx ON oidc_refresh_tokens (realm_id, user_id)",
    )
    database.run("CREATE INDEX IF NOT EXISTS oidc_refresh_tokens_family_idx ON oidc_refresh_tokens (family_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS oidc_consents (realm_id TEXT NOT NULL, user_id TEXT NOT NULL, client_id TEXT NOT NULL, scope TEXT NOT NULL CHECK (json_valid(scope)), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= 0), PRIMARY KEY (realm_id, user_id, client_id), FOREIGN KEY (realm_id) REFERENCES realms(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (client_id) REFERENCES oidc_clients(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS oidc_consents_realm_idx ON oidc_consents (realm_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS events (position INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, command_index INTEGER NOT NULL CHECK (command_index >= 0), realm_id TEXT NOT NULL, aggregate_type TEXT NOT NULL, aggregate_id TEXT NOT NULL, aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0), actor_id TEXT, correlation_id TEXT NOT NULL, causation_id TEXT, occurred_at INTEGER NOT NULL CHECK (occurred_at >= 0), event_type TEXT NOT NULL, payload TEXT NOT NULL CHECK (json_valid(payload)), metadata TEXT NOT NULL CHECK (json_valid(metadata)))",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS events_aggregate_version_idx ON events (aggregate_type, aggregate_id, aggregate_version)",
    )
    database.run(
      "CREATE TRIGGER IF NOT EXISTS events_append_only_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'events are append-only'); END",
    )
    database.run(
      "CREATE TRIGGER IF NOT EXISTS events_append_only_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT, 'events are append-only'); END",
    )
    return resultCreate(undefined)
  } catch (_error) {
    return resultErrorCreate(op, "The SQLite schema could not be created.")
  }
}

function storageSchemaDuplicateColumnIsExpected(error: unknown, columnName: string): boolean {
  if (!(error instanceof Error)) return false
  if (error.message === `duplicate column name: ${columnName}`) return true
  return error.cause !== undefined && storageSchemaDuplicateColumnIsExpected(error.cause, columnName)
}
