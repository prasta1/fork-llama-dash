import { isAllowedDirectUpstream } from '../../lib/schemas/routing-rule.ts'
import { config } from '../config.ts'
import { fleet, PRIMARY_NODE_ID } from '../inference/fleet.ts'
import { getOwningNodeId } from '../inference/model-index.ts'

/** The fleet host a request is sent to, and the upstream URL on that host. */
export type NodeRoute = { nodeId: string; upstream: string }

type NodeRouteDeps = {
  enabled: boolean
  hosts: ReadonlyArray<{ id: string; defaultProxyUpstream(pathname: string, search: string): string }>
  owner(model: string): string | null
}

const defaultDeps: NodeRouteDeps = {
  enabled: config.fleetRouting,
  hosts: fleet.map((h) => ({ id: h.id, defaultProxyUpstream: (p, s) => h.backend.defaultProxyUpstream(p, s) })),
  owner: getOwningNodeId,
}

/**
 * Pick the fleet host for a request: the host that owns `model` (highest priority wins ties)
 * when fleet routing is on, otherwise the primary. Unknown or missing models also go to the
 * primary, so llama-swap answers its own 404.
 */
export function resolveNodeRoute(
  model: string | null,
  endpoint: string,
  search: string,
  deps: NodeRouteDeps = defaultDeps,
): NodeRoute {
  const ownerId = deps.enabled && model ? deps.owner(model) : null
  const host = deps.hosts.find((h) => h.id === ownerId) ?? deps.hosts.find((h) => h.id === PRIMARY_NODE_ID)
  if (!host) throw new Error('fleet has no primary host')
  return { nodeId: host.id, upstream: host.defaultProxyUpstream(endpoint, search) }
}

export function buildDirectUpstream(baseUrl: string, endpoint: string, search: string): string {
  if (!isAllowedDirectUpstream(baseUrl)) {
    throw new Error('Direct upstreams are currently limited to api.openai.com, api.anthropic.com, and chatgpt.com')
  }
  const base = new URL(baseUrl)
  if (endpoint === '/v1') {
    base.pathname = base.pathname.replace(/\/$/, '')
  } else if (endpoint.startsWith('/v1/')) {
    base.pathname = `${base.pathname.replace(/\/$/, '')}${endpoint.slice('/v1'.length)}`
  } else {
    base.pathname = endpoint
  }
  base.search = search
  return base.toString()
}

export function selectUpstream(
  defaultUpstream: string,
  routing: { targetType: string | null; targetBaseUrl: string | null },
  endpoint: string,
  search: string,
  node: NodeRoute | null = null,
): string {
  if (routing.targetType === 'direct' && routing.targetBaseUrl) {
    return buildDirectUpstream(routing.targetBaseUrl, endpoint, search)
  }
  return node?.upstream ?? defaultUpstream
}
