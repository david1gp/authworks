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
      "CREATE TABLE IF NOT EXISTS instances (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, primary_domain TEXT NOT NULL UNIQUE, status TEXT NOT NULL, created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), bootstrap_admin_id TEXT UNIQUE, bootstrap_completed_at INTEGER CHECK (bootstrap_completed_at IS NULL OR bootstrap_completed_at >= 0))",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS instance_domains (domain TEXT PRIMARY KEY NOT NULL, instance_id TEXT NOT NULL, is_primary TEXT NOT NULL CHECK (is_primary IN ('true', 'false')), FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS instance_bootstrap_admins (instance_id TEXT PRIMARY KEY NOT NULL, admin_id TEXT NOT NULL UNIQUE, secret_hash TEXT NOT NULL, created_at INTEGER NOT NULL CHECK (created_at >= 0), FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS instance_domains_instance_id_idx ON instance_domains (instance_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY NOT NULL, instance_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'removed')), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), UNIQUE (instance_id, name), FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE)",
    )
    database.run("CREATE INDEX IF NOT EXISTS organizations_instance_id_idx ON organizations (instance_id)")
    database.run(
      "CREATE TABLE IF NOT EXISTS organization_memberships (id TEXT PRIMARY KEY NOT NULL, instance_id TEXT NOT NULL, organization_id TEXT NOT NULL, user_id TEXT NOT NULL, roles TEXT NOT NULL CHECK (json_valid(roles)), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), UNIQUE (organization_id, user_id), FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS organization_memberships_organization_id_idx ON organization_memberships (organization_id)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS organization_memberships_instance_id_idx ON organization_memberships (instance_id)",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS organization_invitations (id TEXT PRIMARY KEY NOT NULL, instance_id TEXT NOT NULL, organization_id TEXT NOT NULL, email TEXT NOT NULL, roles TEXT NOT NULL CHECK (json_valid(roles)), token_hash TEXT NOT NULL UNIQUE, invited_by TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')), expires_at INTEGER NOT NULL CHECK (expires_at >= 0), accepted_at INTEGER CHECK (accepted_at IS NULL OR accepted_at >= 0), created_at INTEGER NOT NULL CHECK (created_at >= 0), updated_at INTEGER NOT NULL CHECK (updated_at >= 0), version INTEGER NOT NULL CHECK (version > 0), FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE, FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS organization_invitations_organization_id_idx ON organization_invitations (organization_id)",
    )
    database.run(
      "CREATE INDEX IF NOT EXISTS organization_invitations_instance_id_idx ON organization_invitations (instance_id)",
    )
    database.run(
      "CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_pending_email_idx ON organization_invitations (organization_id, email) WHERE status = 'pending'",
    )
    database.run(
      "CREATE TABLE IF NOT EXISTS events (position INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, command_index INTEGER NOT NULL CHECK (command_index >= 0), instance_id TEXT NOT NULL, aggregate_type TEXT NOT NULL, aggregate_id TEXT NOT NULL, aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0), actor_id TEXT, correlation_id TEXT NOT NULL, causation_id TEXT, occurred_at INTEGER NOT NULL CHECK (occurred_at >= 0), event_type TEXT NOT NULL, payload TEXT NOT NULL CHECK (json_valid(payload)), metadata TEXT NOT NULL CHECK (json_valid(metadata)))",
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
