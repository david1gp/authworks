import { englishCatalog } from "../../../ui/i18n/model/englishCatalog.js"
import type { Realm } from "../../realms/public/realmSchema.js"

const fixtureNow = Date.UTC(2026, 7, 21, 9, 30)

/** Creates deterministic English-source realm content translated by the reactive administration view. */
export function adminDemoRealmFixtureCreate(): Realm {
  return {
    createdAt: fixtureNow - 31_536_000_000,
    domain: "auth.northwind.example",
    domains: ["auth.northwind.example", "login.northwind.example"],
    id: "01900000-0000-7000-8000-000000000001",
    name: englishCatalog["demo.admin.realmFixtureName"],
    status: "active",
    updatedAt: fixtureNow - 86_400_000,
  }
}
