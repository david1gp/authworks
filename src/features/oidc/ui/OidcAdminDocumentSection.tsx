import { mdiContentCopy } from "@adaptive-ds/mdi/mdiContentCopy.js"
import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

/**
 * One read-only protocol document: a summary body plus the raw JSON behind a disclosure. It offers
 * copying and, when the endpoint is reachable from this origin, opening — never editing.
 */
export function OidcAdminDocumentSection(props: {
  readonly children: JSX.Element
  readonly copied: boolean
  readonly description: string
  readonly json: string
  readonly onCopy: () => void
  readonly openHref?: string
  readonly title: string
  readonly url?: string
}) {
  return (
    <section class="min-w-0 rounded-panel border border-line bg-surface px-4 py-3">
      <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <h2 class="min-w-36 text-sm font-semibold">{props.title}</h2>
        <Show when={props.url}>
          {(url) => (
            <Show
              when={props.openHref}
              fallback={<span class="min-w-0 flex-1 break-all font-mono text-xs text-muted-foreground">{url()}</span>}
            >
              {(href) => (
                <a
                  class="min-w-0 flex-1 break-all font-mono text-xs text-link hover:underline"
                  href={href()}
                  rel="noreferrer"
                  target="_blank"
                >
                  {url()}
                </a>
              )}
            </Show>
          )}
        </Show>
        <AuthenticatedButton size="sm" icon={mdiContentCopy} onClick={props.onCopy} variant="outline">
          {messageTranslate("admin.oidc.documents.copy")}
        </AuthenticatedButton>
        <Show when={props.copied}>
          <span class="text-xs font-medium text-success" role="status">
            {messageTranslate("admin.oidc.documents.copied")}
          </span>
        </Show>
      </div>
      <details class="min-w-0">
        <summary class="cursor-pointer py-1.5 text-xs font-medium">
          {messageTranslate("admin.oidc.documents.showRaw")}
        </summary>
        <div class="grid min-w-0 gap-3">
          {props.children}
          <pre class="max-h-96 w-full min-w-0 overflow-auto whitespace-pre border-t border-line-subtle bg-muted px-4 py-3 font-mono text-xs leading-5">
            {props.json}
          </pre>
        </div>
      </details>
    </section>
  )
}
