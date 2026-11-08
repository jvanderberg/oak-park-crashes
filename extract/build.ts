// Turn the raw snapshots in data/raw/ into:
//   data/village_crashes.csv, data/idot_crashes.csv   (decoded, one row per crash)
//   data/codebook.json                                (derived code tables)
//   dashboard/public/data/{village,idot,manifest}.json (compact app data)
//
// Every step asserts what it assumes. A failed assertion aborts the build so
// a schema change upstream can never ship as a silently wrong dashboard.

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildBasemap } from './basemap.ts'
import {
	type Codebook,
	type CodebookReport,
	cleanLabel,
	codeKey,
	decode,
	deriveCodebook,
} from './codebook.ts'
import { IDOT_LAYERS, layerUrl } from './fetch-idot.ts'
import { PUBLIC_REPORT_URL } from './powerbi.ts'
import {
	type Cell,
	RAW_DIR,
	REPO_ROOT,
	type RawTable,
	isMain,
	readRaw,
	rowsAsObjects,
} from './raw.ts'

// ---- Normalized record ---------------------------------------------------

export type Severity = 'K' | 'A' | 'B' | 'C' | 'O' | 'U'
export type Mode = 'ped' | 'bike' | 'veh'

export interface Crash {
	id: string
	date: string // YYYY-MM-DD (local)
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
	report: string
	idotNo: string | null
	location: string
	street: string
	cross: string | null
	atIntersection: boolean
}

export interface IdotCrash extends Crash {
	agency: string | null
	agencyReport: string | null
	interstate: boolean
	roadClass: string | null
}

const SEVERITY: Record<string, Severity> = {
	'Fatal Crash': 'K',
	'A Injury Crash': 'A',
	'B Injury Crash': 'B',
	'C Injury Crash': 'C',
	'No Injuries': 'O',
}

// Oak Park's bounding box with a small margin; points outside are treated as
// geocoding errors rather than plotted in the wrong town.
const BBOX = {
	minLat: 41.862,
	maxLat: 41.912,
	minLon: -87.812,
	maxLon: -87.769,
}

function inBox(lat: number | null, lon: number | null): boolean {
	return (
		lat !== null &&
		lon !== null &&
		lat >= BBOX.minLat &&
		lat <= BBOX.maxLat &&
		lon >= BBOX.minLon &&
		lon <= BBOX.maxLon
	)
}

function num(v: Cell): number {
	const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''))
	return Number.isFinite(n) ? n : 0
}

function str(v: Cell): string {
	return v === null || v === undefined ? '' : String(v).trim()
}

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(`build: ${msg}`)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "Harlem Ave" from "N HARLEM AVE" / "S Harlem Ave" — directionals dropped
 *  so a corridor's north and south halves aggregate together. */
export function normalizeStreet(raw: string): string {
	const s = raw
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/^(N|S|E|W)\s+/i, '')
	return s
		.toLowerCase()
		.replace(/\b([a-z])/g, (m) => m.toUpperCase())
		.replace(/\bI(\d)/g, 'I-$1')
		.replace(/\bI-?290\b/gi, 'I-290')
}

/** Village crash-time text "MM/DD/YYYY hh:mm AM" → local date + hour. */
export function parseVillageTime(text: string): { date: string; hour: number } {
	const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}) (AM|PM)$/)
	assert(m, `unexpected CrashDttmText "${text}"`)
	const [, mo, d, y, hh, , ap] = m
	let hour = Number(hh) % 12
	if (ap === 'PM') hour += 12
	return { date: `${y}-${mo}-${d}`, hour }
}

// ---- Codebooks -------------------------------------------------------------

interface Codebooks {
	weather: Codebook
	light: Codebook
	control: Codebook
	surface: Codebook
	cause: Codebook
	reports: CodebookReport[]
}

