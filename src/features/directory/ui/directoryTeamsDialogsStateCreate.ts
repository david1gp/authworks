import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { Team } from "../../teams/public/teamSchema.js"
import type { DirectoryTeamsPageState } from "./directoryTeamsPageStateCreate.js"
import { directoryTeamSlugSuggest } from "./directoryTeamSlugSuggest.js"

/**
 * Local create/edit dialog form state for the Teams tab. Dialog visibility
 * lives in `?dialog=`; the slug auto-suggests from the name until the admin
 * edits the slug manually, then the manual value sticks.
 */
export function directoryTeamsDialogsStateCreate(options: { readonly page: DirectoryTeamsPageState }) {
  const page = options.page
  const createName = createSignalObject("")
  const createSlug = createSignalObject("")
  const createSlugManual = createSignalObject(false)
  const createLeaderUserId = createSignalObject("")
  const editName = createSignalObject("")
  const editSlug = createSignalObject("")
  const editSlugManual = createSignalObject(false)
  const editLeaderUserId = createSignalObject("")
  const memberSearch = createSignalObject("")

  const createNameSet = (value: string) => {
    createName.set(value)
    if (!createSlugManual.get()) createSlug.set(directoryTeamSlugSuggest(value))
  }

  const createSlugSet = (value: string) => {
    createSlugManual.set(true)
    createSlug.set(value)
  }

  const createOpen = () => {
    createName.set("")
    createSlug.set("")
    createSlugManual.set(false)
    createLeaderUserId.set("")
    memberSearch.set("")
    page.pickerResultsClear()
  }

  const editNameSet = (value: string) => {
    editName.set(value)
    if (!editSlugManual.get()) editSlug.set(directoryTeamSlugSuggest(value))
  }

  const editSlugSet = (value: string) => {
    editSlugManual.set(true)
    editSlug.set(value)
  }

  const editOpen = (team: Team) => {
    editName.set(team.name)
    editSlug.set(team.slug)
    editSlugManual.set(false)
    editLeaderUserId.set(team.leader.userId)
    memberSearch.set("")
    page.pickerResultsClear()
  }

  const createSubmit = async (): Promise<Team | undefined> => {
    const created = await page.teamCreateSubmit({
      leaderUserId: createLeaderUserId.get(),
      name: createName.get(),
      slug: createSlug.get(),
    })
    if (created !== undefined) {
      createName.set("")
      createSlug.set("")
      createSlugManual.set(false)
      createLeaderUserId.set("")
    }
    return created
  }

  const editSubmit = async (team: Team): Promise<Team | undefined> => {
    const name = editName.get().trim()
    const slug = editSlug.get()
    const leaderUserId = editLeaderUserId.get()
    const updated = await page.teamUpdateSubmit(team, {
      ...(leaderUserId === team.leader.userId ? {} : { leaderUserId }),
      ...(name === team.name ? {} : { name }),
      ...(slug === team.slug ? {} : { slug }),
    })
    return updated
  }

  return {
    createLeaderUserId,
    createName,
    createNameSet,
    createOpen,
    createSlug,
    createSlugSet,
    createSubmit,
    editLeaderUserId,
    editName,
    editNameSet,
    editOpen,
    editSlug,
    editSlugSet,
    editSubmit,
    memberSearch,
    validationMessage: () => page.validationMessage(),
  }
}

export type DirectoryTeamsDialogsState = ReturnType<typeof directoryTeamsDialogsStateCreate>
