import type { OcrService } from "../ocr/OcrService.js";
import type { ParsedChunk, SourceParser } from "./SourceParser.js";

export class ImageParser implements SourceParser {
  constructor(private readonly ocrService: OcrService) {}

  readonly supportedMimeTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
  ];

  async parse(buffer: Buffer, filename: string): Promise<ParsedChunk[]> {
    const mimeType = this.inferMimeType(filename);
    const text = await this.ocrService.transcribe(
      buffer.toString("base64"),
      mimeType,
    );
    const trimmed = text.trim();

    if (!trimmed) return [];

    return [
      {
        text: trimmed,
        locationLabel: "Image 1",
        chunkIndex: 0,
      },
    ];
  }

  private inferMimeType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".gif")) return "image/gif";
    return "image/jpeg";
  }
}
