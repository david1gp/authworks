import { dirname, join } from "node:path"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { connectionProfileLegacyGet } from "../../connectionProfiles/public/connectionProfileLegacyGet.js"
import { connectionProfileNameValidate } from "../../connectionProfiles/public/connectionProfileNameValidate.js"
import {
  type AuthworksConfigurationPathOptions,
  authworksConfigurationDirectoryPathResolve,
} from "./authworksConfigurationDirectoryPathResolve.js"
import { authworksConfigurationLoad } from "./authworksConfigurationLoad.js"
import {
  type AuthworksConfigurationFilePathOptions,
  authworksConfigurationPathResolve,
} from "./authworksConfigurationPathResolve.js"
import { authworksCredentialsLoad } from "./authworksCredentialsLoad.js"
import type { AuthworksCredentialsPathOptions } from "./authworksCredentialsPathResolve.js"
import { authworksDotenvEnvironmentLoad } from "./authworksDotenvEnvironmentLoad.js"
import type { AuthworksProfile } from "../public/authworksProfileSchema.js"
import { authworksProjectLoad } from "./authworksProjectLoad.js"
import type { AuthworksProjectPathOptions } from "./authworksProjectPathResolve.js"
import type { AuthworksProject } from "../public/authworksProjectSchema.js"

export type AuthworksConfigurationResolveOptions = AuthworksConfigurationPathOptions &
  AuthworksConfigurationFilePathOptions &
  AuthworksCredentialsPathOptions &
  AuthworksProjectPathOptions & {
    readonly baseUrl?: string
    readonly defaultProfile?: string
    readonly dotenv?: string
    readonly dotenvPath?: string
    readonly envFile?: string
    readonly envFilePath?: string
    readonly legacyProfilesPath?: string
    readonly organizationId?: string
    readonly profile?: string
    readonly project?: string
    readonly projectId?: string
    readonly projectName?: string
    readonly realmId?: string
    readonly server?: string
    readonly token?: string
  }

export type AuthworksResolvedConfiguration = {
  readonly baseUrl: string
  readonly organizationId?: string
  readonly profile?: string
  readonly project?: string
  readonly projectId?: string
  readonly realmId?: string
  readonly token?: string
}

