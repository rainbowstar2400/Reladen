import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-background',
  {
    variants: {
      variant: {
        default:
          'border border-white/70 bg-gradient-to-b from-white/42 via-white/30 to-white/22 text-white/95 shadow-[inset_0_0_18px_rgba(255,255,255,0.22),0_10px_18px_rgba(6,18,32,0.18)] backdrop-blur-md hover:from-white/48 hover:via-white/34 hover:to-white/24',
        secondary:
          'border border-white/65 bg-gradient-to-b from-white/36 via-white/26 to-white/18 text-white/90 shadow-[inset_0_0_16px_rgba(255,255,255,0.2),0_6px_12px_rgba(6,18,32,0.14)] backdrop-blur-md hover:from-white/42 hover:via-white/30 hover:to-white/20',
        ghost: 'text-white/75 hover:bg-white/16 hover:text-white/90',
        outline:
          'border border-white/55 bg-white/14 text-white/90 hover:bg-white/18',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
