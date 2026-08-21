import { demoLoginScenarioGroups } from "../demoLoginScenarioGroups.js"
import { DemoDirectory } from "./DemoDirectory.js"

export function DemoLoginDirectory() {
  return (
    <DemoDirectory
      eyebrow="Hosted authentication"
      title="Login demo"
      description="Explore deterministic sign-in, recovery, and interaction fixtures. Existing flows stay interactive while planned destinations expose their stateless scenario contracts."
      groups={demoLoginScenarioGroups}
    />
  )
}
