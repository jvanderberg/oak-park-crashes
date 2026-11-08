import { useMemo } from 'react'
import { type Period, byMode, inPeriod, periodFor } from './crashes'
import { passesFilters } from './filters'
import { fmtDate, fmtMonth } from './format'
import { useStore } from './store'
import type { VillageCrash } from './types'

export interface VillageView {
	years: number[]
	/** Selected year; null = all years. */
	year: number | null
	/** The selected year, or the latest year when all years are selected —
	 * for charts that always highlight one year. */
	focusYear: number
	period: Period
	/** Period of `focusYear` (cut at the last data date when in progress). */
	focusPeriod: Period
	/** "2026 to date" / "2025" / "All years". */
	yearLabel: string
	/** "Jan 1 – Oct 31, 2026" / "all of 2025" / "Jan 2024 – Oct 31, 2026". */
	span: string
	firstDate: string
	lastDate: string
	/** Village crashes in the selected period, after every filter. */
	crashes: VillageCrash[]
	/** All Village crashes after every filter (every year). */
	allModeFiltered: VillageCrash[]
	/** Every year, after the more-filters but not the mode filter — for the
	 * card that always splits by mode. */
	allModes: VillageCrash[]
	/** Selected period + mode, before the more-filters — dropdown counts. */
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
			yearParam === 'all'
				? null
				: yearParam !== null && years.includes(yearParam)
					? yearParam
					: latest
		const period = periodFor(year, lastDate)
		const focusYear = year ?? latest
		const focusPeriod = periodFor(focusYear, lastDate)
		const allModes = village.filter((c) => passesFilters(c, filters))
		const allModeFiltered = byMode(allModes, mode)
		return {
			years,
			year,
			focusYear,
			period,
			focusPeriod,
			yearLabel:
				year === null
					? 'All years'
					: period.partial
						? `${year} to date`
						: String(year),
			span:
				year === null
					? `${fmtMonth(firstDate.slice(0, 7))} – ${fmtDate(lastDate)}`
					: period.partial
						? `Jan 1 – ${fmtDate(lastDate)}`
						: `all of ${year}`,
			firstDate,
			lastDate,
			crashes: inPeriod(allModeFiltered, period),
			allModeFiltered,
			allModes,
			unfiltered: inPeriod(byMode(village, mode), period),
		}
	}, [village, manifest, yearParam, mode, filters])
}
