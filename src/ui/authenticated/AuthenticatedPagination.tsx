import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../i18n/model/messageTranslate.js"

/**
 * Cursor pagination shared by every authenticated collection. It renders nothing when a single page
 * covers the collection, so short lists keep their vertical space.
 */
export function AuthenticatedPagination(props: {
  readonly nextAvailable: boolean
  readonly onNext: () => void
  readonly onPrevious: () => void
  readonly previousAvailable: boolean
  readonly summary?: string
}) {
  return (
    <Show when={props.nextAvailable || props.previousAvailable}>
      <nav
        aria-label={messageTranslate("common.pagination")}
        class="flex items-center justify-between gap-3 border-t border-line-subtle px-3 py-2"
      >
        <span class="min-w-0 truncate text-xs tabular-nums text-muted-foreground">{props.summary ?? ""}</span>
        <div class="flex items-center gap-1.5">
          <Button
            class="h-7 text-xs"
            disabled={!props.previousAvailable}
            onClick={props.onPrevious}
            size="sm"
            variant="outline"
          >
            {messageTranslate("common.previous")}
          </Button>
          <Button
            class="h-7 text-xs"
            disabled={!props.nextAvailable}
            onClick={props.onNext}
            size="sm"
            variant="outline"
          >
            {messageTranslate("common.next")}
          </Button>
        </div>
      </nav>
    </Show>
  )
}
