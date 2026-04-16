import type { SourceParser } from './SourceParser.js'

export class ParserRegistry {
  private parsers: SourceParser[] = []

  register(parser: SourceParser): void {
    this.parsers.push(parser)
  }

  getParser(mimeType: string): SourceParser {
    const parser = this.parsers.find(p => p.supportedMimeTypes.includes(mimeType))
    if (!parser) {
      throw new Error(`No parser registered for mime type: ${mimeType}`)
    }
    return parser
  }
}
