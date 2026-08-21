import * as v from "valibot"
import { demoFixtureScenarioSchema } from "./demoFixtureScenarioSchema.js"

export const demoFixtureScenarioGroupSchema = v.object({
  description: v.string(),
  key: v.string(),
  scenarios: v.pipe(v.array(demoFixtureScenarioSchema), v.minLength(1)),
  title: v.string(),
})

export type DemoFixtureScenarioGroup = v.InferOutput<typeof demoFixtureScenarioGroupSchema>
