import { connectionProfileCliProfileFlag } from "./connectionProfileCliProfileFlag.js"

export function connectionProfileCliCentralFlags() {
  return {
    baseUrl: connectionProfileCliValueFlag("Authworks base URL", "URL"),
    envFile: connectionProfileCliValueFlag("Dotenv environment file", "PATH"),
    profile: connectionProfileCliProfileFlag(),
    project: connectionProfileCliValueFlag("Central Authworks project name", "NAME"),
    url: connectionProfileCliValueFlag("Authworks server URL", "URL"),
  }
}

function connectionProfileCliValueFlag(brief: string, placeholder: string) {
  return {
    brief,
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder,
  }
}
