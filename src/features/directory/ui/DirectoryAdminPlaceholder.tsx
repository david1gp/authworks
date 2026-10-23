import { AuthenticatedEmptyState } from "../../../ui/authenticated/AuthenticatedEmptyState.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

/** Temporary placeholder for admin screens whose full page task has not landed yet. */
export function DirectoryAdminPlaceholder(props: {
  readonly descriptionKey: MessageKey
  readonly titleKey: MessageKey
}) {
  return (
    <AuthenticatedEmptyState
      description={messageTranslate(props.descriptionKey)}
      title={messageTranslate(props.titleKey)}
    />
  )
}
