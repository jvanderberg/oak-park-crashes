// Pure aggregation functions behind every number on the page. Kept free of
// React and the DOM so the math that drives the headline figures is unit-
// tested directly.

import type { Crash, Measure, Mode, ModeFilter, VillageCrash } from './types'
import { MODES, modesOf } from './types'

export const isInjury = (c: Crash) =>
	c.sev === 'K' || c.sev === 'A' || c.sev === 'B' || c.sev === 'C'
export const isKsi = (c: Crash) => c.sev === 'K' || c.sev === 'A'
export const peopleHurt = (c: Crash) => c.k + c.a + c.b + c.c

/** A crash's contribution to a measure (0 = not counted). */
export function weight(c: Crash, measure: Measure): number {
	switch (measure) {
		case 'crashes':
			return 1
		case 'injury':
			return isInjury(c) ? 1 : 0
		case 'ksi':
			return isKsi(c) ? 1 : 0
		case 'people':
			return peopleHurt(c)
	}
}

export function total(crashes: Crash[], measure: Measure): number {
	let s = 0
	for (const c of crashes) s += weight(c, measure)
	return s
}

export function byMode<T extends Crash>(crashes: T[], mode: ModeFilter): T[] {
	if (mode === 'all') return crashes
	const modes = modesOf(mode)
	return crashes.filter((c) => modes.includes(c.mode))
}

// ---- Periods ---------------------------------------------------------------

export interface Period {
	year: number
	/** Inclusive day-of-year cutoff; 366 = whole year. */
	throughDoy: number
	/** True when the period stops short of Dec 31 (year still in progress). */
	partial: boolean
}

/**
 * The period a year selection means. The latest year in the data is only
 * complete through `lastDate`, so it — and the comparison year — are cut at
 * the same day of the year. Earlier years are whole.
 */
export function periodFor(year: number, lastDate: string): Period {
	const lastYear = Number(lastDate.slice(0, 4))
	if (year < lastYear) return { year, throughDoy: 366, partial: false }
	const m = Number(lastDate.slice(5, 7)) - 1
	const d = Number(lastDate.slice(8, 10))
	// Compare by calendar date (month/day), so Feb 29 doesn't shift a year.
	const doy = calendarDoy(m, d)
	return { year, throughDoy: doy, partial: !(m === 11 && d === 31) }
}

/** Non-leap day-of-year for a month/day — comparable across years. */
export function calendarDoy(month: number, day: number): number {
	const starts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
	return (starts[month] ?? 0) + day
}

/** Non-leap day-of-year of a crash, comparable across years. */
export function crashCalendarDoy(c: Crash): number {
	return calendarDoy(c.month, Number(c.date.slice(8, 10)))
}

export function inPeriod<T extends Crash>(crashes: T[], p: Period): T[] {
	return crashes.filter(
		(c) => c.year === p.year && crashCalendarDoy(c) <= p.throughDoy,
	)
}

export interface Comparison {
	current: number
	previous: number | null
	/** Fractional change (0.15 = +15%); null when there is no prior period. */
	change: number | null
}

/** A measure for a period vs. the same span of the prior year. */
export function compare(
	crashes: Crash[],
	p: Period,
	measure: Measure,
	firstYear: number,
): Comparison {
	const current = total(inPeriod(crashes, p), measure)
	if (p.year - 1 < firstYear) return { current, previous: null, change: null }
	const previous = total(inPeriod(crashes, { ...p, year: p.year - 1 }), measure)
	return {
		current,
		previous,
		change: previous > 0 ? current / previous - 1 : null,
	}
}

// ---- Shares by mode ---------------------------------------------------------

export interface ModeShare {
	mode: Mode
	crashes: number
	value: number
	share: number
	/** Share of this mode's crashes that injured someone. */
	injuryRate: number
}

export function modeShares(crashes: Crash[], measure: Measure): ModeShare[] {
	const totalValue = total(crashes, measure)
	return MODES.map((mode) => {
		const subset = crashes.filter((c) => c.mode === mode)
		const value = total(subset, measure)
		return {
			mode,
			crashes: subset.length,
			value,
			share: totalValue > 0 ? value / totalValue : 0,
			injuryRate: subset.length ? total(subset, 'injury') / subset.length : 0,
		}
	})
}

