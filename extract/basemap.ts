// Turn the raw OpenStreetMap snapshot into the compact static basemap the
// app draws with Leaflet vector layers (no tile server, no API key).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OSM_RAW } from './fetch-osm.ts'
import { RAW_DIR } from './raw.ts'

type LonLat = [number, number]

interface OsmWay {
	type: 'way'
	id: number
	tags?: Record<string, string>
	geometry?: Array<{ lat: number; lon: number }>
}
interface OsmRelation {
	type: 'relation'
	id: number
	tags?: Record<string, string>
	members: Array<{
		type: string
		role: string
		geometry?: Array<{ lat: number; lon: number }>
	}>
}
type OsmElement = OsmWay | OsmRelation

/** Street classes, drawn widest → narrowest. */
export type StreetClass = 'highway' | 'major' | 'minor' | 'local'

export interface Basemap {
	attribution: string
	osmBase: string | null
	fetchedAt: string
	/** Each line is [lon, lat] pairs, coordinates rounded to 1e-5°. */
	streets: Record<StreetClass, LonLat[][]>
	rail: LonLat[][]
	parks: LonLat[][]
	boundary: LonLat[][]
	labels: Array<{
		name: string
		lat: number
		lon: number
		/** Text rotation in degrees, -90…90, so it reads along the street. */
		angle: number
		/** 1 = always shown; 2 = shown once zoomed in. */
		tier: 1 | 2
	}>
}

const CLASS: Record<string, StreetClass> = {
	motorway: 'highway',
	motorway_link: 'highway',
	trunk: 'highway',
	trunk_link: 'highway',
	primary: 'major',
	primary_link: 'major',
	secondary: 'major',
	secondary_link: 'major',
	tertiary: 'minor',
	tertiary_link: 'minor',
	residential: 'local',
	unclassified: 'local',
	living_street: 'local',
	pedestrian: 'local',
}

const round = (v: number) => Math.round(v * 1e5) / 1e5

// Labels only for segments inside the Village (the fetch has a margin).
const inVillage = (lat: number, lon: number) =>
	lat >= 41.865 && lat <= 41.909 && lon >= -87.806 && lon <= -87.774

/** Douglas–Peucker in degree space (Oak Park is small enough that the
 *  lat/lon distortion is irrelevant at a ~2 m tolerance). */
export function simplify(points: LonLat[], tol = 0.00002): LonLat[] {
	if (points.length <= 2) return points
	const keep = new Uint8Array(points.length)
	keep[0] = 1
	keep[points.length - 1] = 1
	const stack: Array<[number, number]> = [[0, points.length - 1]]
	while (stack.length) {
		const [a, b] = stack.pop() as [number, number]
		const [ax, ay] = points[a] as LonLat
		const [bx, by] = points[b] as LonLat
		const dx = bx - ax
		const dy = by - ay
		const len2 = dx * dx + dy * dy
		let maxD = 0
		let idx = -1
		for (let i = a + 1; i < b; i++) {
			const [px, py] = points[i] as LonLat
			let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
			t = Math.max(0, Math.min(1, t))
			const ex = ax + t * dx - px
			const ey = ay + t * dy - py
			const d = ex * ex + ey * ey
			if (d > maxD) {
				maxD = d
				idx = i
			}
		}
		if (idx >= 0 && maxD > tol * tol) {
			keep[idx] = 1
			stack.push([a, idx], [idx, b])
		}
	}
	return points.filter((_, i) => keep[i])
}

function line(geom: Array<{ lat: number; lon: number }> | undefined): LonLat[] {
	return simplify(
		(geom ?? []).map((g) => [round(g.lon), round(g.lat)] as LonLat),
	)
}

function lengthOf(pts: LonLat[]): number {
	let s = 0
	for (let i = 1; i < pts.length; i++) {
		const [x0, y0] = pts[i - 1] as LonLat
		const [x1, y1] = pts[i] as LonLat
		// Scale longitude by cos(lat) so N–S and E–W lengths compare fairly.
		s += Math.hypot((x1 - x0) * Math.cos((y0 * Math.PI) / 180), y1 - y0)
	}
	return s
}

