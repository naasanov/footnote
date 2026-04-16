import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[#2D5016] text-[#FAFAF8] hover:bg-[#2D5016]/90 focus-visible:ring-[#2D5016]',
        destructive:
          'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
        outline:
          'border border-[#E8E2D9] bg-transparent hover:bg-[#E8E2D9]/30 text-[#1C1917] focus-visible:ring-[#2D5016]',
        secondary:
          'bg-[#E8E2D9]/50 text-[#1C1917] hover:bg-[#E8E2D9] focus-visible:ring-[#2D5016]',
        ghost:
          'hover:bg-[#E8E2D9]/30 text-[#1C1917] focus-visible:ring-[#2D5016]',
        link: 'text-[#2D5016] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
