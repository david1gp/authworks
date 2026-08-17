import { Secret } from "./Secret.js"

export function secretCreate(value: string): Secret {
  return new Secret(value)
}
