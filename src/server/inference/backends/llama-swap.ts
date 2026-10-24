import { createLlamaSwapClient } from '../../llama-swap/client.ts'
import type { OpenAiModel, RunningModel } from '../../llama-swap/client.ts'
import type {
  BackendModel,
  BackendModelCapabilities,
  BackendRunningModel,
  InferenceBackend,
  InferenceBackendInfo,
} from '../backend.ts'
import {
  getLlamaSwapConfigContextLengths,
  getLlamaSwapModelConfigSnippet,
  getLlamaSwapModelLogNames,
} from '../llama-swap-config.ts'

function pickLlamaSwapModelContextLength(model: OpenAiModel): number | null {
  return (
    model.context_length ??
    model.contextLength ??
    model.n_ctx ??
    model.meta?.context_length ??
    model.meta?.contextLength ??
    model.meta?.n_ctx ??
    model.meta?.llamaswap?.context_length ??
    model.meta?.llamaswap?.contextLength ??
    model.meta?.llamaswap?.n_ctx ??
    null
  )
}

function pickLlamaSwapModelCapabilities(model: OpenAiModel): BackendModelCapabilities {
  const inputModalities = model.architecture?.input_modalities ?? []
  const outputModalities = model.architecture?.output_modalities ?? []
  const flags = Object.entries(model.capabilities ?? {})
    .filter(([, value]) => value === true)
    .map(([key]) => key)
    .sort()

  return {
    inputModalities,
    outputModalities,
    flags,
    supportedParameters: model.supported_parameters ?? [],
  }
}

function extractCtxSize(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = value.match(/--ctx-size(?:\s+|=)(\d+)/)
  return match ? Number(match[1]) : null
}

function mapLlamaSwapModel(model: OpenAiModel): BackendModel {
  const llamaSwapMeta = model.meta?.llamaswap
  const isSelector = llamaSwapMeta?.type === 'selector'
  const peerId = isSelector ? null : (llamaSwapMeta?.peerID ?? null)
  return {
    id: model.id,
    name: model.name ?? model.id,
    kind: isSelector ? 'selector' : peerId ? 'peer' : 'local',
    peerId,
    selector: isSelector
      ? {
          strategy: llamaSwapMeta.strategy ?? 'unknown',
          targets: llamaSwapMeta.targets ?? [],
          spillover: llamaSwapMeta.spillover ?? null,
        }
      : null,
    running: model.status?.value === 'loaded',
    contextLength: pickLlamaSwapModelContextLength(model),
    capabilities: pickLlamaSwapModelCapabilities(model),
  }
}

function mapLlamaSwapRunningModel(model: RunningModel): BackendRunningModel {
  return {
    model: model.model,
    state: model.state,
    ttl: model.ttl ?? null,
    contextLength: extractCtxSize(model.cmd),
  }
}

function getLlamaSwapInfo(baseUrl: string): InferenceBackendInfo {
  const upstreamUrl = new URL(baseUrl)
  return {
    kind: 'llama-swap',
    label: 'llama-swap',
    upstreamBaseUrl: baseUrl,
    upstreamHost: upstreamUrl.host,
    capabilities: {
      models: true,
      runningModels: true,
      lifecycle: true,
      logs: true,
      config: true,
      metrics: true,
    },
  }
}

export function createLlamaSwapBackend(baseUrl: string): InferenceBackend {
  const client = createLlamaSwapClient(baseUrl)
  return {
    get info() {
      return getLlamaSwapInfo(baseUrl)
    },
    async ping() {
      const t0 = performance.now()
      try {
        await client.health()
        return { reachable: true, latencyMs: Math.round(performance.now() - t0) }
      } catch {
        return { reachable: false }
      }
    },
    async health() {
      try {
        const t0 = performance.now()
        const [health, version] = await Promise.all([client.health(), client.version()])
        const latencyMs = Math.round(performance.now() - t0)
        return { reachable: true, health: health.trim(), latencyMs, ...version }
      } catch (err) {
        return {
          reachable: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
    defaultProxyUpstream(pathname, search) {
      return `${baseUrl}${pathname}${search}`
    },
    // llama-swap v259 split log traffic from dashboard events. Request the two
    // streams rendered by llama-dash's Logs page; the upstream sends backlog
    // followed by live SSE logData envelopes.
    eventStreamUrl: `${baseUrl}/api/events/logs?stream=proxy&stream=upstream`,
    async listModels() {
      const models = await client.listModels()
      return models.data.map(mapLlamaSwapModel)
    },
    async listRunning() {
      const { running } = await client.listRunning()
      return running.map(mapLlamaSwapRunningModel)
    },
    hardware: () => client.hardware(),
    modelLogNames: getLlamaSwapModelLogNames,
    modelConfigSnippet: getLlamaSwapModelConfigSnippet,
    modelContextLengthHints: getLlamaSwapConfigContextLengths,
    async loadModel(id) {
      await client.loadModel(id)
    },
    async unloadModel(id) {
      await client.unloadModel(id)
    },
    async unloadAll() {
      await client.unloadAll()
    },
  }
}
