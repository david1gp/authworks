import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export type UserProfilePictureCleanupState = "deleting" | "pending-delete" | "uploading"

export const userProfilePictureCleanupTable = sqliteTable(
  "user_profile_picture_cleanup",
  {
    createdAt: integer("created_at").notNull(),
    leaseToken: text("lease_token"),
    leaseUntil: integer("lease_until"),
    objectKey: text("object_key").primaryKey(),
    state: text("state", { enum: ["deleting", "pending-delete", "uploading"] as const })
      .notNull()
      .$type<UserProfilePictureCleanupState>(),
  },
  (table) => [
    index("user_profile_picture_cleanup_created_at_idx").on(table.createdAt, table.objectKey),
    index("user_profile_picture_cleanup_lifecycle_idx").on(
      table.state,
      table.leaseUntil,
      table.createdAt,
      table.objectKey,
    ),
  ],
)

export type UserProfilePictureCleanupRow = typeof userProfilePictureCleanupTable.$inferSelect
