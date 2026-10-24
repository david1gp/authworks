/** Installs fatal-error handlers so an unexpected server crash is recorded in server.log. */
export function serverFatalHandlersInstall(): void {
  process.on("uncaughtException", (error) => {
    console.error({ event: "authworks.server.uncaught-exception", message: errorMessageGet(error) })
    process.exit(1)
  })
  process.on("unhandledRejection", (reason) => {
    console.error({ event: "authworks.server.unhandled-rejection", message: errorMessageGet(reason) })
    process.exit(1)
  })
}

function errorMessageGet(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : String(error)
}
