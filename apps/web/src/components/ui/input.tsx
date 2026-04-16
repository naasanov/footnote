import * as React from 'react'
import { cn } from '@/lib/utils'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-[#E8E2D9] bg-[#FFFDF8] px-3 py-1 text-sm text-[#1C1917] shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#C8BFB0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5016] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
