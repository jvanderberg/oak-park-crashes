// Minimal client for a Power BI "publish to web" report's public query API.
//
// The Village of Oak Park publishes its traffic-crash dashboard as a public
// Power BI report (opendata.oak-park.us/TrafficCrash). Public reports answer
// semantic queries anonymously at /public/reports/querydata, keyed only by the
// report's resource key — the same requests the browser makes when anyone
// opens the dashboard. We ask for the underlying table rows directly instead
// of the dashboard's pre-aggregated visuals.

export const RESOURCE_KEY = '0edb9dc9-058e-401b-8cb8-fac7bef23c02'
export const API_ROOT =
	'https://wabi-us-gov-virginia-api.analysis.usgovcloudapi.net/public/reports'
export const PUBLIC_REPORT_URL =
	'https://app.powerbigov.us/view?r=eyJrIjoiMGVkYjlkYzktMDU4ZS00MDFiLThjYjgtZmFjN2JlZjIzYzAyIiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9'

const HEADERS = {
	'Content-Type': 'application/json;charset=UTF-8',
	Accept: 'application/json',
	'X-PowerBI-ResourceKey': RESOURCE_KEY,
	'User-Agent':
		'oak-park-crashes-extract (github.com/jvanderberg/oak-park-crashes)',
}

export interface ModelInfo {
	modelId: number
	datasetId: string
	reportId: string
	lastRefresh: string | null
}

interface ModelsAndExploration {
	models: Array<{ id: number; dbName: string; lastRefreshTime?: string }>
	exploration: { report: { objectId: string; modelId: number } }
}

/** Discover the model/dataset/report ids behind the public resource key. */
export async function getModelInfo(): Promise<ModelInfo> {
	const res = await fetch(
		`${API_ROOT}/${RESOURCE_KEY}/modelsAndExploration?preferReadOnlySession=true`,
		{ headers: HEADERS },
	)
	if (!res.ok) throw new Error(`modelsAndExploration: HTTP ${res.status}`)
	const body = (await res.json()) as ModelsAndExploration
	const model = body.models[0]
	if (!model) throw new Error('modelsAndExploration: no models in response')
	// lastRefreshTime looks like "/Date(1794143223860)/"
	const ms = model.lastRefreshTime?.match(/\d+/)?.[0]
	return {
		modelId: model.id,
		datasetId: model.dbName,
		reportId: body.exploration.report.objectId,
		lastRefresh: ms ? new Date(Number(ms)).toISOString() : null,
	}
}

// ---- Query construction --------------------------------------------------

export interface ColumnRef {
	entity: string
	property: string
	/** A model measure (aggregate) rather than a plain column. */
	measure?: boolean
}

function buildQuery(
	info: ModelInfo,
	columns: ColumnRef[],
	windowCount: number,
	restartTokens: unknown[] | null,
) {
	const entities = [...new Set(columns.map((c) => c.entity))]
	const alias = new Map(entities.map((e, i) => [e, `t${i}`]))
	const select = columns.map((c) => {
		const ref = {
			Expression: { SourceRef: { Source: alias.get(c.entity) } },
			Property: c.property,
		}
		return {
			...(c.measure ? { Measure: ref } : { Column: ref }),
			Name: `${c.entity}.${c.property}`,
		}
	})
	const window: Record<string, unknown> = { Count: windowCount }
	if (restartTokens) window.RestartTokens = restartTokens
	return {
		version: '1.0.0',
		queries: [
			{
				Query: {
					Commands: [
						{
							SemanticQueryDataShapeCommand: {
								Query: {
									Version: 2,
									From: entities.map((e) => ({
										Name: alias.get(e),
										Entity: e,
										Type: 0,
									})),
									Select: select,
								},
								Binding: {
									Primary: {
										Groupings: [{ Projections: columns.map((_, i) => i) }],
									},
									DataReduction: {
										DataVolume: 4,
										Primary: { Window: window },
									},
									Version: 1,
								},
								ExecutionMetricsKind: 1,
							},
						},
					],
				},
				QueryId: '',
				ApplicationContext: {
					DatasetId: info.datasetId,
					Sources: [{ ReportId: info.reportId }],
				},
			},
		],
		cancelQueries: [],
		modelId: info.modelId,
	}
}

