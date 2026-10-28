import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createResult } from "#result"
import { adminActivityViewStateCreate } from "./adminActivityViewStateCreate.js"
import { adminDemoEventFixtures } from "./adminDemoEventFixtures.js"

test("activity presentation humanizes event labels, abbreviates actors and redacts expandable details", async () => {
  const event = {
    ...adminDemoEventFixtures[0]!,
    eventType: "organization.member.role_changed",
    payload: { password: "never-render", role: "admin" },
  }
  const scope = createRoot((dispose) => ({
    dispose,
    state: adminActivityViewStateCreate({
      adapter: {
        organizationList: async () => createResult({ items: [event] }),
        realmList: async () => createResult({ items: [] }),
      },
      realmId: () => "realm",
      organizationId: () => "org",
      contextLabel: () => "Northwind Labs",
    }),
  }))
  await Promise.resolve()
  await Promise.resolve()
  expect(scope.state.scope()).toBe("Organization")
  expect(scope.state.contextLabel()).toBe("Northwind Labs")
  expect(scope.state.rows()[0]?.label).toBe("Organization member role changed")
  expect(scope.state.rows()[0]?.actor).not.toContain(event.actorId!)
  expect(scope.state.rows()[0]?.details).not.toContain("never-render")
  expect(scope.state.rows()[0]?.details).toContain("admin")
  expect(scope.state.rows()[0]?.timestamp.length).toBeGreaterThan(0)
  scope.dispose()
})