/** Point halfway along a line, plus the local direction there. */
function midpoint(pts: LonLat[]): { lon: number; lat: number; angle: number } {
	const half = lengthOf(pts) / 2
	let run = 0
	for (let i = 1; i < pts.length; i++) {
		const a = pts[i - 1] as LonLat
		const b = pts[i] as LonLat
		const seg = lengthOf([a, b])
		if (run + seg >= half || i === pts.length - 1) {
			const t = seg ? (half - run) / seg : 0
			const k = Math.cos((a[1] * Math.PI) / 180)
			let angle = (-Math.atan2(b[1] - a[1], (b[0] - a[0]) * k) * 180) / Math.PI
			if (angle > 90) angle -= 180
			if (angle < -90) angle += 180
			// Near-vertical streets read bottom-to-top, the usual convention.
			if (angle >= 85) angle -= 180
			return {
				lon: round(a[0] + t * (b[0] - a[0])),
				lat: round(a[1] + t * (b[1] - a[1])),
				angle: Math.round(angle),
			}
		}
		run += seg
	}
	const [lon, lat] = pts[0] as LonLat
	return { lon, lat, angle: 0 }
}

/** "North Harlem Avenue" → "Harlem Ave" for compact labels. */
export function shortStreetName(name: string): string {
	// "North Harlem Avenue" drops its directional, but "North Boulevard" is
	// the street's actual name and keeps it.
	const stripped = name.replace(/^(North|South|East|West)\s+/i, '')
	const base = stripped.split(/\s+/).length >= 2 ? stripped : name
	return base
		.replace(/\bAvenue\b/g, 'Ave')
		.replace(/\bStreet\b/g, 'St')
		.replace(/\bBoulevard\b/g, 'Blvd')
		.replace(/\bRoad\b/g, 'Rd')
		.replace(/\bDrive\b/g, 'Dr')
		.replace(/\bParkway\b/g, 'Pkwy')
		.replace(/\bCourt\b/g, 'Ct')
		.replace(/\bPlace\b/g, 'Pl')
		.trim()
}

export function buildBasemap(): Basemap {
	const raw = JSON.parse(readFileSync(join(RAW_DIR, OSM_RAW), 'utf8')) as {
		fetchedAt: string
		osmBase: string | null
		elements: OsmElement[]
	}
	const streets: Basemap['streets'] = {
		highway: [],
		major: [],
		minor: [],
		local: [],
	}
	const rail: LonLat[][] = []
	const parks: LonLat[][] = []
	const boundary: LonLat[][] = []
	// Longest segment per street name, for one label per street.
	const best = new Map<string, { pts: LonLat[]; len: number; tier: 1 | 2 }>()

	for (const el of raw.elements) {
		if (el.type === 'relation') {
			for (const m of el.members) {
				if (m.type === 'way' && m.geometry) boundary.push(line(m.geometry))
			}
			continue
		}
		const tags = el.tags ?? {}
		const pts = line(el.geometry)
		if (pts.length < 2) continue
		if (tags.leisure === 'park') {
			parks.push(pts)
		} else if (tags.railway) {
			rail.push(pts)
		} else if (tags.highway) {
			const cls = CLASS[tags.highway]
			if (!cls) continue
			streets[cls].push(pts)
			const name = tags.name ? shortStreetName(tags.name) : ''
			const mid = midpoint(pts)
			if (
				name &&
				(cls === 'major' || cls === 'minor') &&
				!tags.highway.endsWith('_link') &&
				inVillage(mid.lat, mid.lon)
			) {
				const len = lengthOf(pts)
				const tier = cls === 'major' ? 1 : 2
				const prev = best.get(name)
				if (!prev || len > prev.len) best.set(name, { pts, len, tier })
			}
		}
	}
	if (streets.local.length < 300 || streets.major.length < 50) {
		throw new Error(
			`basemap: implausible street counts (${streets.major.length} major, ${streets.local.length} local)`,
		)
	}
	if (boundary.length === 0)
		throw new Error('basemap: Village boundary missing')
	const labels = [...best.entries()]
		.map(([name, b]) => ({ name, ...midpoint(b.pts), tier: b.tier }))
		.sort((a, b) => a.name.localeCompare(b.name))
	return {
		attribution:
			'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		osmBase: raw.osmBase,
		fetchedAt: raw.fetchedAt,
		streets,
		rail,
		parks,
		boundary,
		labels,
	}
}
