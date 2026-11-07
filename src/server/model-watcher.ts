import { desc } from 'drizzle-orm'
import { ulid } from 'ulidx'
import { db, schema } from './db/index.ts'
import { fleet, type FleetHost } from './inference/fleet.ts'
import { setNodeModels } from './inference/model-index.ts'
import { publishAdminEvent } from './admin/events.ts'

const POLL_INTERVAL_MS = 15_000

// Keyed by node id: two hosts running the same model name must not cancel each other's load/unload events.
const knownRunning = new Map<string, Set<string>>()
let started = false
let pollTimer: ReturnType<typeof setInterval> | null = null

function seedFromDb() {
  const rows = db
    .select({
      nodeId: schema.modelEvents.nodeId,
      modelId: schema.modelEvents.modelId,
      event: schema.modelEvents.event,
    })
    .from(schema.modelEvents)
    .orderBy(desc(schema.modelEvents.timestamp))
    .all()
  const seen = new Set<string>()
  for (const r of rows) {
    const key = `${r.nodeId}\u0000${r.modelId}`
    if (seen.has(key)) continue
    seen.add(key)
    if (r.event !== 'load') continue
    const known = knownRunning.get(r.nodeId) ?? new Set<string>()
    known.add(r.modelId)
    knownRunning.set(r.nodeId, known)
  }
}

/** Refresh which models this host can serve. Separate from diffNode so one failing call doesn't block the other. */
async function refreshModelIndex(host: FleetHost, priority: number) {
  try {
    const models = await host.backend.listModels()
    setNodeModels(
      host.id,
      priority,
      models.map((m) => m.id),
    )
  } catch {
    // host unreachable — its previous models stay in the index
  }
}

async function diffNode(host: FleetHost) {
  if (!host.backend.listRunning) return

  try {
    const running = await host.backend.listRunning()
    const current = new Set(running.map((r) => r.model))
    const known = knownRunning.get(host.id) ?? new Set<string>()

    const now = new Date()
    const inserts: Array<typeof schema.modelEvents.$inferInsert> = []

    for (const id of current) {
      if (!known.has(id)) {
        inserts.push({ id: `mev_${ulid()}`, nodeId: host.id, modelId: id, event: 'load', timestamp: now })
      }
    }
    for (const id of known) {
      if (!current.has(id)) {
        inserts.push({ id: `mev_${ulid()}`, nodeId: host.id, modelId: id, event: 'unload', timestamp: now })
      }
    }

    if (inserts.length > 0) {
      for (const row of inserts) {
        db.insert(schema.modelEvents).values(row).run()
      }
      publishAdminEvent('model.changed', {
        events: inserts.map((row) => ({ nodeId: row.nodeId, modelId: row.modelId, event: row.event })),
      })
    }

    knownRunning.set(host.id, current)
  } catch {
    // host unreachable — keep its last known state; other hosts are unaffected
  }
}

function diffRunning() {
  return Promise.all(fleet.flatMap((host, priority) => [diffNode(host), refreshModelIndex(host, priority)]))
}

export function startModelWatcher() {
  if (started) return
  started = true

  seedFromDb()
  diffRunning()
  pollTimer = setInterval(diffRunning, POLL_INTERVAL_MS)
}

export function stopModelWatcher() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  started = false
}
