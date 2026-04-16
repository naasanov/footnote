import 'dotenv/config'
import { z } from 'zod'

const frontendUrlSchema = z
  .string()
  .min(1)
  .transform((value, ctx) => {
    const urls = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    if (urls.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one frontend URL is required',
      })
      return z.NEVER
    }

    const invalidUrls = urls.filter((url) => !z.string().url().safeParse(url).success)
    if (invalidUrls.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid frontend URL(s): ${invalidUrls.join(', ')}`,
      })
      return z.NEVER
    }

    return urls
  })

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1).default('footnote'),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  FRONTEND_URL: frontendUrlSchema,
  OPENAI_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  CITATION_MODEL: z.string().min(1).default('claude-sonnet-4-6'),
  RAG_MIN_MATCH_SCORE: z.coerce.number().min(0).max(1).default(0.6),
  OCR_MAX_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(3),
  OCR_INITIAL_BACKOFF_MS: z.coerce.number().int().positive().default(750),
  CITATION_MAX_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(3),
  CITATION_INITIAL_BACKOFF_MS: z.coerce.number().int().positive().default(750),
  RAG_DEBUG_TIMING: z
    .preprocess((value) => value ?? 'false', z.enum(['true', 'false']))
    .transform((value) => value === 'true'),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  const missing = result.error.issues.map(i => i.path.join('.')).join(', ')
  throw new Error(`Missing or invalid environment variables: ${missing}`)
}

export const env = result.data
export type Env = typeof env
