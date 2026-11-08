import {
	DEFAULT_URL_STATE,
	type UrlState,
	parseUrl,
	serializeUrl,
} from '@/lib/url'
import { describe, expect, it } from 'vitest'

describe('url state', () => {
	it('defaults for an empty query', () => {
		expect(parseUrl('')).toEqual(DEFAULT_URL_STATE)
	})
	it('ignores junk', () => {
		expect(
			parseUrl(
				'?year=abc&mode=car&measure=lots&i290=maybe&crash=<x>&theme=neon',
			),
		).toEqual(DEFAULT_URL_STATE)
	})
	it('serializes nothing for the default view', () => {
		expect(serializeUrl(DEFAULT_URL_STATE)).toBe('')
	})
	it('pins the theme only when it differs from the system theme', () => {
		const s: UrlState = { ...DEFAULT_URL_STATE, theme: 'dark' }
		expect(serializeUrl(s, 'dark')).toBe('')
		expect(serializeUrl(s, 'light')).toContain('theme=dark')
	})
	it('round-trips every field', () => {
		const s: UrlState = {
			year: 2025,
			mode: 'ped',
			measure: 'ksi',
			interstate: 'incl',
			crash: '31337',
			theme: 'dark',
			mapFull: true,
			filters: {
				time: 'evening',
				days: 'weekend',
				street: 'Madison St',
				cause: 'Failing To Yield Right-Of-Way',
				hitRun: true,
			},
		}
		expect(parseUrl(`?${serializeUrl(s, 'light')}`)).toEqual(s)
	})
	it('accepts the ped + bike who filter', () => {
		expect(parseUrl('?mode=pedbike').mode).toBe('pedbike')
		expect(serializeUrl({ ...DEFAULT_URL_STATE, mode: 'pedbike' })).toBe(
			'mode=pedbike',
		)
	})
	it('drops junk map filters', () => {
		const s = parseUrl(
			`?map=yes&tod=lunch&days=sunday&hr=yes&street=${'x'.repeat(81)}`,
		)
		expect(s.mapFull).toBe(false)
		expect(s.filters).toEqual(DEFAULT_URL_STATE.filters)
	})
})
