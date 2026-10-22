export type OidcProjectBoundaryEnvironment = "production" | "development"

export type OidcProjectBoundaryConfig = {
  readonly slug: string
  readonly displayName: string
  readonly productionName: string
  readonly developmentName: string
  readonly productionRedirectUris: readonly string[]
  readonly developmentRedirectUris: readonly string[]
}

const oidcProjectBoundaryConfigs: readonly OidcProjectBoundaryConfig[] = [
  {
    slug: "eventoren",
    displayName: "Eventoren",
    productionName: "Eventoren production",
    developmentName: "Eventoren development",
    productionRedirectUris: ["https://eventoren.de/login/authworks/callback"],
    developmentRedirectUris: ["https://eventoren.leonardomora.de/login/authworks/callback"],
  },
  {
    slug: "solid-convex",
    displayName: "Solid Convex",
    productionName: "Solid Convex production",
    developmentName: "Solid Convex development",
    productionRedirectUris: ["https://solid-convex.contentoren.de/login/authworks/callback"],
    developmentRedirectUris: [
      "http://127.0.0.1:3016/login/authworks/callback",
      "https://solid-convex.leonardomora.de/login/authworks/callback",
    ],
  },
  {
    slug: "semesterkur",
    displayName: "Semesterkur",
    productionName: "Semesterkur production",
    developmentName: "Semesterkur development",
    productionRedirectUris: ["https://semesterkur.com/login/authworks/callback"],
    developmentRedirectUris: [
      "http://127.0.0.1:3053/login/authworks/callback",
      "https://semesterkur.leonardomora.de/login/authworks/callback",
    ],
  },
  {
    slug: "coachingcompany",
    displayName: "Coaching Company",
    productionName: "Coaching Company production",
    developmentName: "Coaching Company development",
    productionRedirectUris: ["https://coachingcompany.contentoren.de/login/authworks/callback"],
    developmentRedirectUris: [
      "http://127.0.0.1:3134/login/authworks/callback",
      "https://coachingcompany.leonardomora.de/login/authworks/callback",
    ],
  },
  {
    slug: "filmschauspielschule",
    displayName: "Filmschauspielschule",
    productionName: "Filmschauspielschule production",
    developmentName: "Filmschauspielschule development",
    productionRedirectUris: ["https://filmschauspielschule.contentoren.de/login/authworks/callback"],
    developmentRedirectUris: [
      "http://127.0.0.1:3132/login/authworks/callback",
      "https://filmschauspielschule.leonardomora.de/login/authworks/callback",
    ],
  },
  {
    slug: "crm",
    displayName: "CRM",
    productionName: "CRM production",
    developmentName: "CRM development",
    productionRedirectUris: ["https://crm.contentoren.de/auth/authworks/callback"],
    developmentRedirectUris: [
      "http://127.0.0.1:5173/auth/authworks/callback",
      "https://api.preview.crm.contentoren.de/api/auth/authworks/callback",
    ],
  },
  {
    slug: "allgroups-chat",
    displayName: "Allgroups Chat",
    productionName: "Allgroups Chat production",
    developmentName: "Allgroups Chat development",
    productionRedirectUris: ["https://allgroups.chat/login/authworks/callback"],
    developmentRedirectUris: [
      "http://127.0.0.1:3017/login/authworks/callback",
      "https://preview.allgroups.chat/login/authworks/callback",
    ],
  },
  {
    slug: "akademie",
    displayName: "Akademie",
    productionName: "Akademie production",
    developmentName: "Akademie development",
    productionRedirectUris: ["https://api.akademie.contentoren.de/api/auth/authworks"],
    developmentRedirectUris: ["https://api.preview.akademie.contentoren.de/api/auth/authworks"],
  },
  {
    slug: "archive",
    displayName: "Archive",
    productionName: "Archive production",
    developmentName: "Archive development",
    productionRedirectUris: ["https://archive-api.contentoren.de/api/auth/authworks/callback"],
    developmentRedirectUris: [
      "http://127.0.0.1:3243/api/auth/authworks/callback",
      "https://archive-api.leonardomora.de/api/auth/authworks/callback",
    ],
  },
]

export const oidcProjectBoundaryRegistry: Record<string, OidcProjectBoundaryConfig> = Object.fromEntries(
  oidcProjectBoundaryConfigs.map((config) => [config.slug, config]),
)
