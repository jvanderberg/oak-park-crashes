import { Legend } from '@/components/ChartCard'
import { FilterFields } from '@/components/Filters'
import { SIZE_KEY, describeFilters } from '@/lib/filters'
import { fmtInt } from '@/lib/format'
import { useStore } from '@/lib/store'
import {
	MEASURE_SHORT,
	MODE_FILTER_LABEL,
	MODE_LABEL,
	type Measure,
	type Mode,
	modesOf,
} from '@/lib/types'
import type { VillageView } from '@/lib/view'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { useId, useState } from 'react'

/** Swatches for the modes on the map + dot-size key, shared by the card
 * and the pop-out. */
export function MapLegend({
	swatches,
	measure,
}: {
	swatches: Record<Mode, string>
	measure: Measure
}) {
	const modes = modesOf(useStore((s) => s.mode))
	return (
		<div className="flex flex-wrap items-center gap-x-6 gap-y-1">
			<Legend
				items={modes.map((m) => ({
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

/** Read-only summary of every filter shaping the map, under its title
 * (they're changed in the bar at the top of the page). */
export function AppliedFilters({ view }: { view: VillageView }) {
	const mode = useStore((s) => s.mode)
	const measure = useStore((s) => s.measure)
	const f = useStore((s) => s.filters)
	const labels = [
		view.yearLabel,
		MODE_FILTER_LABEL[mode],
		MEASURE_SHORT[measure],
		...describeFilters(f).map((a) => a.label),
	]
	return (
		<div className="flex flex-wrap items-center gap-1.5 text-xs">
			<span className="font-medium text-muted-foreground">Filters:</span>
			{labels.map((label) => (
				<span key={label} className="rounded-full bg-muted px-2 py-0.5">
					{label}
				</span>
			))}
		</div>
	)
}

/** Floating panel on the full-screen map: what's shown, the more-filters
 * form, and the legend (year / who / count are in the bar across the top). */
export function MapFilterPod({
	count,
	countLabel,
	span,
	swatches,
	measure,
	defaultOpen,
}: {
	count: number
	countLabel: string
	span: string
	swatches: Record<Mode, string>
	measure: Measure
	defaultOpen: boolean
}) {
	const [open, setOpen] = useState(defaultOpen)
	const bodyId = useId()
	const active = describeFilters(useStore((s) => s.filters))

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
					More filters
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
					<FilterFields />
					<div className="border-t border-border pt-2.5">
						<MapLegend swatches={swatches} measure={measure} />
					</div>
				</div>
			)}
		</div>
	)
}
