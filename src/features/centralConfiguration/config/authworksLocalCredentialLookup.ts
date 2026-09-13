import { dirname, join } from "node:path"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { authworksConfigurationDirectoryPathResolve } from "./authworksConfigurationDirectoryPathResolve.js"
import { authworksConfigurationPathResolve } from "./authworksConfigurationPathResolve.js"
import {
  type AuthworksConfigurationResolveOptions,
  authworksConfigurationResolve,
} from "./authworksConfigurationResolve.js"
import { type AuthworksCredentialsLoadOptions, authworksCredentialsLoad } from "./authworksCredentialsLoad.js"
import { authworksDotenvEnvironmentLoad } from "./authworksDotenvEnvironmentLoad.js"
import { authworksProjectLoad } from "./authworksProjectLoad.js"
import type { AuthworksTestUser } from "../public/authworksTestUserSchema.js"

export type AuthworksLocalCredentialLookupOptions = AuthworksConfigurationResolveOptions & {
  readonly alias: string
}

export async function authworksLocalCredentialLookup(
  input: string | AuthworksLocalCredentialLookupOptions,
  options: AuthworksConfigurationResolveOptions = {},
): Promise<Result<AuthworksTestUser | undefined>> {
  const alias = typeof input === "string" ? input : input.alias
  const resolveOptions = typeof input === "string" ? options : input
  if (typeof alias !== "string" || alias.length === 0)
    return resultErrorCreate("authworksLocalCredentialLookup", "The test-user alias is invalid.")

  const environment = resolveOptions.environment ?? process.env
  const dotenv = await authworksDotenvEnvironmentLoad(resolveOptions)
  if (!dotenv.success) return dotenv

  const selectedProfile =
    resolveOptions.profile ??
    authworksLocalEnvironmentValueGet(environment, "AUTHWORKS_PROFILE") ??
    authworksLocalEnvironmentValueGet(dotenv.data, "AUTHWORKS_PROFILE")
  if (selectedProfile !== undefined && selectedProfile.length > 0)
    return authworksLocalCredentialGet(selectedProfile, alias, resolveOptions)

  const selectedProject =
    resolveOptions.project ??
    resolveOptions.projectName ??
    authworksLocalEnvironmentValueGet(environment, "AUTHWORKS_PROJECT", "AUTHWORKS_PROJECT_NAME") ??
    authworksLocalEnvironmentValueGet(dotenv.data, "AUTHWORKS_PROJECT", "AUTHWORKS_PROJECT_NAME")
  if (selectedProject !== undefined && selectedProject.length > 0) {
    const project = await authworksProjectLoad(selectedProject, authworksLocalProjectLoadOptionsCreate(resolveOptions))
    if (!project.success) return project
    return authworksLocalCredentialGet(project.data.profile, alias, resolveOptions)
  }

  const resolved = await authworksConfigurationResolve(resolveOptions)
  if (!resolved.success) return resolved
  if (resolved.data.profile === undefined) return authworksLocalCredentialGet("default", alias, resolveOptions)
  return authworksLocalCredentialGet(resolved.data.profile, alias, resolveOptions)
}

function authworksLocalEnvironmentValueGet(
  environment: Readonly<Record<string, string | undefined>>,
  ...names: readonly string[]
): string | undefined {
  return names.map((name) => environment[name]).find((value) => value !== undefined && value.length > 0)
}

async function authworksLocalCredentialGet(
  profile: string,
  alias: string,
  options: AuthworksConfigurationResolveOptions,
): Promise<Result<AuthworksTestUser | undefined>> {
  const credentials = await authworksCredentialsLoad(profile, authworksLocalCredentialLoadOptionsCreate(options))
  if (!credentials.success) return credentials
  const testUsers = credentials.data.testUsers
  return resultCreate(testUsers !== undefined && Object.hasOwn(testUsers, alias) ? testUsers[alias] : undefined)
}

function authworksLocalCredentialLoadOptionsCreate(
  options: AuthworksConfigurationResolveOptions,
): AuthworksCredentialsLoadOptions {
  const configurationPath = authworksConfigurationPathResolve(options)
  const explicitDirectory =
    options.directory ?? options.configDirectory ?? options.configurationDirectory ?? options.rootDirectory
  const baseDirectory =
    explicitDirectory ??
    (options.path !== undefined || options.configPath !== undefined || options.configurationPath !== undefined
      ? dirname(configurationPath)
      : authworksConfigurationDirectoryPathResolve(options))
  return {
    configDirectory: baseDirectory,
    credentialsDirectory: options.credentialsDirectory ?? join(baseDirectory, "credentials"),
    credentialsPath: options.credentialsPath,
    environment: options.environment,
    homeDirectory: options.homeDirectory,
    path: undefined,
  }
}

function authworksLocalProjectLoadOptionsCreate(options: AuthworksConfigurationResolveOptions) {
  const configurationPath = authworksConfigurationPathResolve(options)
  const explicitDirectory =
    options.directory ?? options.configDirectory ?? options.configurationDirectory ?? options.rootDirectory
  const baseDirectory =
    explicitDirectory ??
    (options.path !== undefined || options.configPath !== undefined || options.configurationPath !== undefined
      ? dirname(configurationPath)
      : authworksConfigurationDirectoryPathResolve(options))
  return {
    configDirectory: baseDirectory,
    environment: options.environment,
    homeDirectory: options.homeDirectory,
    projectDirectory: options.projectDirectory ?? options.projectsDirectory ?? join(baseDirectory, "projects"),
    projectPath: options.projectPath,
  }
}
