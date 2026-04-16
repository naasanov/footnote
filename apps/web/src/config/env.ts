import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_TLDRAW_LICENSE_KEY: z.string().min(1),
  NEXT_PUBLIC_OCR_DEBOUNCE_MS: z.coerce.number().int().positive().default(3000),
  NEXT_PUBLIC_OCR_MAX_WAIT_MS: z.coerce.number().int().positive().default(5000),
  NEXT_PUBLIC_OCR_SNAPSHOT_PADDING_PX: z.coerce.number().int().min(0).default(12),
  NEXT_PUBLIC_RAG_BUFFER_MAX_ENTRIES: z.coerce.number().int().positive().default(5),
  NEXT_PUBLIC_RAG_BUFFER_MAX_TOKENS: z.coerce.number().int().positive().default(300),
  NEXT_PUBLIC_CANVAS_SAVE_DEBOUNCE_MS: z.coerce.number().int().positive().default(5000),
  NEXT_PUBLIC_OCR_SEARCH_MAX_ZOOM: z.coerce.number().positive().default(1),
  NEXT_PUBLIC_RAG_DEBUG_TIMING: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  NEXT_PUBLIC_OCR_DEBUG: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
})

const result = envSchema.safeParse({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_TLDRAW_LICENSE_KEY: process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY,
  NEXT_PUBLIC_OCR_DEBOUNCE_MS: process.env.NEXT_PUBLIC_OCR_DEBOUNCE_MS,
  NEXT_PUBLIC_OCR_MAX_WAIT_MS: process.env.NEXT_PUBLIC_OCR_MAX_WAIT_MS,
  NEXT_PUBLIC_OCR_SNAPSHOT_PADDING_PX: process.env.NEXT_PUBLIC_OCR_SNAPSHOT_PADDING_PX,
  NEXT_PUBLIC_RAG_BUFFER_MAX_ENTRIES: process.env.NEXT_PUBLIC_RAG_BUFFER_MAX_ENTRIES,
  NEXT_PUBLIC_RAG_BUFFER_MAX_TOKENS: process.env.NEXT_PUBLIC_RAG_BUFFER_MAX_TOKENS,
  NEXT_PUBLIC_CANVAS_SAVE_DEBOUNCE_MS: process.env.NEXT_PUBLIC_CANVAS_SAVE_DEBOUNCE_MS,
  NEXT_PUBLIC_OCR_SEARCH_MAX_ZOOM: process.env.NEXT_PUBLIC_OCR_SEARCH_MAX_ZOOM,
  NEXT_PUBLIC_RAG_DEBUG_TIMING: process.env.NEXT_PUBLIC_RAG_DEBUG_TIMING,
  NEXT_PUBLIC_OCR_DEBUG: process.env.NEXT_PUBLIC_OCR_DEBUG,
})

if (!result.success) {
  const missing = result.error.issues.map((i) => i.path.join('.')).join(', ')
  throw new Error(`Missing or invalid environment variables: ${missing}`)
}

export const env = result.data
