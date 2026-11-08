// Fetch every table behind the Village of Oak Park traffic-crash dashboard
// (Oak Park Police reports, 2024 → present) and write them verbatim to
// data/raw/village/.

import {
	type ColumnRef,
	type ModelInfo,
	PUBLIC_REPORT_URL,
	getModelInfo,
	queryRows,
} from './powerbi.ts'
import { type Cell, isMain, writeRaw } from './raw.ts'

// Column lists transcribed from the model's conceptual schema
// (POST /public/reports/conceptualschema). Measures are omitted — they are
// aggregates of these columns.
const TABLES: Record<string, string[]> = {
	FactAccidents: [
		'tamainid',
		'ReportNum',
		'acci_id',
		'case_id',
		'idotcolno',
		'Crash Date',
		'Crash Dttm',
		'CrashDttmText',
		'addtime',
		'Location',
		'StreetNum',
		'StreetName',
		'Intersection',
		'AtIntersection',
		'IntersectionRelated',
		'TotalUnits',
		'NumMotorVehicles',
		'DooringPedalcyclist',
		'DamageCode',
		'PrivateProperty',
		'Hit&Run',
		'trafcontrl',
		'DeviceCond',
		'weather',
		'lightcond',
		'1stCrashType',
		'TrafficWay',
		'rdsurface',
		'FlowCond',
		'rddefects',
		'1stContribCause',
		'2ndContribCause',
		'K Fatalities',
		'A Incapacitated',
		'B NonIncap',
		'C ReportNotEvident',
		'0 NoVisibleInjury',
		'CrashInjurySeverity',
		'CrashSeverity',
		'A NoInjury/DriveAway',
		'B Injury/Towed',
		'Beat/Zone',
		'Post/District',
		'geox',
		'geoy',
	],
	DimCrashType: ['Crash Code', 'Crash Type', 'Crash Mode'],
	DimContribFactor1: ['Contributing Factor Code1', 'Contributing Factor1'],
	DimGISLatLon: [
		'SourceID',
		'LocationDesc',
		'GeoX',
		'GeoY',
		'X_DD',
		'Y_DD',
		'X_GEOCODED',
		'Y_GEOCODED',
		'VOPGeoX',
		'VOPGeoY',
		'GeoXY_RMS_Coded',
		'SubmitDttm',
		'RequestID',
	],
}

const FILE_NAMES: Record<string, string> = {
	FactAccidents: 'village/fact_accidents.json',
	DimCrashType: 'village/dim_crash_type.json',
	DimContribFactor1: 'village/dim_contrib_factor.json',
	DimGISLatLon: 'village/dim_gis_latlon.json',
}

async function fetchTable(info: ModelInfo, entity: string, columns: string[]) {
	const refs: ColumnRef[] = columns.map((property) => ({ entity, property }))
	const rows = (await queryRows(info, refs)) as Cell[][]
	writeRaw(FILE_NAMES[entity] ?? `village/${entity}.json`, {
		source: 'Village of Oak Park — Traffic Crash Dashboard (Power BI)',
		url: PUBLIC_REPORT_URL,
		fetchedAt: new Date().toISOString(),
		sourceUpdatedAt: info.lastRefresh,
		query: `SELECT ${columns.map((c) => `[${c}]`).join(', ')} FROM [${entity}] (model ${info.modelId})`,
		columns,
		rows,
	})
	return rows.length
}

// The dashboard's own published totals (its "Total Accidents" measure by
// calendar year and severity). The build step re-derives these from the raw
// rows and fails if they disagree — an end-to-end check that we pulled
// every crash the Village counts.
async function fetchCheckTotals(info: ModelInfo) {
	const refs: ColumnRef[] = [
		{ entity: 'DIM Calendar', property: 'Year' },
		{ entity: 'FactAccidents', property: 'CrashSeverity' },
		{ entity: 'Key Measures', property: 'Total Accidents', measure: true },
		{ entity: 'Key Measures', property: 'Total Injured', measure: true },
		{ entity: 'Key Measures', property: 'Total Fatals', measure: true },
	]
	const rows = (await queryRows(info, refs)) as Cell[][]
	writeRaw('village/check_totals.json', {
		source:
			'Village of Oak Park — Traffic Crash Dashboard (Power BI), published measures',
		url: PUBLIC_REPORT_URL,
		fetchedAt: new Date().toISOString(),
		sourceUpdatedAt: info.lastRefresh,
		query:
			'SELECT [DIM Calendar].[Year], [FactAccidents].[CrashSeverity], [Total Accidents], [Total Injured], [Total Fatals]',
		columns: [
			'Year',
			'CrashSeverity',
			'Total Accidents',
			'Total Injured',
			'Total Fatals',
		],
		rows,
	})
	return rows.length
}

export async function fetchVillage(): Promise<Record<string, number>> {
	const info = await getModelInfo()
	const counts: Record<string, number> = {}
	for (const [entity, columns] of Object.entries(TABLES)) {
		counts[entity] = await fetchTable(info, entity, columns)
		console.log(`village ${entity}: ${counts[entity]} rows`)
	}
	counts.checkTotals = await fetchCheckTotals(info)
	console.log(`village check totals: ${counts.checkTotals} rows`)
	// Fail loudly on implausible pulls rather than publishing a null-flood.
	if ((counts.FactAccidents ?? 0) < 4000) {
		throw new Error(
			`FactAccidents returned ${counts.FactAccidents} rows; expected ≥4000 (2024→present)`,
		)
	}
	return counts
}

if (isMain(import.meta.url)) await fetchVillage()
