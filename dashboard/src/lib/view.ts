import { useMemo } from 'react'
import { type Period, byMode, inPeriod, periodFor } from './crashes'
import { passesFilters } from './filters'
import { useStore } from './store'
import type { VillageCrash } from './types'

export interface VillageView {
	years: number[]
	year: number
	period: Period
	firstDate: string
	lastDate: string
	/** Village crashes in the focus period, after every filter. */
	crashes: VillageCrash[]
	/** All Village crashes after every filter (every year). */
	allModeFiltered: VillageCrash[]
	/** Every year, after the more-filters but not the mode filter — for the
	 * card that always splits by mode. */
	allModes: VillageCrash[]
	/** Focus period + mode, before the more-filters — dropdown counts. */
	unfiltered: VillageCrash[]
}

/** Derived view of the Village data shared by every component. */
export function useVillageView(): VillageView | null {
	const village = useStore((s) => s.village)
	const manifest = useStore((s) => s.manifest)
	const yearParam = useStore((s) => s.year)
	const mode = useStore((s) => s.mode)
	const filters = useStore((s) => s.filters)

	return useMemo(() => {
		if (!village || !manifest || village.length === 0) return null
		const firstDate =
			manifest.sources.village.firstDate ?? village[0]?.date ?? ''
		const lastDate =
			manifest.sources.village.lastDate ?? village.at(-1)?.date ?? ''
		const years = [...new Set(village.map((c) => c.year))].sort()
		const latest = years.at(-1) ?? Number(lastDate.slice(0, 4))
		// A URL year outside the data degrades to the latest year.
		const year =
			yearParam !== null && years.includes(yearParam) ? yearParam : latest
		const period = periodFor(year, lastDate)
		const allModes = village.filter((c) => passesFilters(c, filters))
		const allModeFiltered = byMode(allModes, mode)
		return {
			years,
			year,
			period,
			firstDate,
			lastDate,
			crashes: inPeriod(allModeFiltered, period),
			allModeFiltered,
			allModes,
			unfiltered: inPeriod(byMode(village, mode), period),
		}
	}, [village, manifest, yearParam, mode, filters])
}

/** "Jan 1 – Oct 31" style label for a period's span. */
export function periodSpan(p: Period, lastDate: string): string {
	if (!p.partial) return `all of ${p.year}`
	const m = Number(lastDate.slice(5, 7)) - 1
	const d = Number(lastDate.slice(8, 10))
	const MONTHS = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec',
	]
	return `Jan 1 – ${MONTHS[m]} ${d}`
}
