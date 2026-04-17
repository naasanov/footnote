import type { ParsedChunk, SourceParser } from "./SourceParser.js";
import { splitIntoChunks } from "./chunkText.js";

interface Section {
  heading: string;
  text: string;
}

export class MarkdownParser implements SourceParser {
  readonly supportedMimeTypes = [
    "text/markdown",
    "text/x-markdown",
    "text/plain",
  ];

  async parse(buffer: Buffer, _filename: string): Promise<ParsedChunk[]> {
    const text = buffer.toString("utf-8");
    const sections = this.splitByHeadings(text);
    const results: ParsedChunk[] = [];

    for (const section of sections) {
      const textChunks = await splitIntoChunks(section.text);
      for (const chunkText of textChunks) {
        results.push({
          text: chunkText,
          locationLabel: section.heading || `Paragraph ${results.length + 1}`,
          chunkIndex: results.length,
        });
      }
    }

    return results;
  }

  private splitByHeadings(text: string): Section[] {
    const lines = text.split("\n");
    const sections: Section[] = [];
    let currentHeading = "";
    let currentLines: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
      if (headingMatch) {
        if (currentLines.some((l) => l.trim())) {
          sections.push({
            heading: currentHeading,
            text: currentLines.join("\n"),
          });
        }
        currentHeading = headingMatch[1].trim();
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.some((l) => l.trim())) {
      sections.push({ heading: currentHeading, text: currentLines.join("\n") });
    }

    return sections;
  }
}
