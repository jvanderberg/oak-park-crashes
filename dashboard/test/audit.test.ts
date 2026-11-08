// End-to-end audit of the shipped app data: decode exactly what the browser
// loads and confirm it reproduces the Village dashboard's published totals
// recorded in the manifest.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeIdot, decodeVillage } from '@/lib/data'
import type { CompactTable, Manifest } from '@/lib/types'
import { describe, expect, it } from 'vitest'

const dir = join(__dirname, '..', 'public', 'data')
const read = <T>(f: string) =>
	JSON.parse(readFileSync(join(dir, f), 'utf8')) as T
const manifest = read<Manifest>('manifest.json')
const village = decodeVillage(read<CompactTable>('village.json'))
const idot = decodeIdot(read<CompactTable>('idot.json'))

const GROUP = {
	K: 'Fatal',
	A: 'Injury',
	B: 'Injury',
	C: 'Injury',
	O: 'Property Damage',
	U: 'Unknown',
} as const

describe('shipped data', () => {
	it('matches every published Village total', () => {
		expect(manifest.checks.length).toBeGreaterThan(0)
		for (const c of manifest.checks) {
			const n = village.filter(
				(v) => v.year === c.year && GROUP[v.sev] === c.severity,
			).length
			expect(n, `${c.year} ${c.severity}`).toBe(c.published)
		}
	})
	it('has one row per Village crash and per IDOT crash', () => {
		expect(village).toHaveLength(manifest.sources.village.rows)
		const idotRows = manifest.sources.idot.years.reduce((s, y) => s + y.rows, 0)
		expect(idot).toHaveLength(idotRows)
	})
	it('places nearly every crash on the map', () => {
		expect(
			village.filter((v) => v.lat !== null).length / village.length,
		).toBeGreaterThan(0.95)
		expect(
			idot.filter((v) => v.lat !== null).length / idot.length,
		).toBeGreaterThan(0.95)
	})
	it('keeps people-hurt counts consistent with severity', () => {
		for (const v of village) {
			if (v.sev === 'K') expect(v.k, v.id).toBeGreaterThan(0)
			if (v.sev === 'O') expect(v.k + v.a + v.b + v.c, v.id).toBe(0)
		}
	})
})