function buildCodebooks(idotRows: Array<Record<string, Cell>>): Codebooks {
	// Village data begins in 2024; derive from the same SR 1050 revision era.
	const recent = idotRows.filter((r) => num(r._year) >= 2024)
	const spec: Array<[keyof Omit<Codebooks, 'reports'>, string, string]> = [
		['weather', 'WeatherCode', 'WeatherCond'],
		['light', 'LightConditionCode', 'LightingCond'],
		['control', 'TrafficControlDeviceCode', 'TrafficControlDevice'],
		['surface', 'RoadSurfaceConditionCode', 'RoadSurfaceCond'],
		['cause', 'Cause1Code', 'Cause1'],
	]
	const out = { reports: [] as CodebookReport[] } as Codebooks
	for (const [name, codeField, labelField] of spec) {
		const { book, report } = deriveCodebook(recent, codeField, labelField, name)
		// Codes IDOT stopped using by 2024 still appear in older years and in
		// a few Village reports; fill them from the full 2014– history.
		const older = deriveCodebook(idotRows, codeField, labelField, name)
		const merged = { ...older.book, ...book }
		assert(report.codes >= 5, `codebook ${name} has only ${report.codes} codes`)
		out[name] = merged
		out.reports.push({
			...report,
			codes: Object.keys(merged).length,
			ambiguous: [
				...report.ambiguous,
				...older.report.ambiguous.filter((a) => !(a.code in book)),
			],
		})
	}
	return out
}

// ---- Village -------------------------------------------------------------

interface VillageCheck {
	year: number
	severity: string
	published: number
	derived: number
}

function buildVillage(books: Codebooks) {
	const fact = readRaw('village/fact_accidents.json')
	const types = rowsAsObjects(readRaw('village/dim_crash_type.json'))
	const causes = rowsAsObjects(readRaw('village/dim_contrib_factor.json'))
	const gis = rowsAsObjects(readRaw('village/dim_gis_latlon.json'))
	const checks = readRaw('village/check_totals.json')

	const typeByCode = new Map(types.map((t) => [codeKey(t['Crash Code']), t]))
	const causeByCode = new Map(
		causes.map((c) => [
			codeKey(c['Contributing Factor Code1']),
			cleanLabel(c['Contributing Factor1']),
		]),
	)
	const gisById = new Map(gis.map((g) => [str(g.SourceID), g]))

	const MODE: Record<string, Mode> = {
		Pedestrian: 'ped',
		Pedalcyclist: 'bike',
		Car: 'veh',
	}
	let noCoords = 0
	let outOfBox = 0
	const undocumented = new Map<string, number>()
	const note = (label: string | null, field: string) => {
		if (label?.endsWith('(undocumented)')) {
			const k = `${field}: ${label}`
			undocumented.set(k, (undocumented.get(k) ?? 0) + 1)
		}
		return label
	}
	const cause = (v: Cell) => {
		const k = codeKey(v)
		if (k === null) return null
		// IDOT's code table first, so both sources name every cause the
		// same way (the Village's own lookup truncates long names at 45
		// characters); the Village lookup covers codes IDOT never labels.
		return note(
			books.cause[k] ?? causeByCode.get(k) ?? decode(books.cause, k),
			'cause',
		)
	}

	const records: VillageCrash[] = rowsAsObjects(fact).map((r) => {
		const sevLabel = str(r.CrashInjurySeverity)
		const sev = SEVERITY[sevLabel]
		assert(sev, `unknown village CrashInjurySeverity "${sevLabel}"`)
		const t = typeByCode.get(codeKey(r['1stCrashType']))
		assert(t, `unknown village 1stCrashType "${str(r['1stCrashType'])}"`)
		const mode = MODE[str(t['Crash Mode'])]
		assert(mode, `unknown Crash Mode "${str(t['Crash Mode'])}"`)
		const { date, hour } = parseVillageTime(str(r.CrashDttmText))
		const g = gisById.get(str(r.tamainid))
		let lat = g ? num(g.Y_DD) || null : null
		let lon = g ? num(g.X_DD) || null : null
		if (lat === null || lon === null) noCoords++
		else if (!inBox(lat, lon)) {
			outOfBox++
			lat = null
			lon = null
		}
		const cross = str(r.Intersection)
		return {
			id: str(r.tamainid),
			report: str(r.ReportNum),
			idotNo: str(r.idotcolno) || null,
			date,
			hour,
			sev,
			mode,
			type: cleanLabel(t['Crash Type']),
			k: num(r['K Fatalities']),
			a: num(r['A Incapacitated']),
			b: num(r['B NonIncap']),
			c: num(r['C ReportNotEvident']),
			hitRun: str(r['Hit&Run']) === 'True',
			cause1: cause(r['1stContribCause']),
			cause2: cause(r['2ndContribCause']),
			light: note(decode(books.light, r.lightcond), 'light'),
			weather: note(decode(books.weather, r.weather), 'weather'),
			surface: note(decode(books.surface, r.rdsurface), 'surface'),
			control: note(decode(books.control, r.trafcontrl), 'control'),
			lat: lat === null ? null : Math.round(lat * 1e5) / 1e5,
			lon: lon === null ? null : Math.round(lon * 1e5) / 1e5,
			location: cleanLabel(r.Location),
			street: normalizeStreet(str(r.StreetName)),
			cross: cross ? normalizeStreet(cross) : null,
			atIntersection: num(r.AtIntersection) === 1,
		}
	})

	assert(
		new Set(records.map((r) => r.id)).size === records.length,
		'village tamainid is not unique',
	)
	const placed = records.filter((r) => r.lat !== null).length
	assert(
		placed / records.length >= 0.95,
		`only ${placed}/${records.length} village crashes have coordinates`,
	)

	// End-to-end check against the dashboard's own published measure
	// ("Total Accidents" counts crash rows, one per tamainid).
	const SEV_GROUP: Record<Severity, string> = {
		K: 'Fatal',
		A: 'Injury',
		B: 'Injury',
		C: 'Injury',
		O: 'Property Damage',
		U: 'Unknown',
	}
	const derived = new Map<string, number>()
	for (const r of records) {
		const key = `${r.date.slice(0, 4)}|${SEV_GROUP[r.sev]}`
		derived.set(key, (derived.get(key) ?? 0) + 1)
	}
	const checkRows: VillageCheck[] = rowsAsObjects(checks).map((c) => ({
		year: num(c.Year),
		severity: str(c.CrashSeverity),
		published: num(c['Total Accidents']),
		derived: derived.get(`${num(c.Year)}|${str(c.CrashSeverity)}`) ?? 0,
	}))
	const publishedTotal = checkRows.reduce((s, c) => s + c.published, 0)
	const distinctReports = new Set(records.map((r) => r.report)).size
	for (const c of checkRows) {
		assert(
			c.published === c.derived,
			`village ${c.year} ${c.severity}: dashboard says ${c.published}, raw rows give ${c.derived}`,
		)
	}
	assert(
		publishedTotal === records.length,
		`village check totals cover ${publishedTotal} crashes but raw has ${records.length} rows`,
	)

	const dupReports = records.length - distinctReports
	return {
		records,
		raw: fact,
		stats: {
			rows: records.length,
			distinctReports,
			dupReports,
			noCoords: noCoords + outOfBox,
			checks: checkRows,
			undocumented: Object.fromEntries(undocumented),
		},
	}
}

