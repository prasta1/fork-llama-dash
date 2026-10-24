export const MAX_CAPTURED_RESPONSE_BYTES = 256 * 1024
// The `usage` object sits at the END of a JSON response body. When the full
// body exceeds the capture cap, keep the last TAIL_BYTES in a dedicated buffer
// so usage parsing still works on long responses instead of silently returning
// null. 64KB comfortably holds any usage block (OpenAI, Anthropic, llama.cpp
// timings) plus the closing JSON.
export const USAGE_TAIL_BYTES = 64 * 1024

export class BoundedTextCapture {
  private chunks: string[] = []
  private bytes = 0
  private truncatedBytes = 0
  // Rolling tail of the response, kept for usage parsing when the full body is
  // truncated. Only populated once the body exceeds maxBytes.
  private tail = ''

  constructor(private readonly maxBytes = MAX_CAPTURED_RESPONSE_BYTES) {}

  append(text: string) {
    if (!text) return
    const incomingBytes = Buffer.byteLength(text, 'utf8')
    const remaining = this.maxBytes - this.bytes
    if (remaining <= 0) {
      this.truncatedBytes += incomingBytes
      this.pushTail(text)
      return
    }
    if (incomingBytes <= remaining) {
      this.chunks.push(text)
      this.bytes += incomingBytes
      return
    }

    let cut = text.slice(0, remaining)
    while (Buffer.byteLength(cut, 'utf8') > remaining) {
      cut = cut.slice(0, -1)
    }
    this.chunks.push(cut)
    const capturedBytes = Buffer.byteLength(cut, 'utf8')
    this.bytes += capturedBytes
    this.truncatedBytes += incomingBytes - capturedBytes
    // The overflow of this chunk is the start of the tail.
    this.pushTail(text.slice(cut.length))
  }

  text(): string | null {
    if (this.chunks.length === 0 && this.truncatedBytes === 0) return null
    const body = this.chunks.join('')
    if (this.truncatedBytes === 0) return body
    return `${body}\n...[truncated ${this.truncatedBytes} bytes]`
  }

  usageText(): string | null {
    if (this.truncatedBytes === 0) return this.chunks.join('') || null
    return this.tail || null
  }

  private pushTail(text: string) {
    if (!text) return
    this.tail += text
    // Trim from the front until the tail fits the budget. Char-by-char is
    // simple and correct; the tail is bounded so this never runs hot.
    while (Buffer.byteLength(this.tail, 'utf8') > USAGE_TAIL_BYTES && this.tail.length > 0) {
      this.tail = this.tail.slice(1)
    }
  }
}
