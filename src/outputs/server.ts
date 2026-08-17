import { serverApplicationCreate } from "../compositions/serverApplicationCreate.js"

export const serverApp = serverApplicationCreate({
  databasePath: process.env.ZITADEL_V2_DATABASE_PATH ?? "zitadel.sqlite",
  systemSecret: process.env.ZITADEL_V2_SYSTEM_SECRET,
})

if (import.meta.main) {
  Bun.serve({ fetch: serverApp.fetch })
}
