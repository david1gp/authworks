import { useLocation } from "@solidjs/router"
import { adminActivityDemoAdapterCreate } from "./adminActivityDemoAdapterCreate.js"
import { adminActivityDemoAccessPermits } from "./adminActivityDemoAccessPermits.js"
import { adminDemoAccessSelect } from "./adminDemoAppStateCreate.js"
import { adminDemoEventFixtures } from "./adminDemoEventFixtures.js"

export function adminActivityDemoStateCreate() {
  const location = useLocation()
  const realmId = () => "01900000-0000-7000-8000-000000000001"
  const organization = "01900000-0000-7000-8000-000000000011"
  const organizationId = () => (adminDemoAccessSelect(location.search) === "realm-admin" ? undefined : organization)
  return {
    allowed: () => adminActivityDemoAccessPermits(location.search),
    realmId,
    organizationId,
    contextLabel: () => (organizationId() === undefined ? "Northwind customer identity" : "Northwind Labs"),
    adapter: adminActivityDemoAdapterCreate({
      realmEvents: adminDemoEventFixtures,
      organizationEvents: {
        [organization]: adminDemoEventFixtures.filter(
          (event) => event.aggregateType === "organization" && event.aggregateId === organization,
        ),
      },
    }),
  }
}
