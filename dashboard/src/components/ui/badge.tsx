import { cn } from '@/lib/utils'
import { type VariantProps, cva } from 'class-variance-authority'
import type * as React from 'react'

const badgeVariants = cva(
	'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.7rem] font-medium leading-none transition-colors',
	{
		variants: {
			variant: {
				default: 'border-transparent bg-primary/10 text-primary',
				secondary: 'border-transparent bg-secondary text-secondary-foreground',
				outline: 'text-foreground',
				muted: 'border-transparent bg-muted text-muted-foreground',
			},
		},
		defaultVariants: { variant: 'default' },
	},
)

export function Badge({
	className,
	variant,
	...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
	return (
		<span className={cn(badgeVariants({ variant }), className)} {...props} />
	)
}