// ---- IDOT ----------------------------------------------------------------

function loadIdotRows(): {
	rows: Array<Record<string, Cell>>
	tables: Record<number, RawTable>
} {
	const rows: Array<Record<string, Cell>> = []
	const tables: Record<number, RawTable> = {}
	const files = readdirSync(join(RAW_DIR, 'idot')).filter((f) =>
		/^\d{4}\.json$/.test(f),
	)
	for (const f of files.sort()) {
		const year = Number(f.slice(0, 4))
		const t = readRaw(`idot/${f}`)
		tables[year] = t
		for (const r of rowsAsObjects(t)) rows.push({ ...r, _year: year })
	}
	return { rows, tables }
}

function buildIdot(rows: Array<Record<string, Cell>>, books: Codebooks) {
	let unknownSev = 0
	let noCoords = 0
	let signFixed = 0
	const records: IdotCrash[] = rows.map((r) => {
		const year = num(r._year)
		const month = num(r.CrashMonth)
		const day = num(r.CrashDay)
		assert(
			month >= 1 && month <= 12 && day >= 1 && day <= 31,
			`bad IDOT date ${year}-${month}-${day}`,
		)
		const sev = SEVERITY[cleanLabel(r.CrashInjurySeverity)] ?? 'U'
		if (sev === 'U') unknownSev++
		const firstType = cleanLabel(r.TypeOfFirstCrash)
		const mode: Mode =
			firstType === 'Pedestrian'
				? 'ped'
				: firstType === 'Pedalcyclist'
					? 'bike'
					: 'veh'
		let lat = num(r.TSCrashLatitude) || null
		let lon = num(r.TSCrashLongitude) || null
		// IDOT's 2014–2017 files drop the minus sign from longitude.
		if (lon !== null && lon > 0) {
			lon = -lon
			signFixed++
		}
		if (!inBox(lat, lon)) {
			noCoords++
			lat = null
			lon = null
		}
		const hour = Number.parseInt(str(r.CrashHour), 10)
		const agency = cleanLabel(r.InvestigatingAgencyDescrip)
		const roadClass = cleanLabel(r.RoadwayFunctionalClass)
		return {
			id: str(r.ICN) || str(r.CrashID),
			date: `${year}-${pad(month)}-${pad(day)}`,
			hour: Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : null,
			sev,
			mode,
			type: firstType,
			k: num(r.TotalFatals),
			a: num(r.AInjuries),
			b: num(r.BInjuries),
			c: num(r.CInjuries),
			hitRun: str(r.HitAndRun) === 'Y',
			cause1: decode(books.cause, r.Cause1Code),
			cause2: decode(books.cause, r.Cause2Code),
			light: decode(books.light, r.LightConditionCode),
			weather: decode(books.weather, r.WeatherCode),
			surface: decode(books.surface, r.RoadSurfaceConditionCode),
			control: decode(books.control, r.TrafficControlDeviceCode),
			lat: lat === null ? null : Math.round(lat * 1e5) / 1e5,
			lon: lon === null ? null : Math.round(lon * 1e5) / 1e5,
			agency: agency && agency !== 'None' ? agency : null,
			agencyReport: str(r.AgencyReportNumber) || null,
			interstate: roadClass === 'InterState',
			roadClass: roadClass || null,
		}
	})
	assert(
		unknownSev <= 5,
		`${unknownSev} IDOT rows have an unrecognized severity — schema drift?`,
	)
	const byYear: Record<number, number> = {}
	for (const r of records) {
		const y = Number(r.date.slice(0, 4))
		byYear[y] = (byYear[y] ?? 0) + 1
	}
	for (const [y, n] of Object.entries(byYear)) {
		assert(n >= 500, `IDOT ${y} has only ${n} Oak Park crashes`)
	}
	const missingAgency = Object.entries(
		records.reduce<Record<string, number>>((acc, r) => {
			if (r.agency === null)
				acc[r.date.slice(0, 4)] = (acc[r.date.slice(0, 4)] ?? 0) + 1
			return acc
		}, {}),
	)
	return {
		records,
		stats: {
			rows: records.length,
			unknownSev,
			noCoords,
			signFixed,
			byYear,
			missingAgency,
		},
	}
}