// ---- Series -----------------------------------------------------------------

export interface MonthlySeries {
	/** "2024-01" … in order, every month from first to last (no gaps). */
	months: string[]
	values: Record<Mode, number[]>
}

export function monthlySeries(
	crashes: Crash[],
	measure: Measure,
	firstDate: string,
	lastDate: string,
): MonthlySeries {
	const months: string[] = []
	let y = Number(firstDate.slice(0, 4))
	let m = Number(firstDate.slice(5, 7)) - 1
	const endY = Number(lastDate.slice(0, 4))
	const endM = Number(lastDate.slice(5, 7)) - 1
	while (y < endY || (y === endY && m <= endM)) {
		months.push(`${y}-${String(m + 1).padStart(2, '0')}`)
		m++
		if (m > 11) {
			m = 0
			y++
		}
	}
	const index = new Map(months.map((k, i) => [k, i]))
	const values = {
		veh: months.map(() => 0),
		ped: months.map(() => 0),
		bike: months.map(() => 0),
	}
	for (const c of crashes) {
		const i = index.get(c.date.slice(0, 7))
		if (i === undefined) continue
		values[c.mode][i] = (values[c.mode][i] ?? 0) + weight(c, measure)
	}
	return { months, values }
}

export interface AnnualSeries {
	years: number[]
	values: Record<Mode, number[]>
}

export function annualSeries(
	crashes: Crash[],
	measure: Measure,
	years: number[],
): AnnualSeries {
	const index = new Map(years.map((y, i) => [y, i]))
	const values = {
		veh: years.map(() => 0),
		ped: years.map(() => 0),
		bike: years.map(() => 0),
	}
	for (const c of crashes) {
		const i = index.get(c.year)
		if (i === undefined) continue
		values[c.mode][i] = (values[c.mode][i] ?? 0) + weight(c, measure)
	}
	return { years, values }
}

/** Running total by calendar day-of-year (1…365) for one year. */
export function cumulativeByDay(
	crashes: Crash[],
	year: number,
	measure: Measure,
	throughDoy = 365,
): number[] {
	const daily = new Array<number>(366).fill(0)
	for (const c of crashes) {
		if (c.year !== year) continue
		const d = Math.min(crashCalendarDoy(c), 365)
		daily[d] = (daily[d] ?? 0) + weight(c, measure)
	}
	const out: number[] = []
	let run = 0
	for (let d = 1; d <= Math.min(throughDoy, 365); d++) {
		run += daily[d] ?? 0
		out.push(run)
	}
	return out
}

// ---- Rankings ---------------------------------------------------------------

export interface Ranked {
	key: string
	value: number
	crashes: number
	ksi: number
	ped: number
	bike: number
}

/** Intersection key that ignores order ("A/B" == "B/A"). */
export function locationKey(c: VillageCrash): string {
	if (c.cross) return [c.street, c.cross].sort().join(' & ')
	return c.street
}

export function rank<T extends Crash>(
	crashes: T[],
	keyOf: (c: T) => string | null,
	measure: Measure,
	limit = 15,
): Ranked[] {
	const acc = new Map<string, Ranked>()
	for (const c of crashes) {
		const key = keyOf(c)
		if (!key) continue
		const r = acc.get(key) ?? {
			key,
			value: 0,
			crashes: 0,
			ksi: 0,
			ped: 0,
			bike: 0,
		}
		const w = weight(c, measure)
		r.value += w
		r.crashes += 1
		// The breakdown columns count the same crashes as the value column
		// (e.g. ped/bike *injury* crashes when counting injury crashes).
		if (w > 0) {
			if (isKsi(c)) r.ksi += 1
			if (c.mode === 'ped') r.ped += 1
			if (c.mode === 'bike') r.bike += 1
		}
		acc.set(key, r)
	}
	return [...acc.values()]
		.filter((r) => r.value > 0)
		.sort(
			(a, b) =>
				b.value - a.value ||
				b.crashes - a.crashes ||
				a.key.localeCompare(b.key),
		)
		.slice(0, limit)
}
