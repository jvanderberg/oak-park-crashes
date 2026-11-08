import {
	type CrashFilters,
	DEFAULT_FILTERS,
	describeFilters,
	hourBucket,
	passesFilters,
	tally,
	weekday,
} from '@/lib/filters'
import type { VillageCrash } from '@/lib/types'
import { describe, expect, it } from 'vitest'

function crash(over: Partial<VillageCrash> = {}): VillageCrash {
	return {
		id: '1',
		date: '2026-11-04', // a Wednesday
		year: 2026,
		doy: 308,
		month: 10,
		hour: 17,
		sev: 'B',
		mode: 'veh',
		type: 'Angle',
		k: 0,
		a: 0,
		b: 1,
		c: 0,
		hitRun: false,
		cause1: 'Following Too Closely',
		cause2: null,
		light: null,
		weather: null,
		surface: null,
		control: null,
		lat: 41.88,
		lon: -87.79,
		location: 'Madison St & Oak Park Ave',
		street: 'Madison St',
		cross: 'Oak Park Ave',
		...over,
	}
}
const f = (over: Partial<CrashFilters>): CrashFilters => ({
	...DEFAULT_FILTERS,
	...over,
})

describe('map filters', () => {
	it('buckets hours at the stated boundaries', () => {
		expect([5, 6, 9, 10, 15, 16, 19, 20, 23, 0].map(hourBucket)).toEqual([
			'night',
			'morning',
			'morning',
			'midday',
			'midday',
			'evening',
			'evening',
			'night',
			'night',
			'night',
		])
		expect(hourBucket(null)).toBeNull()
	})
	it('reads the weekday from the date string, not the local clock', () => {
		expect(weekday('2026-11-04')).toBe(3)
		expect(weekday('2026-11-08')).toBe(0)
	})
	it('passes everything by default', () => {
		expect(passesFilters(crash(), DEFAULT_FILTERS)).toBe(true)
	})
	it('filters by time, days, street (either leg), cause and hit-and-run', () => {
		const c = crash()
		expect(passesFilters(c, f({ time: 'evening' }))).toBe(true)
		expect(passesFilters(c, f({ time: 'morning' }))).toBe(false)
		expect(passesFilters(crash({ hour: null }), f({ time: 'night' }))).toBe(
			false,
		)
		expect(passesFilters(c, f({ days: 'weekday' }))).toBe(true)
		expect(passesFilters(c, f({ days: 'weekend' }))).toBe(false)
		expect(passesFilters(c, f({ street: 'Oak Park Ave' }))).toBe(true)
		expect(passesFilters(c, f({ street: 'Lake St' }))).toBe(false)
		expect(passesFilters(c, f({ cause: 'Following Too Closely' }))).toBe(true)
		expect(passesFilters(c, f({ hitRun: true }))).toBe(false)
		expect(passesFilters(crash({ hitRun: true }), f({ hitRun: true }))).toBe(
			true,
		)
	})
	it('filters IDOT crashes (no street names) on everything but street', () => {
		const { location, street, cross, ...idotLike } = crash({ hour: 21 })
		expect(location && street && cross).toBeTruthy()
		const f2 = f({ time: 'night', street: 'Madison St' })
		expect(passesFilters(idotLike, f2)).toBe(false)
		expect(passesFilters(idotLike, f2, 'street')).toBe(true)
		expect(passesFilters(idotLike, f({ time: 'morning' }), 'street')).toBe(
			false,
		)
	})
	it('describes active filters in plain words', () => {
		expect(describeFilters(DEFAULT_FILTERS)).toEqual([])
		expect(describeFilters(f({ street: 'Lake St', hitRun: true }))).toEqual([
			{ key: 'street', label: 'On Lake St' },
			{ key: 'hitRun', label: 'Hit and run' },
		])
	})
	it('tallies most common first, ignoring blanks', () => {
		expect(tally(['b', 'a', null, 'b', 'c', 'a', 'b'])).toEqual([
			['b', 3],
			['a', 2],
			['c', 1],
		])
	})
})