// ---- Cross-source match (for the honesty panel) --------------------------

function matchSources(village: VillageCrash[], idot: IdotCrash[]) {
	// Village case numbers ("2400558") equal IDOT's AgencyReportNumber for
	// crashes the Oak Park PD filed with IDOT.
	const vCase = new Set(village.map((v) => v.report.replace(/\s+/g, '')))
	const out: Record<
		string,
		{ idotCity: number; matched: number; village: number }
	> = {}
	for (const year of ['2024', '2025']) {
		const city = idot.filter(
			(r) => r.date.startsWith(year) && /^\d{7}$/.test(r.agencyReport ?? ''),
		)
		out[year] = {
			idotCity: city.length,
			matched: city.filter((r) => vCase.has(r.agencyReport ?? '')).length,
			village: village.filter((v) => v.date.startsWith(year)).length,
		}
	}
	return out
}

// ---- Output ----------------------------------------------------------------

function csvCell(v: unknown): string {
	if (v === null || v === undefined) return ''
	const s = typeof v === 'boolean' ? (v ? 'Y' : 'N') : String(v)
	return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function writeCsv<T extends object>(
	path: string,
	rows: T[],
	columns: Array<keyof T>,
) {
	const lines = [columns.join(',')]
	for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(','))
	writeFileSync(path, `${lines.join('\n')}\n`)
}

/** Column-major-ish compact JSON: string columns dictionary-encoded. */
export interface CompactTable {
	fields: string[]
	dicts: Record<string, string[]>
	rows: Array<Array<string | number | null>>
}

function compact<T extends object>(
	rows: T[],
	fields: Array<keyof T & string>,
	dictFields: Array<keyof T & string>,
): CompactTable {
	const dicts: Record<string, string[]> = {}
	const index: Record<string, Map<string, number>> = {}
	for (const f of dictFields) {
		dicts[f] = []
		index[f] = new Map()
	}
	const out = rows.map((r) =>
		fields.map((f) => {
			const v = r[f] as unknown
			if (v === null || v === undefined) return null
			if (typeof v === 'boolean') return v ? 1 : 0
			const idx = index[f]
			if (idx) {
				const s = String(v)
				let i = idx.get(s)
				if (i === undefined) {
					i = dicts[f]?.length ?? 0
					dicts[f]?.push(s)
					idx.set(s, i)
				}
				return i
			}
			return v as string | number
		}),
	)
	return { fields, dicts, rows: out }
}

