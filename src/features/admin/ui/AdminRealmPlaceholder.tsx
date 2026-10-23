import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DirectoryAdminPlaceholder } from "../../directory/ui/DirectoryAdminPlaceholder.js"

/** Temporary merged realm overview+settings shell; the realm page task replaces the body. */
export function AdminRealmPlaceholder() {
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AuthenticatedPageHeader
        description={messageTranslate("admin.realm.overview.placeholder")}
        title={messageTranslate("shell.nav.realmOverviewSettings")}
      />
      <DirectoryAdminPlaceholder
        descriptionKey="admin.realm.overview.placeholder"
        titleKey="shell.nav.realmOverviewSettings"
      />
    </div>
  )
}
