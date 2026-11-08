import { create } from 'zustand'
import { decodeIdot, decodeVillage } from './data'
import { type CrashFilters, DEFAULT_FILTERS } from './filters'
import type {
	Basemap,
	CompactTable,
	IdotCrash,
	Manifest,
	Measure,
	ModeFilter,
	VillageCrash,
} from './types'
import {
	type Interstate,
	type Theme,
	type UrlState,
	pushUrl,
	readUrl,
	writeUrl,
} from './url'

export type Status = 'loading' | 'ready' | 'error'

export interface LoadError {
	message: string
	status?: number
	url?: string
}

export const SYSTEM_THEME: Theme =
	typeof matchMedia !== 'undefined' &&
	matchMedia('(prefers-color-scheme: dark)').matches
		? 'dark'
		: 'light'

/** Keep the <html> class + color-scheme in sync, synchronously, so chart code
 * reading getComputedStyle on the next render sees the new tokens. */
function applyThemeClass(theme: Theme) {
	if (typeof document !== 'undefined') {
		document.documentElement.classList.toggle('dark', theme === 'dark')
	}
}

interface AppState {
	status: Status
	error: LoadError | null
	village: VillageCrash[] | null
	idot: IdotCrash[] | null
	basemap: Basemap | null
	manifest: Manifest | null

	// URL-serialized view state.
	year: number | null
	mode: ModeFilter
	measure: Measure
	interstate: Interstate
	crash: string | null
	theme: Theme
	mapFull: boolean
	filters: CrashFilters

	load: () => Promise<void>
	setYear: (y: number | null) => void
	setMode: (m: ModeFilter) => void
	setMeasure: (m: Measure) => void
	setInterstate: (i: Interstate) => void
	setCrash: (id: string | null) => void
	toggleTheme: () => void
	setFilters: (patch: Partial<CrashFilters>) => void
	resetFilters: () => void
	clearFilter: (key: keyof CrashFilters) => void
	openMapFull: () => void
	closeMapFull: () => void
	/** Browser Back/Forward: adopt the entry's pop-out state, then rewrite
	 * the URL so it matches the filters still in effect. */
	onPopState: () => void
}

export function urlStateOf(s: AppState): UrlState {
	return {
		year: s.year,
		mode: s.mode,
		measure: s.measure,
		interstate: s.interstate,
		crash: s.crash,
		theme: s.theme,
		mapFull: s.mapFull,
		filters: s.filters,
	}
}

const initial = readUrl()
applyThemeClass(initial.theme ?? SYSTEM_THEME)

export const useStore = create<AppState>((set, get) => ({
	status: 'loading',
	error: null,
	village: null,
	idot: null,
	basemap: null,
	manifest: null,

	year: initial.year,
	mode: initial.mode,
	measure: initial.measure,
	interstate: initial.interstate,
	crash: initial.crash,
	theme: initial.theme ?? SYSTEM_THEME,
	mapFull: initial.mapFull,
	filters: initial.filters,

	async load() {
		set({ status: 'loading', error: null })
		const base = `${import.meta.env.BASE_URL}data`
		try {
			// Village data drives most of the page; paint it before the larger
			// IDOT history arrives.
			const [manifest, village] = await Promise.all([
				fetchJson<Manifest>(`${base}/manifest.json`),
				fetchJson<CompactTable>(`${base}/village.json`),
			])
			set({ manifest, village: decodeVillage(village), status: 'ready' })
			const [idot, basemap] = await Promise.all([
				fetchJson<CompactTable>(`${base}/idot.json`),
				fetchJson<Basemap>(`${base}/basemap.json`),
			])
			set({ idot: decodeIdot(idot), basemap })
		} catch (err) {
			const e = err as LoadError
			set({
				status: 'error',
				error: {
					message: e.message ?? 'Failed to load data',
					status: e.status,
					url: e.url,
				},
			})
		}
	},

	setYear: (year) => set({ year }),
	setMode: (mode) => set({ mode }),
	setMeasure: (measure) => set({ measure }),
	setInterstate: (interstate) => set({ interstate }),
	setCrash: (crash) => set({ crash }),
	toggleTheme: () =>
		set((s) => {
			const theme: Theme = s.theme === 'dark' ? 'light' : 'dark'
			applyThemeClass(theme)
			return { theme }
		}),
	setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
	resetFilters: () => set({ filters: DEFAULT_FILTERS }),
	clearFilter: (key) =>
		set((s) => ({
			filters: { ...s.filters, [key]: DEFAULT_FILTERS[key] },
		})),
	openMapFull: () => {
		if (get().mapFull) return
		set({ mapFull: true })
		pushUrl(urlStateOf(get()), SYSTEM_THEME)
	},
	closeMapFull: () => {
		if (!get().mapFull) return
		// Opened in this tab: step back off the entry we pushed. Opened from
		// a shared full-screen link: there is nothing to go back to.
		if ((history.state as { mapFull?: boolean } | null)?.mapFull) {
			history.back()
		} else {
			set({ mapFull: false })
		}
	},
	onPopState: () => {
		set({ mapFull: readUrl().mapFull })
		writeUrl(urlStateOf(get()), SYSTEM_THEME)
	},
}))

async function fetchJson<T>(url: string): Promise<T> {
	let res: Response
	try {
		res = await fetch(url)
	} catch {
		throw { message: 'Network error fetching data', url } as LoadError
	}
	if (!res.ok) {
		throw {
			message: 'Failed to load data',
			status: res.status,
			url,
		} as LoadError
	}
	return res.json() as Promise<T>
}
