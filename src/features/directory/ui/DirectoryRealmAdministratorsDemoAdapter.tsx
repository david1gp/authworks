import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { DirectoryRealmAdministratorsView } from "./DirectoryRealmAdministratorsView.js"
import { directoryRealmAdministratorsDemoStateCreate } from "./directoryRealmAdministratorsDemoStateCreate.js"

/** Demo mount for the realm administrators screen: fixture adapter plus shared view. */
export function DirectoryRealmAdministratorsDemoAdapter() {
  const screen = directoryRealmAdministratorsDemoStateCreate()
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AuthenticatedPageHeader
        description={messageTranslate("demo.admin.scenario.realm_administrators.description")}
        eyebrow={messageTranslate("demo.fixture.preview")}
        meta={
          <>
            <span class="text-xs font-medium text-muted-foreground">{messageTranslate("demo.fixture.state")}</span>
            <DemoFixtureStateSelector options={screen.stateOptions()} />
          </>
        }
        title={messageTranslate("demo.admin.scenario.realm_administrators.title")}
      />
      <DirectoryRealmAdministratorsView state={{ confirmState: screen.confirmState, view: screen.view }} />
    </div>
  )
}
