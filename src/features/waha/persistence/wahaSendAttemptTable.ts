import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import type { WahaSendAttemptStatus } from "../domain/wahaSendAttemptStatusSchema.js"

export const wahaSendAttemptTable = sqliteTable(
  "waha_send_attempts",
  {
    createdAt: integer("created_at").notNull(),
    endpointId: text("endpoint_id").notNull(),
    id: text("id").primaryKey(),
    purpose: text("purpose").notNull(),
    realmId: text("realm_id"),
    recipientPhoneHash: text("recipient_phone_hash").notNull(),
    sessionName: text("session_name"),
    status: text("status").$type<WahaSendAttemptStatus>().notNull(),
  },
  (table) => [
    index("waha_send_attempts_sender_idx").on(table.endpointId, table.sessionName, table.createdAt),
    index("waha_send_attempts_status_idx").on(table.status, table.createdAt),
    index("waha_send_attempts_purpose_idx").on(table.purpose, table.createdAt),
    index("waha_send_attempts_created_idx").on(table.createdAt),
  ],
)

export type WahaSendAttemptRow = typeof wahaSendAttemptTable.$inferSelect
