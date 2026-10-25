import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** Caches IP geolocation results so one address is looked up once per week. */
export const sessionGeoCacheTable = sqliteTable("session_geo_cache", {
  countryCode: text("country_code"),
  ip: text("ip").primaryKey(),
  region: text("region"),
  updatedAt: integer("updated_at").notNull(),
})

export type SessionGeoCacheRow = typeof sessionGeoCacheTable.$inferSelect
