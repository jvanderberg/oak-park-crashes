import { ToggleGroup } from '@/components/ToggleGroup'
import { useStore } from '@/lib/store'
import {
	MEASURE_LABEL,
	MEASURE_SHORT,
	MODE_LABEL,
	type Measure,
	type ModeFilter,
} from '@/lib/types'
import { useVillageView } from '@/lib/view'
import type { ReactNode } from 'react'

/** The one row of filters that drives every chart, table and the map.
 * The `map` variant is the same bar laid out atop the full-screen map. */
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

	if (!view) return <div className="h-9" />
	const latest = view.years.at(-1)

	return (
		<div
			className={
				variant === 'page'
					? 'thin-scroll sticky top-0 z-40 -mx-4 flex items-center gap-x-4 gap-y-2 overflow-x-auto border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:flex-wrap'
					: 'flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-background px-3 py-2'
			}
		>
			{leading}
			<Labeled label="Year">
				<ToggleGroup
					ariaLabel="Year"
					value={String(view.year)}
					onChange={(v) => setYear(Number(v) === latest ? null : Number(v))}
					options={view.years.map((y) => ({
						value: String(y),
						label:
							y === latest && view.period.partial ? `${y} to date` : String(y),
					}))}
				/>
			</Labeled>
			<Labeled label="Who">
				<ToggleGroup<ModeFilter>
					ariaLabel="Crash mode"
					value={mode}
					onChange={setMode}
					options={[
						{ value: 'all', label: 'Everyone' },
						{ value: 'veh', label: MODE_LABEL.veh },
						{ value: 'ped', label: MODE_LABEL.ped },
						{ value: 'bike', label: MODE_LABEL.bike },
					]}
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
		</div>
	)
}

function Labeled({
	label,
	children,
}: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex shrink-0 items-center gap-1.5">
			<span className="text-xs font-medium text-muted-foreground">{label}</span>
			{children}
		</div>
	)
}
