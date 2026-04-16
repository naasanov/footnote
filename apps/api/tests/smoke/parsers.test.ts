import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MarkdownParser } from "../../src/adapters/parsers/MarkdownParser.js";
import { ParserRegistry } from "../../src/adapters/parsers/ParserRegistry.js";
import { PdfParser } from "../../src/adapters/parsers/PdfParser.js";
import { splitIntoChunks } from "../../src/adapters/parsers/chunkText.js";

describe("Parser smoke tests", () => {
  it("PdfParser parses text from a minimal PDF fixture", async () => {
    const parser = new PdfParser();
    const fixturePath = resolve(process.cwd(), "tests/fixtures/minimal.pdf");
    const buffer = await readFile(fixturePath);

    const chunks = await parser.parse(buffer, "minimal.pdf");

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].locationLabel).toBe("Page 1");
    expect(
      chunks.some((c) => c.text.includes("Ticket 3 PDF parser smoke fixture")),
    ).toBe(true);
  });

  it("MarkdownParser splits chunks at headings", async () => {
    const parser = new MarkdownParser();
    const md = Buffer.from(
      "# Week 1\n\nEmbeddings and chunking notes.\n\n## Week 2\n\nVector search and retrieval.",
      "utf-8",
    );

    const chunks = await parser.parse(md, "notes.md");

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.locationLabel).toBe("Week 1");
    expect(chunks[1]?.locationLabel).toBe("Week 2");
    expect(chunks[0]?.text).toContain("Embeddings and chunking notes.");
    expect(chunks[1]?.text).toContain("Vector search and retrieval.");
  });

  it("MarkdownParser accepts plain text files", async () => {
    const parser = new MarkdownParser();
    const txt = Buffer.from(
      "Plain text notes without markdown headings.\n\nThis should still be chunked and indexed.",
      "utf-8",
    );

    const chunks = await parser.parse(txt, "notes.txt");

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.locationLabel).toBe("Paragraph 1");
    expect(chunks[0]?.text).toContain("Plain text notes without markdown headings.");
  });

  it("ParserRegistry returns a registered parser and rejects unknown mime types", () => {
    const registry = new ParserRegistry();
    const pdfParser = new PdfParser();
    const markdownParser = new MarkdownParser();

    registry.register(pdfParser);
    registry.register(markdownParser);

    expect(registry.getParser("application/pdf")).toBe(pdfParser);
    expect(registry.getParser("text/plain")).toBe(markdownParser);
    expect(() => registry.getParser("application/octet-stream")).toThrow(
      "No parser registered for mime type: application/octet-stream",
    );
  });

  it("splitIntoChunks prefers word-safe hard boundaries", () => {
    const repeatedSentence =
      "Photosynthesis allows plants to convert light energy into chemical energy for growth. ";
    const text = repeatedSentence.repeat(80);

    const chunks = splitIntoChunks(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => !chunk.startsWith("nergy"))).toBe(true);
    expect(chunks.every((chunk) => !chunk.endsWith("Photosyn"))).toBe(true);
  });
});
