import { mdiDownloadOutline } from "@adaptive-ds/mdi/mdiDownloadOutline.js"
import { Show } from "solid-js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountDisclosure } from "./AccountDisclosure.js"

export function AccountExportCard(props: {
  readonly exportErrorMessage?: string
  readonly exportPending: boolean
  readonly onExportDownload: () => void
}) {
  return (
    <AccountDisclosure
      icon={mdiDownloadOutline}
      summary={messageTranslate("account.export.title")}
      value={messageTranslate("account.export.download")}
      variant="card"
    >
      <p class="mb-3 text-sm text-muted-foreground">{messageTranslate("account.export.description")}</p>
      <Show when={props.exportErrorMessage}>
        {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
      </Show>
      <div class="mt-4">
        <AuthenticatedButton
          disabled={props.exportPending}
          icon={mdiDownloadOutline}
          onClick={() => void props.onExportDownload()}
          variant="outline"
        >
          {props.exportPending
            ? messageTranslate("account.export.downloading")
            : messageTranslate("account.export.download")}
        </AuthenticatedButton>
      </div>
    </AccountDisclosure>
  )
}
