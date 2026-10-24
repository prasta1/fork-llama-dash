import * as v from 'valibot'

const BackendModelCapabilitiesSchema = v.object({
  inputModalities: v.array(v.string()),
  outputModalities: v.array(v.string()),
  flags: v.array(v.string()),
  supportedParameters: v.array(v.string()),
})

const BackendModelSelectorSchema = v.object({
  strategy: v.string(),
  targets: v.array(v.string()),
  spillover: v.optional(v.nullable(v.number())),
})

const BackendModelSchema = v.object({
  id: v.string(),
  name: v.string(),
  kind: v.union([v.literal('local'), v.literal('peer'), v.literal('selector')]),
  peerId: v.nullable(v.string()),
  selector: v.nullable(BackendModelSelectorSchema),
  running: v.boolean(),
  contextLength: v.nullable(v.number()),
  capabilities: BackendModelCapabilitiesSchema,
})

const BackendRunningModelSchema = v.object({
  model: v.string(),
  state: v.string(),
  ttl: v.nullable(v.number()),
  contextLength: v.nullable(v.number()),
})

export const FleetHostSchema = v.object({
  id: v.string(),
  label: v.string(),
  primary: v.boolean(),
  upstreamHost: v.string(),
  health: v.object({
    reachable: v.boolean(),
    health: v.optional(v.string()),
    version: v.optional(v.string()),
    commit: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  models: v.array(BackendModelSchema),
  running: v.array(BackendRunningModelSchema),
})

export const FleetResponseSchema = v.object({
  hosts: v.array(FleetHostSchema),
})

export type ApiFleetHost = v.InferOutput<typeof FleetHostSchema>
export type ApiFleetResponse = v.InferOutput<typeof FleetResponseSchema>
