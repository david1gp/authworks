import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { DemoDirectory } from "../../demo/ui/DemoDirectory.js"

export function AdminDemoDirectory() {
  return (
    <DemoDirectory
      eyebrow={() => messageTranslate("demo.admin.eyebrow")}
      title={() => messageTranslate("demo.admin.directoryTitle")}
      description={() => messageTranslate("demo.admin.description")}
      groups={demoAdminScenarioGroups}
    />
  )
}
