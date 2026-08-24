import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"
import type { WahaHealthCandidateStatus } from "../domain/wahaHealthCandidateStatusSchema.js"

export const wahaHealthCandidateTable = sqliteTable(
  "waha_health_candidates",
  {
    checkedAt: integer("checked_at").notNull(),
    createdAt: integer("created_at").notNull(),
    endpointId: text("endpoint_id").notNull(),
    expiresAt: integer("expires_at").notNull(),
    failureAt: integer("failure_at"),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    sessionName: text("session_name").notNull(),
    status: text("status").$type<WahaHealthCandidateStatus>().notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.endpointId, table.sessionName] }),
    index("waha_health_candidates_fresh_idx").on(table.status, table.expiresAt),
  ],
)

export type WahaHealthCandidateRow = typeof wahaHealthCandidateTable.$inferSelect
