import type { Realm } from "../../realms/public/realmSchema.js"

const fixtureNow = Date.UTC(2026, 7, 21, 9, 30)

export const adminDemoRealmFixture: Realm = {
  createdAt: fixtureNow - 31_536_000_000,
  domain: "auth.northwind.example",
  domains: ["auth.northwind.example", "login.northwind.example"],
  id: "01900000-0000-7000-8000-000000000001",
  name: "Northwind customer identity",
  status: "active",
  updatedAt: fixtureNow - 86_400_000,
}