export async function authworksConfigurationResolve(
  options: AuthworksConfigurationResolveOptions = {},
): Promise<Result<AuthworksResolvedConfiguration>> {
  const op = "authworksConfigurationResolve"
  const environment = options.environment ?? process.env
  const dotenv = await authworksDotenvEnvironmentLoad(options)
  if (!dotenv.success) return dotenv

  const configurationPath = authworksConfigurationPathResolve(options)
  const configuration = await authworksConfigurationLoad({ ...options, path: configurationPath })
  if (!configuration.success) return configuration

  const baseDirectory = authworksConfigurationBaseDirectoryResolve(options, configurationPath)
  const selectedProjectName =
    options.project ??
    options.projectName ??
    authworksEnvironmentValueGet(environment, ["AUTHWORKS_PROJECT", "AUTHWORKS_PROJECT_NAME"]) ??
    authworksEnvironmentValueGet(dotenv.data, ["AUTHWORKS_PROJECT", "AUTHWORKS_PROJECT_NAME"])
  let project: AuthworksProject | undefined
  if (selectedProjectName !== undefined) {
    const loadedProject = await authworksProjectLoad(selectedProjectName, {
      ...authworksPathContextCreate(options, baseDirectory),
      projectDirectory: options.projectDirectory ?? options.projectsDirectory ?? join(baseDirectory, "projects"),
      projectPath: options.projectPath,
    })
    if (!loadedProject.success) return loadedProject
    project = loadedProject.data
  }

  const explicitProfile = options.profile
  const environmentProfile = authworksEnvironmentValueGet(environment, ["AUTHWORKS_PROFILE"])
  const dotenvProfile = authworksEnvironmentValueGet(dotenv.data, ["AUTHWORKS_PROFILE"])
  const explicitDefaultProfile = options.defaultProfile
  const environmentDefaultProfile = authworksEnvironmentValueGet(environment, ["AUTHWORKS_DEFAULT_PROFILE"])
  const dotenvDefaultProfile = authworksEnvironmentValueGet(dotenv.data, ["AUTHWORKS_DEFAULT_PROFILE"])
  let selectedProfileName =
    explicitProfile ??
    environmentProfile ??
    dotenvProfile ??
    explicitDefaultProfile ??
    environmentDefaultProfile ??
    dotenvDefaultProfile ??
    project?.profile ??
    configuration.data.defaultProfile
  if (selectedProfileName === undefined && Object.hasOwn(configuration.data.profiles, "default"))
    selectedProfileName = "default"

  const validSelectedProfile =
    selectedProfileName === undefined ? resultCreate(undefined) : connectionProfileNameValidate(selectedProfileName)
  if (!validSelectedProfile.success) return resultErrorCreate(op, "The selected Authworks profile is invalid.")

  let profile: AuthworksProfile | undefined
  let legacyProfile:
    | { readonly organizationId?: string; readonly realmId?: string; readonly server?: string; readonly token?: string }
    | undefined
  if (validSelectedProfile.data !== undefined) {
    profile = configuration.data.profiles[validSelectedProfile.data]
    if (profile === undefined || selectedProfileName === undefined) {
      const legacy = await authworksLegacyProfileGet(options, baseDirectory, validSelectedProfile.data)
      if (!legacy.success) return legacy
      legacyProfile = legacy.data
    }
    if (profile === undefined && legacyProfile === undefined)
      return resultErrorCreate(op, `Authworks profile "${validSelectedProfile.data}" was not found.`)
  } else {
    const legacy = await authworksLegacyProfileGet(options, baseDirectory, "default")
    if (!legacy.success) return legacy
    if (legacy.data !== undefined) {
      selectedProfileName = "default"
      legacyProfile = legacy.data
    }
  }

  const explicitBaseUrl = options.baseUrl ?? options.server
  const environmentBaseUrl = authworksEnvironmentValueGet(environment, [
    "AUTHWORKS_BASE_URL",
    "AUTHWORKS_URL",
    "AUTHWORKS_SERVER",
  ])
  const dotenvBaseUrl = authworksEnvironmentValueGet(dotenv.data, [
    "AUTHWORKS_BASE_URL",
    "AUTHWORKS_URL",
    "AUTHWORKS_SERVER",
  ])
  const baseUrl =
    explicitBaseUrl ??
    environmentBaseUrl ??
    dotenvBaseUrl ??
    profile?.baseUrl ??
    legacyProfile?.server ??
    "http://127.0.0.1:3000"

  const explicitOrganizationId = options.organizationId
  const environmentOrganizationId = authworksEnvironmentValueGet(environment, ["AUTHWORKS_ORGANIZATION_ID"])
  const dotenvOrganizationId = authworksEnvironmentValueGet(dotenv.data, ["AUTHWORKS_ORGANIZATION_ID"])
  const organizationId =
    explicitOrganizationId ??
    environmentOrganizationId ??
    dotenvOrganizationId ??
    profile?.organizationId ??
    legacyProfile?.organizationId

  const explicitRealmId = options.realmId
  const environmentRealmId = authworksEnvironmentValueGet(environment, ["AUTHWORKS_REALM_ID"])
  const dotenvRealmId = authworksEnvironmentValueGet(dotenv.data, ["AUTHWORKS_REALM_ID"])
  const realmId = explicitRealmId ?? environmentRealmId ?? dotenvRealmId ?? profile?.realmId ?? legacyProfile?.realmId

  const explicitProjectId = options.projectId
  const environmentProjectId = authworksEnvironmentValueGet(environment, ["AUTHWORKS_PROJECT_ID"])
  const dotenvProjectId = authworksEnvironmentValueGet(dotenv.data, ["AUTHWORKS_PROJECT_ID"])
  const projectId = explicitProjectId ?? environmentProjectId ?? dotenvProjectId ?? project?.projectId

  const explicitToken = options.token
  const environmentToken = authworksEnvironmentValueGet(environment, ["AUTHWORKS_TOKEN"])
  const dotenvToken = authworksEnvironmentValueGet(dotenv.data, ["AUTHWORKS_TOKEN"])
  let token = explicitToken ?? environmentToken ?? dotenvToken
  if (token === undefined && selectedProfileName !== undefined) {
    const credentials = await authworksCredentialsLoad(selectedProfileName, {
      ...authworksPathContextCreate(options, baseDirectory),
      credentialsDirectory: options.credentialsDirectory ?? join(baseDirectory, "credentials"),
      credentialsPath: options.credentialsPath,
    })
    if (!credentials.success) return credentials
    token = credentials.data.token
    if (token === undefined && legacyProfile === undefined) {
      const legacy = await authworksLegacyProfileGet(options, baseDirectory, selectedProfileName)
      if (!legacy.success) return legacy
      legacyProfile = legacy.data
    }
    token ??= legacyProfile?.token
  }

  if (!isNonEmptyString(baseUrl)) return resultErrorCreate(op, "The Authworks base URL is invalid.")
  if (!isOptionalNonEmptyString(organizationId))
    return resultErrorCreate(op, "The Authworks organization ID is invalid.")
  if (!isOptionalNonEmptyString(realmId)) return resultErrorCreate(op, "The Authworks realm ID is invalid.")
  if (!isOptionalNonEmptyString(projectId)) return resultErrorCreate(op, "The Authworks project ID is invalid.")
  if (!isOptionalNonEmptyString(token)) return resultErrorCreate(op, "The Authworks token is invalid.")

  return resultCreate({
    baseUrl,
    ...(organizationId === undefined ? {} : { organizationId }),
    ...(selectedProfileName === undefined ? {} : { profile: selectedProfileName }),
    ...(selectedProjectName === undefined ? {} : { project: selectedProjectName }),
    ...(projectId === undefined ? {} : { projectId }),
    ...(realmId === undefined ? {} : { realmId }),
    ...(token === undefined ? {} : { token }),
  })
}

