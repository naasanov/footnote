import mammoth from "mammoth";
import type { ParsedChunk, SourceParser } from "./SourceParser.js";
import { splitIntoChunks } from "./chunkText.js";

export class DocxParser implements SourceParser {
  readonly supportedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ];

  async parse(buffer: Buffer, _filename: string): Promise<ParsedChunk[]> {
    const result = await mammoth.extractRawText({ buffer });
    const chunks = splitIntoChunks(result.value);

    return chunks.map((text, index) => ({
      text,
      locationLabel: `Section ${index + 1}`,
      chunkIndex: index,
    }));
  }
}
