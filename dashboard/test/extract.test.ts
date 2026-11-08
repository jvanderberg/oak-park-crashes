import { describe, expect, it } from 'vitest'
// Tripwires on the extract step's pure helpers.
import { normalizeStreet, parseVillageTime } from '../../extract/build.ts'
import { codeKey, decode, deriveCodebook } from '../../extract/codebook.ts'
import { decodeDataSet } from '../../extract/powerbi.ts'

describe('Power BI DSR decoding', () => {
	it('expands repeat and null bitmasks and dictionary values', () => {
		const rows = decodeDataSet({
			PH: [
				{
					DM0: [
						{
							S: [
								{ N: 'G0', T: 1, DN: 'D0' },
								{ N: 'G1', T: 4 },
								{ N: 'G2', T: 1 },
							],
							C: [0, 10, 'x'],
						},
						// G0 repeated (bit 0), G2 null (bit 2)
						{ R: 1, Ø: 4, C: [11] },
						{ C: [1, 12, 'y'] },
					],
				},
			],
			ValueDicts: { D0: ['Injury', 'Fatal'] },
		})
		expect(rows).toEqual([
			['Injury', 10, 'x'],
			['Injury', 11, null],
			['Fatal', 12, 'y'],
		])
	})
	it('reads values stored under their schema name', () => {
		const rows = decodeDataSet({
			PH: [{ DM0: [{ S: [{ N: 'G0', T: 1 }], G0: 'Injury' }] }],
		})
		expect(rows).toEqual([['Injury']])
	})
	it('fails loudly when a row has leftover values', () => {
		expect(() =>
			decodeDataSet({ PH: [{ DM0: [{ S: [{ N: 'G0', T: 1 }], C: [1, 2] }] }] }),
		).toThrow(/schema drift/)
	})
})

describe('codebook derivation', () => {
	it('keeps the longest label of a truncation chain and drops outliers', () => {
		const rows = [
			...Array(20).fill({ c: 10, l: 'Freezing Rain' }),
			...Array(20).fill({ c: '10', l: 'Freezing Rain or' }),
			...Array(5).fill({ c: 10, l: 'Freezing Rain or Freezing Drizzle' }),
			{ c: 10, l: 'No Injuries' }, // a misaligned row
		]
		const { book, report } = deriveCodebook(rows, 'c', 'l', 'weather')
		expect(book['10']).toBe('Freezing Rain or Freezing Drizzle')
		expect(report.ambiguous).toHaveLength(0)
	})
	it('normalizes codes and flags unknown ones visibly', () => {
		expect(codeKey(' 02 ')).toBe('2')
		expect(decode({ '2': 'Rain' }, '02')).toBe('Rain')
		expect(decode({ '2': 'Rain' }, 7)).toBe('Code 7 (undocumented)')
	})
})

describe('village normalization', () => {
	it('parses 12-hour crash times', () => {
		expect(parseVillageTime('01/24/2024 12:15 AM')).toEqual({
			date: '2024-01-24',
			hour: 0,
		})
		expect(parseVillageTime('01/24/2024 12:15 PM')).toEqual({
			date: '2024-01-24',
			hour: 12,
		})
		expect(parseVillageTime('11/03/2025 07:49 PM')).toEqual({
			date: '2025-11-03',
			hour: 19,
		})
	})
	it('drops directionals so a corridor aggregates', () => {
		expect(normalizeStreet('N HARLEM AVE')).toBe('Harlem Ave')
		expect(normalizeStreet('S Harlem Ave')).toBe('Harlem Ave')
		expect(normalizeStreet('I290 W')).toBe('I-290 W')
	})
})
