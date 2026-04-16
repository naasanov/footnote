import { PDFParse } from 'pdf-parse'
import type { SourceParser, ParsedChunk } from './SourceParser.js'
import { splitIntoChunks } from './chunkText.js'

export class PdfParser implements SourceParser {
  readonly supportedMimeTypes = ['application/pdf']

  async parse(buffer: Buffer, _filename: string): Promise<ParsedChunk[]> {
    const parser = new PDFParse({ data: buffer })
    const textResult = await parser.getText().finally(async () => {
      await parser.destroy()
    })

    const results: ParsedChunk[] = []

    for (const page of textResult.pages) {
      const pageText = page.text
      const pageNum = page.num
      const textChunks = splitIntoChunks(pageText)

      for (const chunkText of textChunks) {
        results.push({
          text: chunkText,
          locationLabel: `Page ${pageNum}`,
          chunkIndex: results.length,
        })
      }
    }

    return results
  }
}
