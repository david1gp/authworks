import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { DemoDirectory } from "../../demo/ui/DemoDirectory.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

export function AdminDemoDirectory() {
  return (
    <DemoDirectory
      eyebrow={messageTranslate("demo.admin.eyebrow")}
      title={messageTranslate("demo.admin.directoryTitle")}
      description={messageTranslate("demo.admin.description")}
      groups={demoAdminScenarioGroups}
    />
  )
}
