import * as v from 'valibot'
import { GpuInfoSchema } from './gpu'
import { InferenceHardwareSchema } from './inference-hardware'

const InferenceCapabilitiesSchema = v.object({
  models: v.boolean(),
  runningModels: v.boolean(),
  lifecycle: v.boolean(),
  logs: v.boolean(),
  config: v.boolean(),
  metrics: v.boolean(),
})

export const ApiSystemStatusSchema = v.object({
  runtime: v.object({
    uptimeSec: v.number(),
    nodeVersion: v.string(),
    gitCommit: v.string(),
    update: v.object({
      status: v.union([v.literal('unknown'), v.literal('current'), v.literal('available'), v.literal('error')]),
      current: v.string(),
      latest: v.nullable(v.string()),
      url: v.nullable(v.string()),
      checkedAt: v.nullable(v.number()),
    }),
  }),
  database: v.object({
    path: v.string(),
    specialPath: v.boolean(),
  }),
  proxy: v.object({
    upstreamBaseUrl: v.string(),
    upstreamHost: v.string(),
    insecureTls: v.boolean(),
    directTargets: v.array(v.string()),
  }),
  inference: v.object({
    kind: v.string(),
    label: v.string(),
    capabilities: InferenceCapabilitiesSchema,
  }),
  // One entry per fleet host; empty for a single-host fleet, where the panels above already say it all.
  nodes: v.array(
    v.object({
      id: v.string(),
      label: v.string(),
      primary: v.boolean(),
      upstreamHost: v.string(),
      health: v.object({
        reachable: v.boolean(),
        latencyMs: v.optional(v.number()),
        version: v.optional(v.string()),
        error: v.optional(v.string()),
      }),
      capabilities: InferenceCapabilitiesSchema,
    }),
  ),
  inferenceHardware: v.nullable(InferenceHardwareSchema),
  logging: v.object({
    queued: v.number(),
    dropped: v.number(),
  }),
  gpu: v.object({
    available: v.boolean(),
    cpuUtilizationPercent: v.nullable(v.number()),
    driver: v.nullable(v.union([v.literal('nvidia'), v.literal('amd'), v.literal('apple')])),
    gpuCount: v.number(),
    polledAt: v.number(),
    ageMs: v.nullable(v.number()),
    gpus: v.array(GpuInfoSchema),
  }),
})

export type ApiSystemStatus = v.InferOutput<typeof ApiSystemStatusSchema>

export const LoginMetaSchema = v.object({
  instanceLabel: v.string(),
  uptimeLabel: v.string(),
  commitLabel: v.string(),
  tlsLabel: v.string(),
  signupAllowed: v.boolean(),
})

export type LoginMeta = v.InferOutput<typeof LoginMetaSchema>
