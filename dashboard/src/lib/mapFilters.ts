// Map-only filters: time of day, weekday/weekend, street, cause and
// hit-and-run. The page's year / who / count filters apply first; these
// narrow the map further. Pure functions, so the filtering is unit-tested
// without a DOM.

import type { Measure, VillageCrash } from './types'

export type TimeOfDay = 'all' | 'morning' | 'midday' | 'evening' | 'night'
export type DayKind = 'all' | 'weekday' | 'weekend'

export interface MapFilters {
	time: TimeOfDay
	days: DayKind
	/** Street name as normalized by the build (no N/S/E/W prefix). */
	street: string | null
	/** Primary contributing cause. */
	cause: string | null
	hitRun: boolean
}

export const DEFAULT_MAP_FILTERS: MapFilters = {
	time: 'all',
	days: 'all',
	street: null,
	cause: null,
	hitRun: false,
}

/** What the map's dots are, per page measure — "Where {noun} happened".
 * "People hurt" draws the crashes that hurt someone. */
export const MAP_NOUN: Record<Measure, string> = {
	crashes: 'crashes',
	injury: 'injury crashes',
	ksi: 'fatal & serious-injury crashes',
	people: 'crashes that hurt someone',
}

/** Dot-size key for what's on the map (radii match the markers). */
export const SIZE_KEY: Record<Measure, Array<[number, string]>> = {
	crashes: [
		[3, 'no injury'],
		[5, 'injury'],
		[8, 'fatal or serious'],
	],
	injury: [
		[5, 'minor or possible injury'],
		[8, 'fatal or serious'],
	],
	people: [
		[5, 'minor or possible injury'],
		[8, 'fatal or serious'],
	],
	ksi: [
		[7, 'serious injury'],
		[9, 'fatal'],
	],
}

export const TIMES: readonly TimeOfDay[] = [
	'all',
	'morning',
	'midday',
	'evening',
	'night',
]
export const DAY_KINDS: readonly DayKind[] = ['all', 'weekday', 'weekend']

export const TIME_LABEL: Record<TimeOfDay, string> = {
	all: 'Any time',
	morning: 'Morning, 6–10 am',
	midday: 'Midday, 10 am–4 pm',
	evening: 'Evening, 4–8 pm',
	night: 'Night, 8 pm–6 am',
}

export const DAY_LABEL: Record<DayKind, string> = {
	all: 'Every day',
	weekday: 'Weekdays',
	weekend: 'Weekends',
}

/** Which time-of-day bucket an hour (0–23) falls in. */
export function hourBucket(hour: number | null): TimeOfDay | null {
	if (hour === null) return null
	if (hour >= 6 && hour < 10) return 'morning'
	if (hour >= 10 && hour < 16) return 'midday'
	if (hour >= 16 && hour < 20) return 'evening'
	return 'night'
}

/** Day of week (0 = Sunday) for a YYYY-MM-DD date, independent of the
 * viewer's time zone. */
export function weekday(date: string): number {
	const [y, m, d] = date.split('-').map(Number)
	return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

export function onStreet(c: VillageCrash, street: string): boolean {
	return c.street === street || c.cross === street
}

/** Every filter except the named one — for faceted dropdown counts. */
export function passesMapFilters(
	c: VillageCrash,
	f: MapFilters,
	except?: 'street' | 'cause',
): boolean {
	if (f.hitRun && !c.hitRun) return false
	if (f.time !== 'all' && hourBucket(c.hour) !== f.time) return false
	if (f.days !== 'all') {
		const wd = weekday(c.date)
		const weekend = wd === 0 || wd === 6
		if ((f.days === 'weekend') !== weekend) return false
	}
	if (except !== 'street' && f.street !== null && !onStreet(c, f.street))
		return false
	if (except !== 'cause' && f.cause !== null && c.cause1 !== f.cause)
		return false
	return true
}

export interface ActiveFilter {
	key: keyof MapFilters
	label: string
}

/** Each active map filter in plain words, with the key that clears it. */
export function describeMapFilters(f: MapFilters): ActiveFilter[] {
	const out: ActiveFilter[] = []
	if (f.days !== 'all') out.push({ key: 'days', label: DAY_LABEL[f.days] })
	if (f.time !== 'all') out.push({ key: 'time', label: TIME_LABEL[f.time] })
	if (f.street) out.push({ key: 'street', label: `On ${f.street}` })
	if (f.cause) out.push({ key: 'cause', label: f.cause })
	if (f.hitRun) out.push({ key: 'hitRun', label: 'Hit and run' })
	return out
}

/** Distinct values with counts, most common first — for the dropdowns. */
export function tally(
	values: Iterable<string | null>,
): Array<[string, number]> {
	const acc = new Map<string, number>()
	for (const v of values) if (v) acc.set(v, (acc.get(v) ?? 0) + 1)
	return [...acc].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}
