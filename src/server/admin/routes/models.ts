import { getGpuSnapshot } from '../../gpu-poller.ts'
import { inferenceBackend } from '../../inference/backend.ts'
import { fleet, PRIMARY_NODE_ID } from '../../inference/fleet.ts'
import { getOwningNodeId } from '../../inference/model-index.ts'
import {
  buildApiModel,
  extractModelConfig,
  getConfigContextLengths,
  getModelEvents,
  getModelKeyBreakdown,
  getModelRequestStats,
  getModelRequests,
  listFleetModels,
} from '../model-detail.ts'
import { getModelTimeline } from '../model-events.ts'
import { formatSseEvent, publishAdminEvent, subscribeAdminEvents } from '../events.ts'
import { clamp, error, json, type Route } from './types.ts'

/**
 * The host a load/unload applies to: `?node=` if given, else the host that owns the model, else the primary.
 * Returns null for an unknown `?node=` so the caller can 404 instead of silently acting on another host.
 */
function targetHost(request: Request, modelId?: string) {
  const requested = new URL(request.url).searchParams.get('node')
  if (requested) return fleet.find((h) => h.id === requested) ?? null
  const owner = modelId ? getOwningNodeId(modelId) : null
  return fleet.find((h) => h.id === owner) ?? fleet.find((h) => h.id === PRIMARY_NODE_ID) ?? null
}

export const modelRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/models$/,
    handler: async () => {
      const entries = await listFleetModels()
      const configContextLengths = getConfigContextLengths()
      const rows = entries.map((e) => buildApiModel(e.model, e.running, configContextLengths, e))
      return json(200, { models: rows })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/models\/([^/]+)$/,
    handler: async (_request, match) => {
      const id = decodeURIComponent(match[1])
      const entry = (await listFleetModels()).find((e) => e.model.id === id)
      if (!entry) return error(404, `Model ${id} not found`)
      const configContextLengths = getConfigContextLengths()
      const model = buildApiModel(entry.model, entry.running, configContextLengths, entry)

      const [events, stats, requests, keyBreakdown] = await Promise.all([
        getModelEvents(id),
        getModelRequestStats(id),
        getModelRequests(id, 20),
        getModelKeyBreakdown(id),
      ])
      // The config file is local to the primary; a model only served elsewhere has no snippet here.
      const configSnippet = entry.nodes.includes(PRIMARY_NODE_ID) ? extractModelConfig(id) : null

      return json(200, { model, events, stats, requests, configSnippet, keyBreakdown })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/models\/([^/]+)\/load$/,
    handler: async (request, match) => {
      const id = decodeURIComponent(match[1])
      const host = targetHost(request, id)
      if (!host) return error(404, 'Unknown node')
      if (!host.backend.loadModel) return error(501, 'Inference backend does not support model loading')
      await host.backend.loadModel(id)
      publishAdminEvent('model.changed', { modelId: id, nodeId: host.id, action: 'load' })
      return json(200, { ok: true })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/models\/([^/]+)\/unload$/,
    handler: async (request, match) => {
      const id = decodeURIComponent(match[1])
      const host = targetHost(request, id)
      if (!host) return error(404, 'Unknown node')
      if (!host.backend.unloadModel) return error(501, 'Inference backend does not support model unloading')
      await host.backend.unloadModel(id)
      publishAdminEvent('model.changed', { modelId: id, nodeId: host.id, action: 'unload' })
      return json(200, { ok: true })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/models\/unload$/,
    handler: async (request) => {
      // No model to look up an owner for, so this stays on the primary unless `?node=` says otherwise.
      const host = targetHost(request)
      if (!host) return error(404, 'Unknown node')
      if (!host.backend.unloadAll) return error(501, 'Inference backend does not support unloading all models')
      await host.backend.unloadAll()
      publishAdminEvent('model.changed', { nodeId: host.id, action: 'unload_all' })
      return json(200, { ok: true })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/gpu$/,
    handler: async () => json(200, getGpuSnapshot()),
  },
  {
    method: 'GET',
    pattern: /^\/api\/model-timeline$/,
    handler: async (request) => {
      const url = new URL(request.url)
      const windowMs = clamp(parseInt(url.searchParams.get('window') ?? '1800000', 10), 60_000, 86_400_000)
      return json(200, { events: getModelTimeline(windowMs) })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/events$/,
    handler: async (request) => {
      const encoder = new TextEncoder()
      let unsubscribe: (() => void) | null = null
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(': connected\n\n'))
          unsubscribe = subscribeAdminEvents((event) => {
            try {
              controller.enqueue(encoder.encode(formatSseEvent(event)))
            } catch {
              unsubscribe?.()
            }
          })
        },
        cancel() {
          unsubscribe?.()
        },
      })
      request.signal.addEventListener('abort', () => {
        unsubscribe?.()
      })
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        },
      })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/log-events$/,
    handler: async (request) => {
      if (!inferenceBackend.eventStreamUrl) return error(501, 'Inference backend does not support event streaming')

      const upstream = await fetch(inferenceBackend.eventStreamUrl).catch(() => null)
      if (!upstream?.ok || !upstream.body) return error(502, 'Failed to connect to inference backend event stream')

      const upstreamReader = upstream.body.getReader()
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          void pumpUpstreamEvents(upstreamReader, controller).finally(() => {
            upstreamReader.cancel().catch(() => {})
          })
        },
        cancel() {
          upstreamReader.cancel().catch(() => {})
        },
      })
      request.signal.addEventListener('abort', () => {
        upstreamReader.cancel().catch(() => {})
      })
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        },
      })
    },
  },
]

async function pumpUpstreamEvents(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      controller.enqueue(value)
    }
  } catch {
    // The log stream can end when the upstream connection drops.
  }
}
