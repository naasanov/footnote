'use client'

import { cn } from '@/lib/utils'

interface SourceToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function SourceToggle({ checked, onChange, disabled }: SourceToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5016] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-[#2D5016]' : 'bg-[#E8E2D9]',
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-3 w-3 rounded-full bg-white shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-3' : 'translate-x-0',
        )}
      />
    </button>
  )
}
