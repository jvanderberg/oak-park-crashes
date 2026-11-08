import { ToggleGroup } from '@/components/ToggleGroup'
import { Button } from '@/components/ui/button'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover'
import { weight } from '@/lib/crashes'
import {
	DAY_KINDS,
	DAY_LABEL,
	type DayKind,
	TIMES,
	TIME_LABEL,
	type TimeOfDay,
	describeFilters,
	passesFilters,
	tally,
} from '@/lib/filters'
import { useStore } from '@/lib/store'
import { useVillageView } from '@/lib/view'
import { SlidersHorizontal, X } from 'lucide-react'
import { type ReactNode, useId, useMemo } from 'react'

/** Dropdown options with counts that honor every other filter, so
 * "Madison St (41)" means picking it leaves 41 crashes. */
function useFilterOptions() {
	const view = useVillageView()
	const measure = useStore((s) => s.measure)
	const f = useStore((s) => s.filters)
	return useMemo(() => {
		const base = (view?.unfiltered ?? []).filter((c) => weight(c, measure) > 0)
		return {
			streets: tally(
				base
					.filter((c) => passesFilters(c, f, 'street'))
					.flatMap((c) => (c.cross ? [c.street, c.cross] : [c.street])),
			),
			causes: tally(
				base.filter((c) => passesFilters(c, f, 'cause')).map((c) => c.cause1),
			),
		}
	}, [view, measure, f])
}

/** The more-filters form — in the top bar's popover, and in the panel on
 * the full-screen map. */
export function FilterFields() {
	const f = useStore((s) => s.filters)
	const setF = useStore((s) => s.setFilters)
	const reset = useStore((s) => s.resetFilters)
	const { streets, causes } = useFilterOptions()
	const active = describeFilters(f)
	return (
		<div className="space-y-3">
			<Field label="Days">
				<ToggleGroup<DayKind>
					ariaLabel="Days of the week"
					value={f.days}
					onChange={(days) => setF({ days })}
					options={DAY_KINDS.map((d) => ({ value: d, label: DAY_LABEL[d] }))}
				/>
			</Field>
			<SelectField
				label="Time of day"
				value={f.time}
				onChange={(v) => setF({ time: v as TimeOfDay })}
				options={TIMES.map((t) => ({ value: t, label: TIME_LABEL[t] }))}
			/>
			<SelectField
				label="Street"
				value={f.street ?? ''}
				onChange={(v) => setF({ street: v || null })}
				options={withSelected(
					[{ value: '', label: 'Any street' }],
					streets,
					f.street,
				)}
			/>
			<SelectField
				label="Primary cause"
				value={f.cause ?? ''}
				onChange={(v) => setF({ cause: v || null })}
				options={withSelected(
					[{ value: '', label: 'Any cause' }],
					causes,
					f.cause,
				)}
			/>
			<label className="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					className="size-3.5 accent-[var(--color-primary)]"
					checked={f.hitRun}
					onChange={(e) => setF({ hitRun: e.target.checked })}
				/>
				Hit and run only
			</label>
			{active.length > 0 && (
				<Button variant="outline" size="sm" onClick={reset}>
					Clear these filters
				</Button>
			)}
		</div>
	)
}

/** Top-bar button that opens the more-filters form. */
export function MoreFilters() {
	const n = describeFilters(useStore((s) => s.filters)).length
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant={n > 0 ? 'secondary' : 'outline'}
					size="sm"
					className="shrink-0"
				>
					<SlidersHorizontal aria-hidden />
					More filters
					{n > 0 && (
						<span className="rounded-full bg-primary px-1.5 text-[0.65rem] leading-4 text-primary-foreground">
							{n}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80">
				<FilterFields />
			</PopoverContent>
		</Popover>
	)
}

/** Active more-filters as removable chips (the More filters button beside
 * them adds them back). */
export function FilterChips() {
	const f = useStore((s) => s.filters)
	const clear = useStore((s) => s.clearFilter)
	const active = describeFilters(f)
	if (active.length === 0) return null
	return (
		<ul
			className="flex shrink-0 items-center gap-1.5 text-xs"
			aria-label="Active filters"
		>
			{active.map((a) => (
				<li
					key={a.key}
					className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full border border-primary/40 bg-primary/10 py-0.5 pl-2 pr-1"
				>
					{a.label}
					<button
						type="button"
						className="rounded-full p-0.5 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label={`Remove filter: ${a.label}`}
						onClick={() => clear(a.key)}
					>
						<X className="size-3" aria-hidden />
					</button>
				</li>
			))}
		</ul>
	)
}

/** Dropdown options "Name (count)", keeping a selected value that has no
 * crashes under the current filters so the select never silently resets. */
function withSelected(
	head: Array<{ value: string; label: string }>,
	counts: Array<[string, number]>,
	selected: string | null,
): Array<{ value: string; label: string }> {
	const opts = counts.map(([v, n]) => ({ value: v, label: `${v} (${n})` }))
	if (selected && !counts.some(([v]) => v === selected)) {
		opts.unshift({ value: selected, label: `${selected} (0)` })
	}
	return [...head, ...opts]
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="space-y-1">
			<div className="text-xs font-medium text-muted-foreground">{label}</div>
			{children}
		</div>
	)
}

function SelectField({
	label,
	value,
	onChange,
	options,
}: {
	label: string
	value: string
	onChange: (v: string) => void
	options: Array<{ value: string; label: string }>
}) {
	const id = useId()
	return (
		<div className="space-y-1">
			<label
				htmlFor={id}
				className="block text-xs font-medium text-muted-foreground"
			>
				{label}
			</label>
			<select
				id={id}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
		</div>
	)
}
