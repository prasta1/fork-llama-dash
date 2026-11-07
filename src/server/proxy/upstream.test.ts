import { describe, expect, it } from 'vitest'
import { buildDirectUpstream, resolveNodeRoute, selectUpstream } from './upstream'

describe('buildDirectUpstream', () => {
  it('preserves native llama.cpp endpoints outside the OpenAI v1 namespace', () => {
    expect(buildDirectUpstream('https://api.openai.com/v1', '/infill', '')).toBe('https://api.openai.com/infill')
  })

  it('routes OpenAI Responses requests to the ChatGPT Codex backend', () => {
    expect(buildDirectUpstream('https://chatgpt.com/backend-api/codex', '/v1/responses', '')).toBe(
      'https://chatgpt.com/backend-api/codex/responses',
    )
  })
})

describe('resolveNodeRoute', () => {
  const hosts = [
    { id: 'primary', defaultProxyUpstream: (p: string, s: string) => `http://primary:8080${p}${s}` },
    { id: 'studio', defaultProxyUpstream: (p: string, s: string) => `http://studio:8999${p}${s}` },
  ]
  const owners: Record<string, string> = { gemma3: 'studio', qwen3: 'primary' }
  const deps = (enabled: boolean) => ({ enabled, hosts, owner: (m: string) => owners[m] ?? null })

  it('sends a model to the host that owns it when routing is on', () => {
    expect(resolveNodeRoute('gemma3', '/v1/chat/completions', '', deps(true))).toEqual({
      nodeId: 'studio',
      upstream: 'http://studio:8999/v1/chat/completions',
    })
  })

  it('always uses the primary when routing is off', () => {
    expect(resolveNodeRoute('gemma3', '/v1/chat/completions', '', deps(false)).nodeId).toBe('primary')
  })

  it('falls back to the primary for an unknown or missing model', () => {
    expect(resolveNodeRoute('nope', '/v1/chat/completions', '', deps(true)).nodeId).toBe('primary')
    expect(resolveNodeRoute(null, '/v1/chat/completions', '', deps(true)).nodeId).toBe('primary')
  })

  it('falls back to the primary if the owner is no longer in the fleet', () => {
    expect(resolveNodeRoute('x', '/v1/models', '', { ...deps(true), owner: () => 'removed-node' }).nodeId).toBe(
      'primary',
    )
  })
})

describe('selectUpstream', () => {
  const none = { targetType: null, targetBaseUrl: null }
  const node = { nodeId: 'studio', upstream: 'http://studio:8999/v1/x' }

  it('uses the node route over the default', () => {
    expect(selectUpstream('http://primary/v1/x', none, '/v1/x', '', node)).toBe('http://studio:8999/v1/x')
  })

  it('lets a direct target win over the node route', () => {
    const direct = { targetType: 'direct', targetBaseUrl: 'https://api.openai.com/v1' }
    expect(selectUpstream('http://primary/v1/x', direct, '/v1/x', '', node)).toBe('https://api.openai.com/v1/x')
  })

  it('uses the default when there is no node route', () => {
    expect(selectUpstream('http://primary/v1/x', none, '/v1/x', '')).toBe('http://primary/v1/x')
  })
})
