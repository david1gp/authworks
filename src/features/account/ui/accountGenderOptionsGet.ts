import type { SelectSingleEntry } from "#ui/input/select/SelectSingleEntry.js"

const accountGenderValues = ["unspecified", "woman", "man", "non-binary"] as const

/** Lists the offered gender options, keeping an unrecognized stored value selectable. */
export function accountGenderOptionsGet(currentValue: string): SelectSingleEntry[] {
  const options: SelectSingleEntry[] = accountGenderValues.map((value) => ({ type: "item", value }))
  if (currentValue.length > 0 && !accountGenderValues.includes(currentValue as (typeof accountGenderValues)[number])) {
    options.push({ type: "item", value: currentValue })
  }
  return options
}
