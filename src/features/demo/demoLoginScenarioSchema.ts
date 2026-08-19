import * as v from "valibot"

export const demoLoginScenarioSchema = v.pipe(v.string(), v.regex(/^\/demo\/login(?:\/[a-z0-9-]+)*$/))

export type DemoLoginScenario = v.InferOutput<typeof demoLoginScenarioSchema>
