import type { DemoFixtureScenarioGroup } from "./demoFixtureScenarioGroupSchema.js"

export const demoConsentScenarioGroups: DemoFixtureScenarioGroup[] = [
  {
    key: "consent",
    title: "Application consent",
    description: "Approve or decline an OpenID Connect application access request using a fixture-backed interaction.",
    scenarios: [
      {
        availability: "available",
        description:
          "Approve or decline an OpenID Connect application access request using a fixture-backed interaction.",
        key: "consent",
        path: "/demo/consent",
        states: ["success", "loading", "error", "expired"],
        title: "Application consent",
      },
    ],
  },
]
