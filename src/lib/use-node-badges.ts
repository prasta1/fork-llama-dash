import { useMemo } from 'react'
import type { ApiModel } from './api'
import { useNodes } from './queries'
import { assignSeriesSteps } from './series-color'

type NodeBadgesFor = (model: Pick<ApiModel, 'nodes' | 'runningNodes'>) => Array<NodeBadgeData>

export type NodeBadgeData = { id: string; label: string; step: number; active: boolean }

/**
 * Returns a function mapping a model to the node badges to show for it. Empty for single-host fleets, so
 * callers render nothing without checking the fleet size themselves.
 */
export function useNodeBadges(): NodeBadgesFor {
  const { data } = useNodes()
  return useMemo<NodeBadgesFor>(() => {
    const nodes = data?.nodes ?? []
    if (nodes.length < 2) return () => []
    const steps = assignSeriesSteps(nodes.map((n) => n.id))
    const byId = new Map(nodes.map((n) => [n.id, { label: n.label, step: steps.get(n.id) ?? 0 }]))
    return (model) =>
      model.nodes.flatMap((id) => {
        const node = byId.get(id)
        return node ? [{ id, ...node, active: model.runningNodes.includes(id) }] : []
      })
  }, [data])
}
