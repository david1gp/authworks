import { expect, test } from "bun:test"
import { oidcProjectFaviconHrefSelect } from "./oidcProjectFaviconHrefSelect.js"

test("project favicon href selects the realm project favicon endpoint", () => {
  expect(
    oidcProjectFaviconHrefSelect({ baseUrl: "https://auth.example.com", projectId: "project-1", realmId: "realm-1" }),
  ).toBe("https://auth.example.com/realms/realm-1/oidc/projects/project-1/favicon")
})

test("project favicon href tolerates a trailing base slash and encodes segments", () => {
  expect(oidcProjectFaviconHrefSelect({ baseUrl: "https://auth.example.com/", projectId: "a/b", realmId: "r 1" })).toBe(
    "https://auth.example.com/realms/r%201/oidc/projects/a%2Fb/favicon",
  )
})
