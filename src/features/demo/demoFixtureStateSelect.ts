import * as v from "valibot"
import { type DemoFixtureState, demoFixtureStateSchema } from "./demoFixtureStateSchema.js"

export function demoFixtureStateSelect(search: string, availableStates: readonly DemoFixtureState[]): DemoFixtureState {
  const requestedState = new URLSearchParams(search).get("state")
  const result = v.safeParse(demoFixtureStateSchema, requestedState)
  if (result.success && availableStates.includes(result.output)) return result.output
  return availableStates[0] ?? "success"
}
