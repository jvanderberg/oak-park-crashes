import {
	byMode,
	calendarDoy,
	compare,
	cumulativeByDay,
	inPeriod,
	locationKey,
	modeShares,
	monthlySeries,
	periodFor,
	rank,
	total,
} from '@/lib/crashes'
import { dayOfYear } from '@/lib/data'
import type { Mode, Severity, VillageCrash } from '@/lib/types'
import { describe, expect, it } from 'vitest'

let n = 0
function crash(
	date: string,
	sev: Severity,
	mode: Mode = 'veh',
	extra: Partial<VillageCrash> = {},
): VillageCrash {
	const hurt = {
		K: [1, 0, 0, 0],
		A: [0, 1, 0, 0],
		B: [0, 0, 1, 0],
		C: [0, 0, 0, 1],
	}
	const [k, a, b, c] = (hurt as Record<string, number[]>)[sev] ?? [0, 0, 0, 0]
	return {
		id: String(++n),
		date,
		year: Number(date.slice(0, 4)),
		month: Number(date.slice(5, 7)) - 1,
		doy: dayOfYear(date),
		hour: 12,
		sev,
		mode,
		type: 'Angle',
		k: k ?? 0,
		a: a ?? 0,
		b: b ?? 0,
		c: c ?? 0,
		hitRun: false,
		cause1: null,
		cause2: null,
		light: null,
		weather: null,
		surface: null,
		control: null,
		lat: 41.88,
		lon: -87.79,
		location: 'X',
		street: 'Madison St',
		cross: null,
		...extra,
	}
}

describe('measures', () => {
	const cs = [
		crash('2025-01-01', 'O'),
		crash('2025-01-02', 'C'),
		crash('2025-01-03', 'A'),
		crash('2025-01-04', 'K', 'ped', { b: 2 }),
	]
	it('counts crashes, injury crashes, KSI and people hurt', () => {
		expect(total(cs, 'crashes')).toBe(4)
		expect(total(cs, 'injury')).toBe(3)
		expect(total(cs, 'ksi')).toBe(2)
		// C=1, A=1, K crash with one fatality + two B injuries = 3
		expect(total(cs, 'people')).toBe(5)
	})
})

describe('who filter', () => {
	it('"Ped + bike" keeps pedestrian and bicycle crashes together', () => {
		const cs = [
			crash('2026-01-01', 'B', 'veh'),
			crash('2026-01-02', 'B', 'ped'),
			crash('2026-01-03', 'B', 'bike'),
		]
		expect(byMode(cs, 'pedbike').map((c) => c.mode)).toEqual(['ped', 'bike'])
		expect(byMode(cs, 'ped').map((c) => c.mode)).toEqual(['ped'])
		expect(byMode(cs, 'all')).toHaveLength(3)
	})
})

describe('periods', () => {
	it('whole years before the latest year', () => {
		expect(periodFor(2024, '2026-10-31')).toEqual({
			year: 2024,
			throughDoy: 366,
			partial: false,
		})
	})
	it('cuts the latest year at the last data date', () => {
		const p = periodFor(2026, '2026-10-31')
		expect(p.partial).toBe(true)
		expect(p.throughDoy).toBe(calendarDoy(9, 31))
	})
	it('treats Dec 31 as a complete year', () => {
		expect(periodFor(2026, '2026-12-31').partial).toBe(false)
	})
	it('compares the same calendar dates across a leap year', () => {
		// Mar 1 is day 61 in 2024 but day 60 in 2025 — the cut must be by
		// calendar date, not day number.
		const cs = [
			crash('2024-03-01', 'C'),
			crash('2024-03-02', 'C'),
			crash('2025-03-01', 'C'),
		]
		const p = periodFor(2025, '2025-03-01')
		const cmp = compare(cs, p, 'injury', 2024)
		expect(cmp.current).toBe(1)
		expect(cmp.previous).toBe(1)
		expect(cmp.change).toBe(0)
	})
	it('has no comparison for the first year of data', () => {
		const cmp = compare(
			[crash('2024-05-01', 'C')],
			periodFor(2024, '2026-10-31'),
			'injury',
			2024,
		)
		expect(cmp.previous).toBeNull()
		expect(cmp.change).toBeNull()
	})
	it('inPeriod keeps only the selected year up to the cut', () => {
		const cs = [
			crash('2026-10-31', 'O'),
			crash('2026-11-01', 'O'),
			crash('2025-10-01', 'O'),
		]
		expect(inPeriod(cs, periodFor(2026, '2026-10-31'))).toHaveLength(1)
	})
})

describe('modeShares', () => {
	it('splits a measure by mode and computes injury rates', () => {
		const cs = [
			crash('2025-01-01', 'O'),
			crash('2025-01-01', 'O'),
			crash('2025-01-01', 'O'),
			crash('2025-01-01', 'C'),
			crash('2025-01-01', 'B', 'ped'),
		]
		const s = modeShares(cs, 'injury')
		const veh = s.find((x) => x.mode === 'veh')
		const ped = s.find((x) => x.mode === 'ped')
		expect(veh?.value).toBe(1)
		expect(veh?.share).toBe(0.5)
		expect(veh?.injuryRate).toBe(0.25)
		expect(ped?.injuryRate).toBe(1)
		expect(s.reduce((a, b) => a + b.share, 0)).toBeCloseTo(1)
	})
})

describe('series', () => {
	it('monthly series fills every month, including empty ones', () => {
		const s = monthlySeries(
			[crash('2024-01-05', 'C'), crash('2024-03-05', 'C', 'bike')],
			'injury',
			'2024-01-01',
			'2024-03-31',
		)
		expect(s.months).toEqual(['2024-01', '2024-02', '2024-03'])
		expect(s.values.veh).toEqual([1, 0, 0])
		expect(s.values.bike).toEqual([0, 0, 1])
	})
	it('cumulative totals run by calendar day', () => {
		const c = cumulativeByDay(
			[crash('2025-01-01', 'C'), crash('2025-01-03', 'C')],
			2025,
			'injury',
			4,
		)
		expect(c).toEqual([1, 1, 2, 2])
	})
})

describe('rankings', () => {
	it('treats A/B and B/A as the same intersection', () => {
		const a = crash('2025-01-01', 'C', 'veh', {
			street: 'Harlem Ave',
			cross: 'Lake St',
		})
		const b = crash('2025-01-01', 'C', 'veh', {
			street: 'Lake St',
			cross: 'Harlem Ave',
		})
		expect(locationKey(a)).toBe(locationKey(b))
		const r = rank([a, b], locationKey, 'injury')
		expect(r).toHaveLength(1)
		expect(r[0]?.value).toBe(2)
	})
	it('breakdown columns count only the crashes being ranked', () => {
		const at = { street: 'Lake St', cross: null }
		const r = rank(
			[
				crash('2025-01-01', 'B', 'ped', at),
				crash('2025-01-02', 'O', 'ped', at), // no injury: not ranked
				crash('2025-01-03', 'A', 'bike', at),
			],
			locationKey,
			'injury',
		)
		expect(r[0]).toMatchObject({ value: 2, ped: 1, bike: 1, ksi: 1 })
	})
})
