import type { User } from "../../users/public/userSchema.js"

export function directoryUserMatchesSearch(user: User, search: string): boolean {
  const needle = search.toLowerCase()
  const haystacks = [
    user.userName,
    user.email,
    user.profile.displayName,
    user.profile.firstName,
    user.profile.lastName,
    user.profile.nickName,
  ]
  return haystacks.some((value) => value?.toLowerCase().includes(needle) === true)
}
