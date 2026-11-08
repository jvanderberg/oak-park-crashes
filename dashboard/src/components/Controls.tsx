import { FilterChips, MoreFilters } from '@/components/Filters'
import { ToggleGroup } from '@/components/ToggleGroup'
import { useStore } from '@/lib/store'
import {
	MEASURE_LABEL,
	MEASURE_SHORT,
	MODE_FILTERS,
	MODE_FILTER_LABEL,
	MODE_FILTER_SHORT,
	type Measure,
	type ModeFilter,
} from '@/lib/types'
import { useNarrow } from '@/lib/useNarrow'
import { useVillageView } from '@/lib/view'
import type { ReactNode } from 'react'

/** The one row of filters that drives every chart, table and the map.
 * The `map` variant is the same bar laid out atop the full-screen map,
 * whose side panel carries the more-filters form instead of a popover. */
export function Controls({
	variant = 'page',
	leading,
}: { variant?: 'page' | 'map'; leading?: ReactNode }) {
	const view = useVillageView()
	const setYear = useStore((s) => s.setYear)
	const mode = useStore((s) => s.mode)
	const setMode = useStore((s) => s.setMode)
	const measure = useStore((s) => s.measure)
	const setMeasure = useStore((s) => s.setMeasure)
	// Both bars wrap rather than scroll sideways. On phones the labels hide
	// (each switch's legend still names it for screen readers), the five
	// Who options take short labels so they fit one row, and More filters
	// rides on the Year row.
	const narrow = useNarrow()
	const more = variant === 'page' ? <MoreFilters /> : null

	if (!view) return <div className="h-9" />
	const latest = view.years.at(-1)
	const latestPartial = !view.lastDate.endsWith('-12-31')

	return (
		<div
			className={
				variant === 'page'
					? 'sticky top-0 z-40 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80'
					: 'flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-background px-3 py-2'
			}
		>
			{leading}
			<Labeled label="Year">
				<ToggleGroup
					ariaLabel="Year"
					value={view.year === null ? 'all' : String(view.year)}
					onChange={(v) =>
						setYear(
							v === 'all' ? 'all' : Number(v) === latest ? null : Number(v),
						)
					}
					options={[
						...view.years.map((y) => ({
							value: String(y),
							label: y === latest && latestPartial ? `${y} to date` : String(y),
						})),
						{ value: 'all', label: narrow ? 'All' : 'All years' },
					]}
				/>
			</Labeled>
			{narrow && more}
			<Labeled label="Who">
				<ToggleGroup<ModeFilter>
					ariaLabel="Crash mode"
					value={mode}
					onChange={setMode}
					options={MODE_FILTERS.map((m) => ({
						value: m,
						label: narrow ? MODE_FILTER_SHORT[m] : MODE_FILTER_LABEL[m],
					}))}
				/>
			</Labeled>
			<Labeled label="Count">
				<ToggleGroup<Measure>
					ariaLabel="What to count"
					value={measure}
					onChange={setMeasure}
					options={(Object.keys(MEASURE_LABEL) as Measure[]).map((m) => ({
						value: m,
						label: MEASURE_SHORT[m],
					}))}
				/>
			</Labeled>
			{!narrow && more}
			{variant === 'page' && <FilterChips />}
		</div>
	)
}

/** The visible label hides on phones; the switch's legend still names it
 * for screen readers. */
function Labeled({
	label,
	children,
}: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex shrink-0 items-center gap-1.5">
			<span className="text-xs font-medium text-muted-foreground max-sm:sr-only">
				{label}
			</span>
			{children}
		</div>
	)
}
