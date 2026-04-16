import type { Metadata } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'sonner'
import { Providers } from '@/components/providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['opsz'],
})

export const metadata: Metadata = {
  title: 'Footnote',
  description: 'Handwriting-first note-taking with AI-powered citations',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
        <body className="font-sans antialiased">
          <Providers>
            {children}
            <Toaster richColors position="bottom-right" />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
