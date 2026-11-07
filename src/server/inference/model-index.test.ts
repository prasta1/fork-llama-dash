import { beforeEach, describe, expect, it } from 'vitest'
import { clearModelIndex, getModelOwners, getOwningNodeId, setNodeModels } from './model-index.ts'

describe('model index', () => {
  beforeEach(() => clearModelIndex())

  it('returns null for an unknown model', () => {
    expect(getOwningNodeId('nope')).toBeNull()
    expect(getModelOwners('nope')).toEqual([])
  })

  it('returns the only owner', () => {
    setNodeModels('studio', 1, ['qwen3'])
    expect(getOwningNodeId('qwen3')).toBe('studio')
  })

  it('orders owners by priority, not by the order they were set', () => {
    setNodeModels('studio', 1, ['qwen3'])
    setNodeModels('primary', 0, ['qwen3', 'gemma3'])
    expect(getModelOwners('qwen3')).toEqual(['primary', 'studio'])
    expect(getOwningNodeId('gemma3')).toBe('primary')
  })

  it('replaces a node’s models on refresh', () => {
    setNodeModels('studio', 1, ['qwen3'])
    setNodeModels('studio', 1, ['gemma3'])
    expect(getOwningNodeId('qwen3')).toBeNull()
    expect(getOwningNodeId('gemma3')).toBe('studio')
  })

  it('keeps other nodes untouched when one is refreshed', () => {
    setNodeModels('primary', 0, ['qwen3'])
    setNodeModels('studio', 1, ['qwen3'])
    setNodeModels('studio', 1, [])
    expect(getModelOwners('qwen3')).toEqual(['primary'])
  })
})
