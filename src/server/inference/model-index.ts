/**
 * Which fleet hosts can serve which model. Refreshed per node on the
 * model-watcher tick; read synchronously by the proxy, so there is no extra
 * poller and no added latency in the request path.
 *
 * Stored per node (not inverted) so a host that stops answering keeps its last
 * known models until it answers again, instead of vanishing from the index.
 */
const byNode = new Map<string, { priority: number; models: Set<string> }>()

/** Replace one node's model list. Lower `priority` wins ties (fleet order, primary = 0). */
export function setNodeModels(nodeId: string, priority: number, modelIds: Iterable<string>): void {
  byNode.set(nodeId, { priority, models: new Set(modelIds) })
}

/** Node ids serving `modelId`, highest priority first. Empty if the model is unknown. */
export function getModelOwners(modelId: string): Array<string> {
  return [...byNode.entries()]
    .filter(([, node]) => node.models.has(modelId))
    .sort(([, a], [, b]) => a.priority - b.priority)
    .map(([nodeId]) => nodeId)
}

/** Highest-priority owner, or null if unknown. Callers treat null as "use the primary". */
export function getOwningNodeId(modelId: string): string | null {
  return getModelOwners(modelId)[0] ?? null
}

/** Test helper: forget everything. */
export function clearModelIndex(): void {
  byNode.clear()
}
