import { demoLoginScenarioGroups } from "../demoLoginScenarioGroups.js"
import { DemoDirectory } from "./DemoDirectory.js"

export function DemoLoginDirectory() {
  return <DemoDirectory groups={demoLoginScenarioGroups} />
}
