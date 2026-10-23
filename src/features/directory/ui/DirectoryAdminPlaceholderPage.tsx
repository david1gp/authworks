import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DirectoryAdminPlaceholder } from "./DirectoryAdminPlaceholder.js"

/** Shared coming-soon shell for new admin screens: translated header plus translated empty body. */
export function DirectoryAdminPlaceholderPage(props: {
  readonly descriptionKey: MessageKey
  readonly eyebrowKey: MessageKey
  readonly titleKey: MessageKey
}) {
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AuthenticatedPageHeader
        description={messageTranslate(props.descriptionKey)}
        eyebrow={messageTranslate(props.eyebrowKey)}
        title={messageTranslate(props.titleKey)}
      />
      <DirectoryAdminPlaceholder descriptionKey={props.descriptionKey} titleKey={props.titleKey} />
    </div>
  )
}
