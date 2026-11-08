import { Button } from '@/components/ui/button'

/** Segmented two-state control: active option gets the filled variant. */
export function ToggleGroup<T extends string>({
	options,
	value,
	onChange,
	ariaLabel,
}: {
	options: Array<{ value: T; label: string }>
	value: T
	onChange: (v: T) => void
	ariaLabel: string
}) {
	return (
		<fieldset className="inline-flex overflow-hidden rounded-md border border-border">
			<legend className="sr-only">{ariaLabel}</legend>
			{options.map((opt) => (
				<Button
					key={opt.value}
					type="button"
					size="sm"
					variant={value === opt.value ? 'default' : 'ghost'}
					aria-pressed={value === opt.value}
					onClick={() => onChange(opt.value)}
					className="rounded-none"
				>
					{opt.label}
				</Button>
			))}
		</fieldset>
	)
}