function authworksConfigurationBaseDirectoryResolve(
  options: AuthworksConfigurationResolveOptions,
  configurationPath: string,
): string {
  const explicitDirectory =
    options.directory ?? options.configDirectory ?? options.configurationDirectory ?? options.rootDirectory
  if (explicitDirectory !== undefined) return explicitDirectory
  if (options.path !== undefined || options.configPath !== undefined || options.configurationPath !== undefined)
    return dirname(configurationPath)
  return authworksConfigurationDirectoryPathResolve(options)
}

function authworksPathContextCreate(
  options: AuthworksConfigurationResolveOptions,
  baseDirectory: string,
): AuthworksConfigurationPathOptions {
  return {
    configDirectory: baseDirectory,
    environment: options.environment,
    homeDirectory: options.homeDirectory,
  }
}

async function authworksLegacyProfileGet(
  options: AuthworksConfigurationResolveOptions,
  baseDirectory: string,
  name: string,
): Promise<
  Result<
    | { readonly organizationId?: string; readonly realmId?: string; readonly server?: string; readonly token?: string }
    | undefined
  >
> {
  return connectionProfileLegacyGet(name, {
    path: options.legacyProfilesPath ?? join(baseDirectory, "profiles.json"),
  })
}

function authworksEnvironmentValueGet(
  environment: Readonly<Record<string, string | undefined>>,
  names: readonly string[],
): string | undefined {
  for (const name of names) {
    const value = environment[name]
    if (value !== undefined && value.length > 0) return value
  }
  return undefined
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function isOptionalNonEmptyString(value: unknown): value is string | undefined {
  return value === undefined || isNonEmptyString(value)
}
