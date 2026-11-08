// Fetch every IDOT-reported crash in Oak Park from IDOT's statewide crash
// FeatureServers (one layer per calendar year) and write them verbatim to
// data/raw/idot/<year>.json.
//
// Historical years are effectively final, so by default only years without
// a snapshot, plus the two most recent years, are re-fetched. `--all`
// re-fetches everything.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { type Cell, RAW_DIR, isMain, writeRaw } from './raw.ts'

const SERVICE_ROOT =
	'https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services'

// Layer names as published by IDOTAdmin on ArcGIS Online (they are not
// consistently named; transcribed from the org's item search).
export const IDOT_LAYERS: Record<number, string> = {
	2014: 'Crashes_2014_SDMExtract',
	2015: 'Crashes_2015_SDMExtract',
	2016: 'Crashes_2016_SDMExtract',
	2017: 'Crashes_2017_SDMExtract',
	2018: 'Crashes_2018_SDMExtract',
	2019: 'Crashes2019',
	2020: 'Crashes_2020',
	2021: 'CRASHES2021',
	2022: 'CRASHES_2022',
	2023: 'CRASHES_2023',
	2024: 'CRASHES__2024',
	2025: 'CRASHES___2025',
}

export const IDOT_WHERE = "UPPER(CityName) LIKE 'OAK PARK%'"

export function layerUrl(year: number): string {
	return `${SERVICE_ROOT}/${IDOT_LAYERS[year]}/FeatureServer/0`
}

interface LayerMeta {
	fields: Array<{ name: string }>
	editingInfo?: { lastEditDate?: number }
	maxRecordCount?: number
}
interface QueryResult {
	features?: Array<{ attributes: Record<string, Cell> }>
	exceededTransferLimit?: boolean
	error?: { message: string }
}

async function post<T>(
	url: string,
	params: Record<string, string>,
): Promise<T> {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(params),
	})
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
	return (await res.json()) as T
}

async function fetchYear(year: number): Promise<number> {
	const base = layerUrl(year)
	const meta = (await (await fetch(`${base}?f=json`)).json()) as LayerMeta
	const columns = meta.fields.map((f) => f.name)
	const pageSize = Math.min(meta.maxRecordCount ?? 1000, 2000)
	const rows: Cell[][] = []
	for (let offset = 0; ; offset += pageSize) {
		const page = await post<QueryResult>(`${base}/query`, {
			where: IDOT_WHERE,
			outFields: '*',
			orderByFields: 'OBJECTID',
			returnGeometry: 'false',
			resultOffset: String(offset),
			resultRecordCount: String(pageSize),
			f: 'json',
		})
		if (page.error) throw new Error(`${base}: ${page.error.message}`)
		const feats = page.features ?? []
		for (const f of feats)
			rows.push(columns.map((c) => f.attributes[c] ?? null))
		if (!page.exceededTransferLimit || feats.length === 0) break
	}
	if (rows.length < 500) {
		throw new Error(
			`IDOT ${year}: only ${rows.length} Oak Park rows; expected ≥500`,
		)
	}
	const edited = meta.editingInfo?.lastEditDate
	writeRaw(`idot/${year}.json`, {
		source: `Illinois Department of Transportation — Crashes ${year} (ArcGIS FeatureServer)`,
		url: base,
		fetchedAt: new Date().toISOString(),
		sourceUpdatedAt: edited ? new Date(edited).toISOString() : null,
		query: `where=${IDOT_WHERE}&outFields=*`,
		columns,
		rows,
	})
	console.log(`idot ${year}: ${rows.length} rows`)
	return rows.length
}

export async function fetchIdot(all = false): Promise<Record<number, number>> {
	const years = Object.keys(IDOT_LAYERS).map(Number)
	const recent = new Set(years.slice(-2))
	const counts: Record<number, number> = {}
	for (const y of years) {
		const have = existsSync(join(RAW_DIR, `idot/${y}.json`))
		if (all || !have || recent.has(y)) counts[y] = await fetchYear(y)
	}
	return counts
}

if (isMain(import.meta.url)) await fetchIdot(process.argv.includes('--all'))
