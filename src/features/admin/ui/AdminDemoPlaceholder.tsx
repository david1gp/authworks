import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { DemoScenarioPlaceholder } from "../../demo/ui/DemoScenarioPlaceholder.js"

export function AdminDemoPlaceholder() {
  return <DemoScenarioPlaceholder backHref="/demo/admin" groups={demoAdminScenarioGroups} />
}
