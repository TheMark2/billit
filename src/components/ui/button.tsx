/// <reference types="react" />
import * as React from 'react';
import { type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-neutral-700',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        outline: 'border border-neutral-200 bg-transparent hover:bg-neutral-100 hover:text-neutral-700',
        secondary: 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
        ghost: 'hover:bg-neutral-100 hover:text-neutral-700',
        link: 'text-primary underline-offset-4 hover:underline',
        loading: 'bg-neutral-100 text-neutral-500 cursor-wait',
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
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ 
          variant: isLoading ? 'loading' : variant, 
          size, 
          className 
        }))}
        ref={ref}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
            {children}
          </div>
        ) : children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants }; 