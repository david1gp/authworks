import { serverApplicationCreate } from "../compositions/serverApplicationCreate.js"

export const serverApp = serverApplicationCreate({
  databasePath: process.env.ZITADEL_V2_DATABASE_PATH ?? "zitadel.sqlite",
  publicOrigin: process.env.ZITADEL_V2_PUBLIC_ORIGIN ?? "http://127.0.0.1:3000",
  systemSecret: process.env.ZITADEL_V2_SYSTEM_SECRET,
})

if (import.meta.main) {
  Bun.serve({ fetch: serverApp.fetch })
}
