// The URL is the source of truth for view state, so a shared link reproduces
// the exact same view. Short keys; only non-default values are serialized so
// clean links stay short. Pure string-in/string-out helpers live here so they
// can be unit-tested without a DOM.

import { type CrashFilters, DAY_KINDS, DEFAULT_FILTERS, TIMES } from './filters'
import { MODE_FILTERS, type Measure, type ModeFilter } from './types'

export type Theme = 'light' | 'dark'
/** Long-view filter: include or exclude crashes on I-290 (and its ramps). */
export type Interstate = 'incl' | 'excl'

export interface UrlState {
	/** Focus year for the Village data; null = latest year in the data,
	 * 'all' = every year. */
	year: number | 'all' | null
	mode: ModeFilter
	measure: Measure
	interstate: Interstate
	/** Crash permalink (Village tamainid). */
	crash: string | null
	theme: Theme | null
	/** Map popped out to full screen. */
	mapFull: boolean
	/** The "More filters" set (days, time, street, cause, hit-and-run). */
	filters: CrashFilters
}

export const DEFAULT_URL_STATE: UrlState = {
	year: null,
	mode: 'all',
	measure: 'injury',
	interstate: 'excl',
	crash: null,
	theme: null,
	mapFull: false,
	filters: DEFAULT_FILTERS,
}

const MEASURES: readonly Measure[] = ['crashes', 'injury', 'ksi', 'people']

function oneOf<T extends string>(
	v: string | null,
	options: readonly T[],
	fallback: T,
): T {
	return v !== null && (options as readonly string[]).includes(v)
		? (v as T)
		: fallback
}

/** Free-text values (street, cause) are capped; unknown ones simply match
 * nothing until cleared, and the map shows that. */
function text(v: string | null): string | null {
	const s = v?.trim()
	return s && s.length <= 80 ? s : null
}

export function parseUrl(search: string): UrlState {
	const p = new URLSearchParams(search)
	const y = Number.parseInt(p.get('year') ?? '', 10)
	const theme = p.get('theme')
	const crash = p.get('crash')
	return {
		year:
			p.get('year') === 'all'
				? 'all'
				: Number.isFinite(y) && y >= 2000 && y <= 2100
					? y
					: null,
		mode: oneOf(p.get('mode'), MODE_FILTERS, DEFAULT_URL_STATE.mode),
		measure: oneOf(p.get('measure'), MEASURES, DEFAULT_URL_STATE.measure),
		interstate: p.get('i290') === 'incl' ? 'incl' : 'excl',
		crash: crash && /^[\w-]{1,32}$/.test(crash) ? crash : null,
		theme: theme === 'light' || theme === 'dark' ? theme : null,
		mapFull: p.get('map') === 'full',
		filters: {
			time: oneOf(p.get('tod'), TIMES, DEFAULT_FILTERS.time),
			days: oneOf(p.get('days'), DAY_KINDS, DEFAULT_FILTERS.days),
			street: text(p.get('street')),
			cause: text(p.get('cause')),
			hitRun: p.get('hr') === '1',
		},
	}
}

/** `theme` is pinned only when it differs from the visitor's system theme. */
export function serializeUrl(
	state: UrlState,
	systemTheme: Theme = 'light',
): string {
	const p = new URLSearchParams()
	if (state.year !== null) p.set('year', String(state.year))
	if (state.mode !== DEFAULT_URL_STATE.mode) p.set('mode', state.mode)
	if (state.measure !== DEFAULT_URL_STATE.measure)
		p.set('measure', state.measure)
	if (state.interstate !== DEFAULT_URL_STATE.interstate)
		p.set('i290', state.interstate)
	if (state.crash) p.set('crash', state.crash)
	if (state.theme && state.theme !== systemTheme) p.set('theme', state.theme)
	if (state.mapFull) p.set('map', 'full')
	const f = state.filters
	if (f.time !== 'all') p.set('tod', f.time)
	if (f.days !== 'all') p.set('days', f.days)
	if (f.street) p.set('street', f.street)
	if (f.cause) p.set('cause', f.cause)
	if (f.hitRun) p.set('hr', '1')
	return p.toString()
}

export function readUrl(): UrlState {
	if (typeof location === 'undefined') return { ...DEFAULT_URL_STATE }
	return parseUrl(location.search)
}

function href(state: UrlState, systemTheme: Theme): string {
	const qs = serializeUrl(state, systemTheme)
	return qs ? `${location.pathname}?${qs}` : location.pathname
}

/** Replace the current history entry (filter changes don't pile up). The
 * entry's `mapFull` marker is kept so Back still closes a popped-out map. */
export function writeUrl(state: UrlState, systemTheme: Theme): void {
	history.replaceState(history.state, '', href(state, systemTheme))
}

/** Push a new entry — used when the map pops out, so the browser's Back
 * button returns to the dashboard. */
export function pushUrl(state: UrlState, systemTheme: Theme): void {
	history.pushState({ mapFull: true }, '', href(state, systemTheme))
}