export function build() {
	const { rows: idotRows, tables: idotTables } = loadIdotRows()
	const books = buildCodebooks(idotRows)
	const village = buildVillage(books)
	const idot = buildIdot(idotRows, books)
	const match = matchSources(village.records, idot.records)

	village.records.sort(
		(a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
	)
	idot.records.sort(
		(a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
	)

	const dataDir = join(REPO_ROOT, 'data')
	const appDir = join(REPO_ROOT, 'dashboard', 'public', 'data')
	mkdirSync(appDir, { recursive: true })

	const common = [
		'id',
		'date',
		'hour',
		'sev',
		'mode',
		'type',
		'k',
		'a',
		'b',
		'c',
		'hitRun',
		'cause1',
		'cause2',
		'light',
		'weather',
		'surface',
		'control',
		'lat',
		'lon',
	] as const
	const vCols = [
		...common,
		'report',
		'idotNo',
		'location',
		'street',
		'cross',
		'atIntersection',
	] as Array<keyof VillageCrash & string>
	const iCols = [
		...common,
		'agency',
		'agencyReport',
		'interstate',
		'roadClass',
	] as Array<keyof IdotCrash & string>
	writeCsv(join(dataDir, 'village_crashes.csv'), village.records, vCols)
	writeCsv(join(dataDir, 'idot_crashes.csv'), idot.records, iCols)
	writeFileSync(
		join(dataDir, 'codebook.json'),
		`${JSON.stringify(
			{
				note: 'Derived from IDOT statewide crash layers (2024–2025 rows), which publish each SR 1050 code beside its label. See extract/codebook.ts.',
				weather: books.weather,
				light: books.light,
				control: books.control,
				surface: books.surface,
				cause: books.cause,
				ambiguities: books.reports.filter((r) => r.ambiguous.length),
			},
			null,
			2,
		)}\n`,
	)

	const dictCommon = [
		'sev',
		'mode',
		'type',
		'cause1',
		'cause2',
		'light',
		'weather',
		'surface',
		'control',
	] as const
	const appVillageFields = [...common, 'location', 'street', 'cross'] as Array<
		keyof VillageCrash & string
	>
	const appIdotFields = [...common, 'agency', 'interstate'] as Array<
		keyof IdotCrash & string
	>
	writeFileSync(
		join(appDir, 'village.json'),
		JSON.stringify(
			compact(village.records, appVillageFields, [
				...dictCommon,
				'street',
				'cross',
				'location',
			] as Array<keyof VillageCrash & string>),
		),
	)
	writeFileSync(
		join(appDir, 'idot.json'),
		JSON.stringify(
			compact(idot.records, appIdotFields, [...dictCommon, 'agency'] as Array<
				keyof IdotCrash & string
			>),
		),
	)

	const basemap = buildBasemap()
	writeFileSync(join(appDir, 'basemap.json'), JSON.stringify(basemap))

	const fact = village.raw
	const villageLast = village.records.at(-1)?.date ?? null
	const idotYears = Object.keys(idotTables).map(Number).sort()
	const manifest = {
		generatedAt: new Date().toISOString(),
		sources: {
			village: {
				title: 'Village of Oak Park — Traffic Crash Dashboard',
				url: 'https://opendata.oak-park.us/TrafficCrash',
				apiUrl: PUBLIC_REPORT_URL,
				description:
					'Every crash on a public roadway inside the Village reported to the Oak Park Police Department since 1 Jan 2024, from the Power BI model behind the Village dashboard. Posted about a week after each crash.',
				sourceUpdatedAt: fact.sourceUpdatedAt,
				fetchedAt: fact.fetchedAt,
				rows: village.stats.rows,
				firstDate: village.records[0]?.date ?? null,
				lastDate: villageLast,
			},
			idot: {
				title: 'Illinois Department of Transportation — statewide crash data',
				url: 'https://www.arcgis.com/home/search.html?q=owner%3AIDOTAdmin%20crashes',
				description:
					'IDOT’s annual crash files (one ArcGIS layer per year), filtered to crashes IDOT locates in Oak Park. Covers every reporting agency, including Illinois State Police on I-290, but only state-reportable crashes: an injury or death, or property damage over $1,500 ($500 if a vehicle is uninsured; 625 ILCS 5/11-407).',
				years: idotYears.map((y) => ({
					year: y,
					url: layerUrl(y),
					layer: IDOT_LAYERS[y],
					rows: idot.stats.byYear[y] ?? 0,
					sourceUpdatedAt: idotTables[y]?.sourceUpdatedAt ?? null,
					fetchedAt: idotTables[y]?.fetchedAt ?? null,
				})),
			},
			osm: {
				title: 'OpenStreetMap — basemap streets, rail, parks and boundary',
				url: 'https://www.openstreetmap.org/copyright',
				description:
					'Street, rail, park and Village-boundary geometry from OpenStreetMap (via the Overpass API), baked into a static file. © OpenStreetMap contributors, available under the Open Database License.',
				osmBase: basemap.osmBase,
				fetchedAt: basemap.fetchedAt,
			},
		},
		method:
			'Raw tables are fetched verbatim (data/raw/), then decoded and normalized by extract/build.ts. Village crash counts are re-derived from the raw rows and checked against the Village dashboard’s own published totals for every year and severity; the build fails on any mismatch. Weather, lighting, road-surface and traffic-control codes are decoded with tables derived from IDOT’s own rows, which publish each code beside its label. A crash’s severity is its most severe injury on the KABCO scale (K fatal, A incapacitating, B non-incapacitating, C possible injury, O none). “KSI” means killed or seriously injured (K + A).',
		checks: village.stats.checks,
		crossSource: match,
		known_issues: [
			'The two sources count different things and are never added together. Village data: every Oak Park PD report since 2024, including minor crashes, but not crashes worked by the State Police on I-290. IDOT data: all agencies including I-290, but only crashes above IDOT’s reporting threshold, and finalized months after year-end.',
			'Counts are crashes, not people: a crash that injured three people counts once in crash totals. People-injured totals (K/A/B/C counts) are shown separately where labelled.',
			'“Pedestrian” and “bicycle” crashes are classified by the crash’s first harmful event (IDOT “Type of First Crash”). A crash that began as a collision between vehicles and then struck a pedestrian is counted as a vehicle crash.',
			`${village.stats.noCoords} of ${village.stats.rows} Village crashes have no usable coordinates and are left off the map (they still count in every total).`,
			`${idot.stats.noCoords} of ${idot.stats.rows} IDOT crashes have no usable coordinates.`,
			idot.stats.signFixed > 0
				? `IDOT’s 2014–2017 files record longitude without its minus sign (${idot.stats.signFixed} crashes); the sign is restored here.`
				: '',
			village.stats.dupReports > 0
				? `${village.stats.dupReports + 1} separate Village crashes (different times and places) share a police report number. They are counted as separate crashes, as the Village dashboard also does.`
				: '',
			idot.stats.unknownSev > 0
				? `${idot.stats.unknownSev} IDOT row(s) are misaligned in IDOT’s own file (fields shifted by a stray comma); their severity is shown as “Unknown”.`
				: '',
			idot.stats.missingAgency.length
				? `IDOT leaves the investigating agency blank for: ${idot.stats.missingAgency.map(([y, n]) => `${y} (${n} crashes)`).join(', ')}. Interstate crashes are identified by road class (IDOT functional class “InterState”), which is populated for every year.`
				: '',
			'The newest IDOT year may still be preliminary; IDOT revises recent files as late reports arrive.',
			'The Village posts crashes about a week after they occur, so the most recent days are incomplete.',
		].filter(Boolean),
		codebook: books.reports.map(
			({ field, codeField, labelField, codes, ambiguous }) => ({
				field,
				codeField,
				labelField,
				codes,
				ambiguous: ambiguous.length,
			}),
		),
		undocumentedCodes: village.stats.undocumented,
	}
	writeFileSync(
		join(appDir, 'manifest.json'),
		`${JSON.stringify(manifest, null, 2)}\n`,
	)
	writeFileSync(
		join(dataDir, 'manifest.json'),
		`${JSON.stringify(manifest, null, 2)}\n`,
	)

	console.log(
		`village: ${village.stats.rows} crashes (${village.stats.distinctReports} report numbers), last ${villageLast}; checks ${village.stats.checks.length}/${village.stats.checks.length} match`,
	)
	console.log(
		`idot: ${idot.stats.rows} crashes, years ${idotYears[0]}–${idotYears.at(-1)}`,
	)
	console.log('cross-source', JSON.stringify(match))
	console.log('undocumented codes', JSON.stringify(village.stats.undocumented))
	return manifest
}

if (isMain(import.meta.url)) build()
