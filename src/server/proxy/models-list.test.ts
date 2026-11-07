import { describe, expect, it } from 'vitest'
import { mergedModelsResponse, mergeModelLists } from './models-list'

const ok = (...ids: string[]) => ({
  label: 'primary',
  listModelsRaw: async () => ids.map((id) => ({ id, owned_by: 'upstream' })),
})
const down = { label: 'studio', listModelsRaw: async () => Promise.reject(new Error('unreachable')) }

describe('mergeModelLists', () => {
  it('keeps the first entry for a duplicate id, so the higher-priority host wins', () => {
    const merged = mergeModelLists([
      [{ id: 'qwen3', from: 'primary' }],
      [{ id: 'qwen3', from: 'studio' }, { id: 'gemma3' }],
    ])
    expect(merged).toEqual([{ id: 'qwen3', from: 'primary' }, { id: 'gemma3' }])
  })
})

describe('mergedModelsResponse', () => {
  it('returns null when fleet routing is off', async () => {
    expect(await mergedModelsResponse({ enabled: false, hosts: [ok('a'), ok('b')] })).toBeNull()
  })

  it('returns null with a single host', async () => {
    expect(await mergedModelsResponse({ enabled: true, hosts: [ok('a')] })).toBeNull()
  })

  it('merges catalogs and preserves unknown fields', async () => {
    const res = await mergedModelsResponse({ enabled: true, hosts: [ok('a', 'b'), ok('b', 'c')] })
    expect(await res!.json()).toEqual({
      object: 'list',
      data: [
        { id: 'a', owned_by: 'primary' },
        { id: 'b', owned_by: 'primary' },
        { id: 'c', owned_by: 'primary' },
      ],
    })
  })

  it('skips an unreachable host and still answers', async () => {
    const res = await mergedModelsResponse({ enabled: true, hosts: [ok('a'), down] })
    expect((await res!.json()).data).toEqual([{ id: 'a', owned_by: 'primary' }])
  })

  it('returns null when every host fails so the caller relays the real error', async () => {
    expect(await mergedModelsResponse({ enabled: true, hosts: [down, down] })).toBeNull()
  })
})

describe('mergedModelsResponse owned_by', () => {
  it('labels each model with the host that dispatch will pick', async () => {
    const primary = { label: 'Primary', listModelsRaw: async () => [{ id: 'a' }, { id: 'b' }] }
    const studio = { label: 'studio', listModelsRaw: async () => [{ id: 'b' }, { id: 'c', extra: 1 }] }
    const res = await mergedModelsResponse({ enabled: true, hosts: [primary, studio] })
    expect((await res!.json()).data).toEqual([
      { id: 'a', owned_by: 'Primary' },
      { id: 'b', owned_by: 'Primary' },
      { id: 'c', extra: 1, owned_by: 'studio' },
    ])
  })
})
