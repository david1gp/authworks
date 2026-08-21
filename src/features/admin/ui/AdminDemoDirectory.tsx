import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { DemoDirectory } from "../../demo/ui/DemoDirectory.js"

export function AdminDemoDirectory() {
  return (
    <DemoDirectory
      eyebrow="Realm administration"
      title="Administration directory"
      description="Navigate the current realm using an information architecture shaped around people, organizations, applications, credentials, and audit activity. Available demos and planned stateless destinations are clearly separated."
      groups={demoAdminScenarioGroups}
    />
  )
}
