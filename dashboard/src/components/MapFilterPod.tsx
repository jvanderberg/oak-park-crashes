import { Legend } from '@/components/ChartCard'
import { ToggleGroup } from '@/components/ToggleGroup'
import { Button } from '@/components/ui/button'
import { fmtInt } from '@/lib/format'
import {
	DAY_KINDS,
	DAY_LABEL,
	type DayKind,
	type MapShow,
	SIZE_KEY,
	TIMES,
	TIME_LABEL,
	type TimeOfDay,
	describeMapFilters,
} from '@/lib/mapFilters'
import { useStore } from '@/lib/store'
import { MODES, MODE_LABEL, type Mode } from '@/lib/types'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'

/** Mode swatches + dot-size key, shared by the card and the pop-out. */
export function MapLegend({
	swatches,
	show,
}: {
	swatches: Record<Mode, string>
	show: MapShow
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
				{SIZE_KEY[show].map(([r, label]) => (
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

/** Floating panel of map-only filters for the full-screen map (year, who
 * and show live in the bar across the top). */
export function MapFilterPod({
	count,
	countLabel,
	span,
	streets,
	causes,
	swatches,
	defaultOpen,
}: {
	count: number
	countLabel: string
	span: string
	streets: Array<[string, number]>
	causes: Array<[string, number]>
	swatches: Record<Mode, string>
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
						{active.length > 0 ? ` · ${active.join(' · ')}` : ''}
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
						<MapLegend swatches={swatches} show={f.show} />
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
