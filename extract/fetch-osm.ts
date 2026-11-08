// Fetch the basemap geometry — streets, rail, parks and the Village
// boundary — from OpenStreetMap via the public Overpass API (no key, no
// account; data © OpenStreetMap contributors, ODbL). Baked into a static
// file at build time so the deployed map needs no tile server at all.
//
// Streets change rarely, so the snapshot is only re-fetched when missing or
// with `--all`.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { RAW_DIR, isMain } from './raw.ts'

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
// Public, key-free Overpass instances, tried in order when one is busy.
const OVERPASS_ENDPOINTS = [
	OVERPASS_URL,
	'https://overpass.private.coffee/api/interpreter',
]
export const OSM_RAW = 'osm/oak_park.json'

// Oak Park's bounding box plus a few blocks of margin.
const BBOX = '41.858,-87.818,41.917,-87.765'

export const OVERPASS_QUERY = `[out:json][timeout:90];
(
  way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|living_street|pedestrian)$"](${BBOX});
  way["railway"~"^(rail|subway|light_rail)$"](${BBOX});
  way["leisure"="park"](${BBOX});
  relation["boundary"="administrative"]["admin_level"="8"]["name"="Oak Park"](${BBOX});
);
out geom;`

interface OverpassResponse {
	osm3s?: { timestamp_osm_base?: string }
	elements: unknown[]
}

/** POST the query, retrying busy servers (HTTP 429/502/503/504) with
 * backoff and falling back to a mirror. */
async function queryOverpass(): Promise<
	OverpassResponse & { endpoint: string }
> {
	let last = ''
	for (let attempt = 0; attempt < 6; attempt++) {
		const endpoint = OVERPASS_ENDPOINTS[
			attempt % OVERPASS_ENDPOINTS.length
		] as string
		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'User-Agent':
						'oak-park-crashes-extract (github.com/jvanderberg/oak-park-crashes)',
				},
				body: new URLSearchParams({ data: OVERPASS_QUERY }),
			})
			if (res.ok) {
				return { ...((await res.json()) as OverpassResponse), endpoint }
			}
			last = `${endpoint}: HTTP ${res.status}`
			if (![429, 502, 503, 504].includes(res.status)) break
		} catch (err) {
			last = `${endpoint}: ${(err as Error).message}`
		}
		console.log(`overpass busy (${last}); retrying`)
		await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt))
	}
	throw new Error(`Overpass failed: ${last}`)
}

export async function fetchOsm(force = false): Promise<number | null> {
	const path = join(RAW_DIR, OSM_RAW)
	if (!force && existsSync(path)) return null
	const body = await queryOverpass()
	if (!Array.isArray(body.elements) || body.elements.length < 500) {
		throw new Error(
			`Overpass returned ${body.elements?.length ?? 0} elements; expected ≥500`,
		)
	}
	mkdirSync(dirname(path), { recursive: true })
	writeFileSync(
		path,
		`${JSON.stringify({
			source: 'OpenStreetMap via Overpass API',
			url: body.endpoint,
			license: 'ODbL — © OpenStreetMap contributors',
			fetchedAt: new Date().toISOString(),
			osmBase: body.osm3s?.timestamp_osm_base ?? null,
			query: OVERPASS_QUERY,
			elements: body.elements,
		})}\n`,
	)
	console.log(`osm: ${body.elements.length} elements`)
	return body.elements.length
}

if (isMain(import.meta.url)) await fetchOsm(process.argv.includes('--all'))
