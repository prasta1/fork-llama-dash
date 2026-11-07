import * as v from 'valibot'
import { InferenceHardwareSchema, type InferenceHardware } from '../../lib/schemas/inference-hardware.ts'
import {
  ModelsListResponseSchema,
  RunningResponseSchema,
  VersionResponseSchema,
  type OpenAiModel,
  type RunningModel,
} from './schemas.ts'

export type { InferenceHardware, OpenAiModel, RunningModel }

const stripTrailingSlash = (s: string) => s.replace(/\/+$/, '')

export function createLlamaSwapClient(baseUrl: string) {
  const base = stripTrailingSlash(baseUrl)

  const callText = async (path: string, init?: RequestInit): Promise<string> => {
    const res = await fetch(`${base}${path}`, init)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`llama-swap ${path} -> ${res.status}: ${body.slice(0, 200)}`)
    }
    return res.text()
  }

  const callJson = async <T>(
    path: string,
    schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>,
    init?: RequestInit,
  ): Promise<T> => {
    const res = await fetch(`${base}${path}`, init)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`llama-swap ${path} -> ${res.status}: ${body.slice(0, 200)}`)
    }
    return v.parse(schema, await res.json())
  }

  return {
    baseUrl: base,
    listModels: () => callJson('/v1/models', ModelsListResponseSchema),
    listRunning: () => callJson('/running', RunningResponseSchema),
    unloadModel: (id: string) => callText(`/api/models/unload/${encodeURIComponent(id)}`, { method: 'POST' }),
    loadModel: (id: string) => callText(`/upstream/${encodeURIComponent(id)}/`),
    unloadAll: () => callJson('/api/models/unload', v.object({ msg: v.string() }), { method: 'POST' }),
    health: () => callText('/health'),
    version: () => callJson('/api/version', VersionResponseSchema),
    hardware: () => callJson('/api/hardware', InferenceHardwareSchema),
  }
}
