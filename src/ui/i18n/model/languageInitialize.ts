import { languageApply } from "./languageApply.js"
import { languageResolve } from "./languageResolve.js"

/** Resolves and applies the initial locale before the Solid UI is mounted. */
export async function languageInitialize(browserWindow: Window): Promise<void> {
  let storage: Storage | undefined
  try {
    storage = browserWindow.localStorage
  } catch {}

  const tags =
    browserWindow.navigator.languages.length > 0
      ? browserWindow.navigator.languages
      : [browserWindow.navigator.language]
  await languageApply(languageResolve(storage, tags), browserWindow)
}
