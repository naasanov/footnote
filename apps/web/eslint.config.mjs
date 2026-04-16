import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'next-env.d.ts', 'node_modules/**'],
  },
  {
    files: [
      'src/components/features/NoteCanvas/CitationChipShape.tsx',
      'src/components/features/NoteCanvas/NoteCanvas.tsx',
      'src/hooks/useCanvas.ts',
      'src/hooks/useOcrDebounce.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]

export default config
