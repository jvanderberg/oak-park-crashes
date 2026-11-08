// Decode the build step's compact tables into typed records once, at load.

import type {
	CompactTable,
	Crash,
	IdotCrash,
	Mode,
	Severity,
	VillageCrash,
} from './types'

type Cell = string | number | null

function reader(table: CompactTable) {
	const idx = new Map(table.fields.map((f, i) => [f, i]))
	const get = (row: Cell[], field: string): Cell => {
		const i = idx.get(field)
		if (i === undefined) throw new Error(`data: missing field "${field}"`)
		const v = row[i] ?? null
		const dict = table.dicts[field]
		if (dict && typeof v === 'number') return dict[v] ?? null
		return v
	}
	return {
		str: (row: Cell[], f: string) => {
			const v = get(row, f)
			return v === null ? null : String(v)
		},
		num: (row: Cell[], f: string) => {
			const v = get(row, f)
			return typeof v === 'number' ? v : v === null ? null : Number(v)
		},
	}
}

const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

function isLeap(y: number): boolean {
	return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/** 1-based day of year for an ISO date string, leap-aware. */
export function dayOfYear(date: string): number {
	const y = Number(date.slice(0, 4))
	const m = Number(date.slice(5, 7)) - 1
	const d = Number(date.slice(8, 10))
	return (MONTH_START[m] ?? 0) + d + (m > 1 && isLeap(y) ? 1 : 0)
}

function base(r: ReturnType<typeof reader>, row: Cell[]): Crash {
	const date = r.str(row, 'date') ?? '1970-01-01'
	return {
		id: r.str(row, 'id') ?? '',
		date,
		year: Number(date.slice(0, 4)),
		month: Number(date.slice(5, 7)) - 1,
		doy: dayOfYear(date),
		hour: r.num(row, 'hour'),
		sev: (r.str(row, 'sev') ?? 'U') as Severity,
		mode: (r.str(row, 'mode') ?? 'veh') as Mode,
		type: r.str(row, 'type') ?? '',
		k: r.num(row, 'k') ?? 0,
		a: r.num(row, 'a') ?? 0,
		b: r.num(row, 'b') ?? 0,
		c: r.num(row, 'c') ?? 0,
		hitRun: r.num(row, 'hitRun') === 1,
		cause1: r.str(row, 'cause1'),
		cause2: r.str(row, 'cause2'),
		light: r.str(row, 'light'),
		weather: r.str(row, 'weather'),
		surface: r.str(row, 'surface'),
		control: r.str(row, 'control'),
		lat: r.num(row, 'lat'),
		lon: r.num(row, 'lon'),
	}
}

export function decodeVillage(table: CompactTable): VillageCrash[] {
	const r = reader(table)
	return table.rows.map((row) => ({
		...base(r, row),
		location: r.str(row, 'location') ?? '',
		street: r.str(row, 'street') ?? '',
		cross: r.str(row, 'cross'),
	}))
}

export function decodeIdot(table: CompactTable): IdotCrash[] {
	const r = reader(table)
	return table.rows.map((row) => ({
		...base(r, row),
		agency: r.str(row, 'agency'),
		interstate: r.num(row, 'interstate') === 1,
	}))
}
