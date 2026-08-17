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