// ---- DSR (data shape result) decoding -----------------------------------
//
// Rows arrive compressed: each row's "C" array holds only the values that
// are neither repeated from the previous row (bit set in "R") nor null (bit
// set in "Ø"). Some rows instead carry a value under its schema name (e.g.
// {"G0": "Injury"}) rather than in "C". Dictionary-encoded columns ("DN" in
// the schema) carry integer indexes into ValueDicts. Bitmasks can exceed 32
// bits, so test with division rather than JS bitwise ops.

type Scalar = string | number | boolean | null
interface SchemaCol {
	N: string
	T: number
	DN?: string
}
interface DsrRow {
	S?: SchemaCol[]
	C?: Scalar[]
	R?: number
	Ø?: number
	// Rows may also carry values under their schema names (e.g. "G0").
	[key: string]: Scalar | Scalar[] | SchemaCol[] | undefined
}
interface DsrDataSet {
	PH: Array<{ DM0?: DsrRow[] }>
	IC?: boolean
	RT?: unknown[]
	ValueDicts?: Record<string, Scalar[]>
}
interface QueryResponse {
	results: Array<{
		result: {
			data: { dsr: { DS: DsrDataSet[] } }
		}
	}>
	error?: unknown
}

function bit(mask: number | undefined, i: number): boolean {
	if (!mask) return false
	return Math.floor(mask / 2 ** i) % 2 === 1
}

export function decodeDataSet(ds: DsrDataSet): Scalar[][] {
	const rows: Scalar[][] = []
	const dicts = ds.ValueDicts ?? {}
	let schema: SchemaCol[] = []
	let prev: Scalar[] = []
	for (const row of ds.PH[0]?.DM0 ?? []) {
		if (row.S) schema = row.S
		const out: Scalar[] = new Array(schema.length)
		const values = row.C ?? []
		let ci = 0
		for (let i = 0; i < schema.length; i++) {
			if (bit(row.R, i)) {
				out[i] = prev[i] ?? null
			} else if (bit(row.Ø, i)) {
				out[i] = null
			} else {
				const name = schema[i]?.N ?? ''
				const keyed = row[name]
				let v: Scalar =
					keyed !== undefined && !Array.isArray(keyed)
						? (keyed as Scalar)
						: (values[ci++] ?? null)
				const dn = schema[i]?.DN
				if (dn && typeof v === 'number') v = dicts[dn]?.[v] ?? null
				out[i] = v
			}
		}
		if (ci !== values.length) {
			throw new Error(
				`DSR decode: row consumed ${ci} of ${values.length} values — schema drift?`,
			)
		}
		rows.push(out)
		prev = out
	}
	return rows
}

/** Fetch every row of the given columns, following restart tokens. */
export async function queryRows(
	info: ModelInfo,
	columns: ColumnRef[],
	windowCount = 30000,
): Promise<Scalar[][]> {
	const all: Scalar[][] = []
	let restart: unknown[] | null = null
	for (let page = 0; page < 100; page++) {
		const body = buildQuery(info, columns, windowCount, restart)
		const res = await fetch(`${API_ROOT}/querydata?synchronous=true`, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify(body),
		})
		if (!res.ok) throw new Error(`querydata: HTTP ${res.status}`)
		const json = (await res.json()) as QueryResponse
		const ds = json.results?.[0]?.result?.data?.dsr?.DS?.[0]
		if (!ds) {
			throw new Error(
				`querydata: no dataset in response: ${JSON.stringify(json).slice(0, 500)}`,
			)
		}
		const rows = decodeDataSet(ds)
		// A restart page repeats the boundary row; drop it.
		all.push(...(restart ? rows.slice(1) : rows))
		if (ds.IC !== false || !ds.RT) return all
		restart = ds.RT
	}
	throw new Error('querydata: exceeded 100 pages')
}
