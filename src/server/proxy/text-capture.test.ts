import { describe, expect, it } from 'vitest'
import { BoundedTextCapture, USAGE_TAIL_BYTES } from './text-capture'

describe('BoundedTextCapture', () => {
  it('captures small bodies for usage parsing', () => {
    const capture = new BoundedTextCapture(100)
    capture.append('{"usage":{"total_tokens":3}}')

    expect(capture.text()).toBe('{"usage":{"total_tokens":3}}')
    expect(capture.usageText()).toBe('{"usage":{"total_tokens":3}}')
  })

  it('marks large bodies as truncated but keeps the tail for usage parsing', () => {
    const capture = new BoundedTextCapture(5)
    capture.append('abcdef')

    expect(capture.text()).toContain('[truncated 1 bytes]')
    // The tail keeps the overflow so usage parsing still works.
    expect(capture.usageText()).toBe('f')
  })

  it('keeps the usage block when a long body is truncated', () => {
    const capture = new BoundedTextCapture(10)
    const body = '{"content":"' + 'x'.repeat(100) + '","usage":{"prompt_tokens":14,"completion_tokens":8,"total_tokens":22}}'
    capture.append(body)

    expect(capture.text()).toContain('[truncated')
    const usage = capture.usageText()
    expect(usage).not.toBeNull()
    expect(usage).toContain('"total_tokens":22')
  })

  it('bounds the tail to USAGE_TAIL_BYTES', () => {
    const capture = new BoundedTextCapture(10)
    capture.append('a'.repeat(USAGE_TAIL_BYTES + 5000))
    capture.append('{"usage":{"total_tokens":3}}')

    const usage = capture.usageText()
    expect(usage).not.toBeNull()
    expect(Buffer.byteLength(usage!, 'utf8')).toBeLessThanOrEqual(USAGE_TAIL_BYTES)
    expect(usage).toContain('"total_tokens":3')
  })
})
