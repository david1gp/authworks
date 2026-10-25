import { Hono } from "hono"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { mcpHttpHandlerCreate } from "../mcpHttpHandler.js"

type McpServerAppCreateOptions = {
  readonly database: StorageDatabase
}

export function mcpServerAppCreate(options: McpServerAppCreateOptions) {
  const app = new Hono()
  const handle = mcpHttpHandlerCreate({ database: options.database })
  app.post("/mcp", (context) => handle(context.req.raw))
  return app
}
