import { mdiAccountCogOutline } from "@adaptive-ds/mdi/mdiAccountCogOutline.js"
import { mdiAccountEyeOutline } from "@adaptive-ds/mdi/mdiAccountEyeOutline.js"
import { mdiAccountGroupOutline } from "@adaptive-ds/mdi/mdiAccountGroupOutline.js"
import { mdiAccountMultipleOutline } from "@adaptive-ds/mdi/mdiAccountMultipleOutline.js"
import { mdiAccountMultiplePlusOutline } from "@adaptive-ds/mdi/mdiAccountMultiplePlusOutline.js"
import { mdiAccountOutline } from "@adaptive-ds/mdi/mdiAccountOutline.js"
import { mdiAccountPlus } from "@adaptive-ds/mdi/mdiAccountPlus.js"
import { mdiAccountStarOutline } from "@adaptive-ds/mdi/mdiAccountStarOutline.js"
import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { mdiCogOutline } from "@adaptive-ds/mdi/mdiCogOutline.js"
import { mdiContentCopy } from "@adaptive-ds/mdi/mdiContentCopy.js"
import { mdiDeleteOutline } from "@adaptive-ds/mdi/mdiDeleteOutline.js"
import { mdiEmailPlusOutline } from "@adaptive-ds/mdi/mdiEmailPlusOutline.js"
import { mdiFilterRemoveOutline } from "@adaptive-ds/mdi/mdiFilterRemoveOutline.js"
import { mdiPencil } from "@adaptive-ds/mdi/mdiPencil.js"
import { mdiPlus } from "@adaptive-ds/mdi/mdiPlus.js"
import { mdiRefresh } from "@adaptive-ds/mdi/mdiRefresh.js"
import { mdiRobotOutline } from "@adaptive-ds/mdi/mdiRobotOutline.js"
import { mdiShieldCrownOutline } from "@adaptive-ds/mdi/mdiShieldCrownOutline.js"
import { mdiShieldOutline } from "@adaptive-ds/mdi/mdiShieldOutline.js"

/**
 * Zentral MDI icon registry: single source of truth for shared icons.
 * Every button, tab, chip, and empty state imports its path from here
 * instead of `@adaptive-ds/mdi` directly, so People, Service accounts,
 * Pending invitations, and every role render the same icon everywhere.
 */
export const authenticatedIconRegistry = {
  directoryClearFilters: mdiFilterRemoveOutline,
  directoryCreateServiceAccount: mdiRobotOutline,
  directoryCreateUser: mdiAccountPlus,
  directoryInvite: mdiAccountMultiplePlusOutline,
  directoryInviteAcknowledge: mdiCheck,
  directoryInviteCopy: mdiContentCopy,
  directoryInviteRevoke: mdiCancel,
  directoryRetry: mdiRefresh,
  directoryRoleAdmin: mdiAccountCogOutline,
  directoryRoleAll: mdiAccountStarOutline,
  directoryRoleGuest: mdiAccountEyeOutline,
  directoryRoleMember: mdiAccountOutline,
  directoryRoleOwner: mdiShieldCrownOutline,
  directoryTabInvitations: mdiEmailPlusOutline,
  directoryTabPeople: mdiAccountMultipleOutline,
  directoryTabTeams: mdiAccountGroupOutline,
  directoryTeamCreate: mdiPlus,
  directoryTeamDelete: mdiDeleteOutline,
  directoryTeamEdit: mdiPencil,
  directoryTeamManage: mdiCogOutline,
  directoryTabServiceAccounts: mdiRobotOutline,
  userProfileTabAccess: mdiAccountStarOutline,
  userProfileTabOverview: mdiAccountOutline,
  userProfileTabSecurity: mdiShieldOutline,
} as const

export type AuthenticatedIconKey = keyof typeof authenticatedIconRegistry
