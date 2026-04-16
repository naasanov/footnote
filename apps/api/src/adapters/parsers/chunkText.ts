// Estimate: 1 token ≈ 4 chars
const TARGET_CHARS = 2000  // ~500 tokens
const OVERLAP_CHARS = 400  // ~100 tokens

function clampToWordStart(text: string, index: number): number {
  if (index <= 0) return 0
  if (index >= text.length) return text.length

  let cursor = index
  while (cursor < text.length && /\S/.test(text[cursor] ?? '')) {
    cursor += 1
  }

  while (cursor < text.length && /\s/.test(text[cursor] ?? '')) {
    cursor += 1
  }

  return cursor
}

function clampToWordEnd(text: string, index: number, minIndex: number): number {
  if (index >= text.length) return text.length

  let cursor = index
  while (cursor > minIndex && /\S/.test(text[cursor - 1] ?? '')) {
    cursor -= 1
  }

  if (cursor <= minIndex) {
    return index
  }

  return cursor
}

/**
 * Splits text into chunks of ~500 tokens with 100-token overlap.
 * Prefers paragraph boundaries, falls back to sentence boundaries,
 * then hard-splits at the character limit.
 */
export function splitIntoChunks(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.length <= TARGET_CHARS) return [trimmed]

  const chunks: string[] = []
  let start = 0

  while (start < trimmed.length) {
    const end = Math.min(start + TARGET_CHARS, trimmed.length)

    if (end === trimmed.length) {
      const chunk = trimmed.slice(start).trim()
      if (chunk) chunks.push(chunk)
      break
    }

    // Prefer paragraph boundary (double newline)
    const paragraphBreak = trimmed.lastIndexOf('\n\n', end)
    if (paragraphBreak > start + TARGET_CHARS * 0.5) {
      const chunk = trimmed.slice(start, paragraphBreak).trim()
      if (chunk) chunks.push(chunk)
      start = clampToWordStart(trimmed, paragraphBreak + 2 - OVERLAP_CHARS)
      if (start < 0) start = 0
      continue
    }

    // Fall back to sentence boundary
    const punctuationMatches = [...trimmed.slice(start, end).matchAll(/[.!?](?:\s|$)/g)]
    const sentenceBreak =
      punctuationMatches.length > 0
        ? start + punctuationMatches[punctuationMatches.length - 1].index!
        : -1
    if (sentenceBreak > start + TARGET_CHARS * 0.5) {
      const chunk = trimmed.slice(start, sentenceBreak + 1).trim()
      if (chunk) chunks.push(chunk)
      start = clampToWordStart(trimmed, sentenceBreak + 1 - OVERLAP_CHARS)
      if (start < 0) start = 0
      continue
    }

    // Hard split at target length
    const safeEnd = clampToWordEnd(trimmed, end, start + Math.floor(TARGET_CHARS * 0.6))
    const chunk = trimmed.slice(start, safeEnd).trim()
    if (chunk) chunks.push(chunk)
    start = clampToWordStart(trimmed, safeEnd - OVERLAP_CHARS)
    if (start <= 0) start = end
  }

  return chunks
}
