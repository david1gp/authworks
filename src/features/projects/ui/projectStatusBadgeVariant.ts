const variants = { active: "filledGreen", inactive: "filledYellow", removed: "filledRed" } as const

export function projectStatusBadgeVariant(status: "active" | "inactive" | "removed") {
  return variants[status]
}
