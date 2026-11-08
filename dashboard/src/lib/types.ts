// Shapes of the static files written by extract/build.ts.

export type Severity = 'K' | 'A' | 'B' | 'C' | 'O' | 'U'
export type Mode = 'veh' | 'ped' | 'bike'
export const MODES: readonly Mode[] = ['veh', 'ped', 'bike'] as const

export const MODE_LABEL: Record<Mode, string> = {
	veh: 'Vehicles only',
	ped: 'Pedestrian',
	bike: 'Bicycle',
}

export const SEVERITY_LABEL: Record<Severity, string> = {
	K: 'Fatal',
	A: 'Serious injury (A)',
	B: 'Minor injury (B)',
	C: 'Possible injury (C)',
	O: 'No injury',
	U: 'Unknown',
}

/** Compact, dictionary-encoded table as written by the build step. */
export interface CompactTable {
	fields: string[]
	dicts: Record<string, string[]>
	rows: Array<Array<string | number | null>>
}

export interface Crash {
	id: string
	date: string
	year: number
	/** Day of year, 1-based — used for same-period comparisons. */
	doy: number
	/** 0-based month. */
	month: number
	hour: number | null
	sev: Severity
	mode: Mode
	type: string
	k: number
	a: number
	b: number
	c: number
	hitRun: boolean
	cause1: string | null
	cause2: string | null
	light: string | null
	weather: string | null
	surface: string | null
	control: string | null
	lat: number | null
	lon: number | null
}

export interface VillageCrash extends Crash {
	location: string
	street: string
	cross: string | null
}

export interface IdotCrash extends Crash {
	agency: string | null
	interstate: boolean
}

export interface ManifestCheck {
	year: number
	severity: string
	published: number
	derived: number
}

export interface Manifest {
	generatedAt: string
	sources: {
		village: {
			title: string
			url: string
			apiUrl: string
			description: string
			sourceUpdatedAt: string | null
			fetchedAt: string
			rows: number
			firstDate: string | null
			lastDate: string | null
		}
		idot: {
			title: string
			url: string
			description: string
			years: Array<{
				year: number
				url: string
				layer: string
				rows: number
				sourceUpdatedAt: string | null
				fetchedAt: string | null
			}>
		}
	}
	method: string
	checks: ManifestCheck[]
	crossSource: Record<
		string,
		{ idotCity: number; matched: number; village: number }
	>
	known_issues: string[]
}

/** What the charts and KPIs count. */
export type Measure = 'crashes' | 'injury' | 'ksi' | 'people'

export const MEASURE_LABEL: Record<Measure, string> = {
	crashes: 'Crashes',
	injury: 'Injury crashes',
	ksi: 'Fatal & serious-injury crashes',
	people: 'People hurt',
}

export type ModeFilter = 'all' | Mode

type LonLat = [number, number]

/** Static basemap baked from OpenStreetMap by extract/basemap.ts. */
export interface Basemap {
	attribution: string
	osmBase: string | null
	fetchedAt: string
	streets: Record<'highway' | 'major' | 'minor' | 'local', LonLat[][]>
	rail: LonLat[][]
	parks: LonLat[][]
	boundary: LonLat[][]
	labels: Array<{
		name: string
		lat: number
		lon: number
		angle: number
		tier: 1 | 2
	}>
}
