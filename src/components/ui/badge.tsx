import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[hsl(var(--accent))] text-black',
        secondary: 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]',
        destructive: 'bg-[hsl(var(--destructive))] text-white',
        outline: 'border border-[hsl(var(--border))] text-[hsl(var(--foreground))]',
        amber: 'bg-amber-500 text-black',
        muted: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
