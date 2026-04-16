export interface ParsedChunk {
  text: string
  locationLabel: string
  chunkIndex: number
}

export interface SourceParser {
  readonly supportedMimeTypes: string[]
  parse(buffer: Buffer, filename: string): Promise<ParsedChunk[]>
}
