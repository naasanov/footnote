import { AppShell } from '@/components/AppShell'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Desktop-only guard */}
      <div className="flex md:hidden h-screen items-center justify-center bg-[#FAFAF8] p-8">
        <div className="text-center">
          <p className="font-display text-lg font-semibold text-[#1C1917] mb-2">Desktop required</p>
          <p className="text-sm text-[#C8BFB0]">
            Footnote requires a desktop browser for the best experience.
          </p>
        </div>
      </div>

      {/* Three-panel shell */}
      <div className="hidden md:block h-screen">
        <AppShell>{children}</AppShell>
      </div>
    </>
  )
}
