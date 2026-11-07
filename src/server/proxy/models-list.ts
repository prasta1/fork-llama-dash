import { config } from '../config.ts'
import { fleet } from '../inference/fleet.ts'

type ModelEntry = { id: string } & Record<string, unknown>

type ModelsListDeps = {
  enabled: boolean
  /** In priority order, primary first. */
  hosts: ReadonlyArray<{ listModelsRaw?: () => Promise<Array<ModelEntry>> }>
}

const defaultDeps: ModelsListDeps = {
  enabled: config.fleetRouting,
  hosts: fleet.map((h) => ({ listModelsRaw: h.backend.listModelsRaw?.bind(h.backend) })),
}

/** Concatenate catalogs, keeping the first entry per id so the higher-priority host wins duplicates. */
export function mergeModelLists(lists: ReadonlyArray<ReadonlyArray<ModelEntry>>): Array<ModelEntry> {
  const seen = new Set<string>()
  const merged: Array<ModelEntry> = []
  for (const list of lists) {
    for (const entry of list) {
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      merged.push(entry)
    }
  }
  return merged
}

/**
 * Answer GET /v1/models with every fleet host's catalog merged, so clients can discover models that
 * live on a secondary. Returns null when it doesn't apply (routing off, a single host) or when no host
 * answered — the caller then relays to the primary as before, so the client sees its real error.
 * Unreachable hosts are skipped: a partial list beats a failed call.
 */
export async function mergedModelsResponse(deps: ModelsListDeps = defaultDeps): Promise<Response | null> {
  const hosts = deps.hosts.filter((h) => h.listModelsRaw)
  if (!deps.enabled || hosts.length < 2) return null

  const results = await Promise.allSettled(hosts.map((h) => h.listModelsRaw!()))
  const lists = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
  if (lists.length === 0) return null

  return Response.json({ object: 'list', data: mergeModelLists(lists) })
}
