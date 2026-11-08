// Raw snapshot format shared by every fetcher: the upstream rows exactly as
// received (column-major header + row arrays to keep files compact), plus
// enough provenance to re-fetch and verify them.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const RAW_DIR = join(REPO_ROOT, 'data', 'raw')

export type Cell = string | number | boolean | null

export interface RawTable {
	source: string
	url: string
	fetchedAt: string
	/** Upstream "last refreshed" time when the source reports one. */
	sourceUpdatedAt: string | null
	query: string
	columns: string[]
	rows: Cell[][]
}

export function writeRaw(relPath: string, table: RawTable): void {
	const path = join(RAW_DIR, relPath)
	mkdirSync(dirname(path), { recursive: true })
	// One row per line: diffs between refreshes stay reviewable.
	const { rows, ...header } = table
	const body = [
		'{',
		...Object.entries(header).map(
			([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)},`,
		),
		'"rows": [',
		rows.map((r) => JSON.stringify(r)).join(',\n'),
		']',
		'}',
		'',
	].join('\n')
	writeFileSync(path, body)
}

export function readRaw(relPath: string): RawTable {
	return JSON.parse(readFileSync(join(RAW_DIR, relPath), 'utf8')) as RawTable
}

/** Index a raw table's rows by column name for readable access. */
export function rowsAsObjects(table: RawTable): Array<Record<string, Cell>> {
	return table.rows.map((r) =>
		Object.fromEntries(table.columns.map((c, i) => [c, r[i] ?? null])),
	)
}

/** True when the calling module is the script node was started with. */
export function isMain(moduleUrl: string): boolean {
	return process.argv[1] === fileURLToPath(moduleUrl)
}
