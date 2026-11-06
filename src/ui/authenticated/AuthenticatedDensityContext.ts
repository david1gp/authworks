import { createContext } from "solid-js"

export const AuthenticatedDensityContext = createContext<"comfortable" | "compact">("comfortable")
