import { sessionBrowserModeHeaderName } from "../public/sessionBrowserModeHeaderName.js"

type SessionBrowserModeRequestContext = {
  readonly req: { readonly header: (name: string) => string | undefined }
}

export function sessionBrowserModeRequested(
  context: SessionBrowserModeRequestContext,
  browserMode: boolean | undefined,
): boolean {
  return browserMode === true && context.req.header(sessionBrowserModeHeaderName) === "true"
}
