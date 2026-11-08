import { Legend } from '@/components/ChartCard'
import { ToggleGroup } from '@/components/ToggleGroup'
import { Button } from '@/components/ui/button'
import { fmtInt } from '@/lib/format'
import {
	DAY_KINDS,
	DAY_LABEL,
	type DayKind,
	SIZE_KEY,
	TIMES,
	TIME_LABEL,
	type TimeOfDay,
	describeMapFilters,
} from '@/lib/mapFilters'
import { useStore } from '@/lib/store'
import {
	MEASURE_SHORT,
	MODES,
	MODE_LABEL,
	type Measure,
	type Mode,
} from '@/lib/types'
import type { VillageView } from '@/lib/view'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'

/** Mode swatches + dot-size key, shared by the card and the pop-out. */
export function MapLegend({
	swatches,
	measure,
}: {
	swatches: Record<Mode, string>
	measure: Measure
}) {
	return (
		<div className="flex flex-wrap items-center gap-x-6 gap-y-1">
			<Legend
				items={MODES.map((m) => ({
					key: m,
					label: MODE_LABEL[m],
					swatch: swatches[m],
				}))}
			/>
			<span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
				Size:
				{SIZE_KEY[measure].map(([r, label]) => (
					<span key={label} className="flex items-center gap-1">
						<span
							className="inline-block rounded-full bg-muted-foreground"
							style={{ width: r * 2, height: r * 2 }}
							aria-hidden
						/>
						{label}
					</span>
				))}
			</span>
		</div>
	)
}

/** Every filter shaping the map, inline under its title: the page's
 * year / who / count (changed in the bar at the top) and any map-only
 * filters, each removable. */
export function AppliedFilters({ view }: { view: VillageView }) {
	const mode = useStore((s) => s.mode)
	const measure = useStore((s) => s.measure)
	const f = useStore((s) => s.mapFilters)
	const clear = useStore((s) => s.clearMapFilter)
	const reset = useStore((s) => s.resetMapFilters)
	const latest = view.years.at(-1)
	const page = [
		view.year === latest && view.period.partial
			? `${view.year} to date`
			: String(view.year),
		mode === 'all' ? 'Everyone' : MODE_LABEL[mode],
		MEASURE_SHORT[measure],
	]
	const active = describeMapFilters(f)
	return (
		<div className="flex flex-wrap items-center gap-1.5 text-xs">
			<span className="font-medium text-muted-foreground">Filters:</span>
			{page.map((label) => (
				<span key={label} className="rounded-full bg-muted px-2 py-0.5">
					{label}
				</span>
			))}
			{active.map((a) => (
				<span
					key={a.key}
					className="inline-flex items-center gap-0.5 rounded-full border border-primary/40 bg-primary/10 py-0.5 pl-2 pr-1"
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
				</span>
			))}
			{active.length > 1 && (
				<button
					type="button"
					className="ml-1 font-medium text-primary underline underline-offset-2"
					onClick={reset}
				>
					Clear map filters
				</button>
			)}
		</div>
	)
}

/** Floating panel of map-only filters for the full-screen map (the page's
 * year / who / count live in the bar across the top). */
export function MapFilterPod({
	count,
	countLabel,
	span,
	streets,
	causes,
	swatches,
	measure,
	defaultOpen,
}: {
	count: number
	countLabel: string
	span: string
	streets: Array<[string, number]>
	causes: Array<[string, number]>
	swatches: Record<Mode, string>
	measure: Measure
	defaultOpen: boolean
}) {
	const [open, setOpen] = useState(defaultOpen)
	const bodyId = useId()
	const f = useStore((s) => s.mapFilters)
	const setF = useStore((s) => s.setMapFilters)
	const reset = useStore((s) => s.resetMapFilters)
	const active = describeMapFilters(f)

	return (
		<div className="absolute inset-x-2 bottom-7 z-10 flex max-h-[70%] flex-col overflow-hidden rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:inset-x-auto sm:bottom-auto sm:left-3 sm:top-3 sm:max-h-[calc(100%-1.5rem)] sm:w-[22rem]">
			<button
				type="button"
				className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
				aria-expanded={open}
				aria-controls={bodyId}
				onClick={() => setOpen((o) => !o)}
			>
				<span className="min-w-0">
					<span className="block text-sm font-semibold tabular-nums">
						Showing {fmtInt(count)} {countLabel}
					</span>
					<span className="block truncate text-xs text-muted-foreground">
						{span}
						{active.map((a) => ` · ${a.label}`).join('')}
					</span>
				</span>
				<span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
					<SlidersHorizontal className="size-3.5" aria-hidden />
					Filters
					<ChevronDown
						className={`size-3.5 motion-safe:transition-transform ${open ? 'rotate-180' : ''}`}
						aria-hidden
					/>
				</span>
			</button>
			{open && (
				<div
					id={bodyId}
					className="thin-scroll space-y-3 overflow-y-auto border-t border-border px-3 pb-3 pt-2.5"
				>
					<Field label="Days">
						<ToggleGroup<DayKind>
							ariaLabel="Days of the week"
							value={f.days}
							onChange={(days) => setF({ days })}
							options={DAY_KINDS.map((d) => ({
								value: d,
								label: DAY_LABEL[d],
							}))}
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
						label="Cause"
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
							Clear map filters
						</Button>
					)}
					<div className="border-t border-border pt-2.5">
						<MapLegend swatches={swatches} measure={measure} />
					</div>
				</div>
			)}
		</div>
	)
}

/** Dropdown options "Name (count)", keeping a selected value that has no
 * crashes under the current filters so the select never silently resets. */
function withSelected(
	head: Array<{ value: string; label: string }>,
	tally: Array<[string, number]>,
	selected: string | null,
): Array<{ value: string; label: string }> {
	const opts = tally.map(([v, n]) => ({ value: v, label: `${v} (${n})` }))
	if (selected && !tally.some(([v]) => v === selected)) {
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
