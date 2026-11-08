// The URL is the source of truth for view state, so a shared link reproduces
// the exact same view. Short keys; only non-default values are serialized so
// clean links stay short. Pure string-in/string-out helpers live here so they
// can be unit-tested without a DOM.

import type { Measure, ModeFilter } from './types'

export type Theme = 'light' | 'dark'
/** Long-view filter: include or exclude crashes on I-290 (and its ramps). */
export type Interstate = 'incl' | 'excl'

export interface UrlState {
	/** Focus year for the Village data; null = latest year in the data. */
	year: number | null
	mode: ModeFilter
	measure: Measure
	interstate: Interstate
	/** Crash permalink (Village tamainid). */
	crash: string | null
	theme: Theme | null
}

export const DEFAULT_URL_STATE: UrlState = {
	year: null,
	mode: 'all',
	measure: 'injury',
	interstate: 'excl',
	crash: null,
	theme: null,
}

const MEASURES: readonly Measure[] = ['crashes', 'injury', 'ksi', 'people']
const MODE_FILTERS: readonly ModeFilter[] = ['all', 'veh', 'ped', 'bike']

function oneOf<T extends string>(
	v: string | null,
	options: readonly T[],
	fallback: T,
): T {
	return v !== null && (options as readonly string[]).includes(v)
		? (v as T)
		: fallback
}

export function parseUrl(search: string): UrlState {
	const p = new URLSearchParams(search)
	const y = Number.parseInt(p.get('year') ?? '', 10)
	const theme = p.get('theme')
	const crash = p.get('crash')
	return {
		year: Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : null,
		mode: oneOf(p.get('mode'), MODE_FILTERS, DEFAULT_URL_STATE.mode),
		measure: oneOf(p.get('measure'), MEASURES, DEFAULT_URL_STATE.measure),
		interstate: p.get('i290') === 'incl' ? 'incl' : 'excl',
		crash: crash && /^[\w-]{1,32}$/.test(crash) ? crash : null,
		theme: theme === 'light' || theme === 'dark' ? theme : null,
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
	return p.toString()
}

export function readUrl(): UrlState {
	if (typeof location === 'undefined') return { ...DEFAULT_URL_STATE }
	return parseUrl(location.search)
}

export function writeUrl(state: UrlState, systemTheme: Theme): void {
	const qs = serializeUrl(state, systemTheme)
	const next = qs ? `${location.pathname}?${qs}` : location.pathname
	history.replaceState(null, '', next)
}
