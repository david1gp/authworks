import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { demoLoginScenarioGroups } from "../demoLoginScenarioGroups.js"
import { DemoDirectory } from "./DemoDirectory.js"

export function DemoLoginDirectory() {
  return (
    <DemoDirectory
      eyebrow={() => messageTranslate("demo.login.eyebrow")}
      title={() => messageTranslate("demo.login.title")}
      description={() => messageTranslate("demo.login.description")}
      groups={demoLoginScenarioGroups}
    />
  )
}
