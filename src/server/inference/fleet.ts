import { config } from '../config.ts'
import { inferenceBackend, type InferenceBackend } from './backend.ts'
import { createLlamaSwapBackend } from './backends/llama-swap.ts'

export type FleetHost = {
  id: string
  label: string
  primary: boolean
  backend: InferenceBackend
  /** Path to this host's llama-swap activity SQLite store, for the watchtower. */
  activityStorePath: string | null
}

/**
 * The fleet is the set of llama-swap instances llama-dash can observe.
 * The primary (from INFERENCE_BASE_URL) is always first and is the only one
 * the proxy routes to. Secondaries come from FLEET_HOSTS (comma-separated
 * `id=url` pairs) and are read-only — observed, never routed to.
 */
function parseFleetHosts(): Array<{ id: string; url: string }> {
  const raw = config.fleetHosts.trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const eq = entry.indexOf('=')
      if (eq === -1) return { id: entry, url: entry }
      return { id: entry.slice(0, eq).trim(), url: entry.slice(eq + 1).trim() }
    })
    .filter(({ id, url }) => id && url)
}

/** Parse FLEET_ACTIVITY_PATHS (comma-separated `id=path` pairs). */
function parseActivityPaths(): Map<string, string> {
  const raw = config.fleetActivityPaths.trim()
  if (!raw) return new Map()
  const map = new Map<string, string>()
  for (const entry of raw.split(',')) {
    const eq = entry.indexOf('=')
    if (eq === -1) continue
    const id = entry.slice(0, eq).trim()
    const path = entry.slice(eq + 1).trim()
    if (id && path) map.set(id, path)
  }
  return map
}

const activityPaths = parseActivityPaths()

export const fleet: FleetHost[] = [
  {
    id: 'primary',
    label: 'Primary',
    primary: true,
    backend: inferenceBackend,
    // The primary's activity store is the local llama-swap store, derived from
    // the config file path (config.yaml -> activity.sqlite in the same dir).
    activityStorePath:
      activityPaths.get('primary') ?? config.inferenceConfigFile.replace(/config\.yaml$/, 'activity.sqlite'),
  },
  ...parseFleetHosts().map(({ id, url }) => ({
    id,
    label: id,
    primary: false,
    backend: createLlamaSwapBackend(url),
    activityStorePath: activityPaths.get(id) ?? null,
  })),
]
