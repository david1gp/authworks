import * as v from "valibot"
import { demoFixtureStateSchema } from "./demoFixtureStateSchema.js"

export const demoFixtureScenarioSchema = v.object({
  availability: v.picklist(["available", "planned"]),
  description: v.string(),
  key: v.string(),
  path: v.pipe(v.string(), v.startsWith("/demo/")),
  states: v.pipe(v.array(demoFixtureStateSchema), v.minLength(1)),
  title: v.string(),
})

export type DemoFixtureScenario = v.InferOutput<typeof demoFixtureScenarioSchema>
