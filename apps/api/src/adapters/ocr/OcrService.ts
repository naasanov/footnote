export interface OcrService {
  transcribe(imageBase64: string, mimeType: string): Promise<string>;
}
