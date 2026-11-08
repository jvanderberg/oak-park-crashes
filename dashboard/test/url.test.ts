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
		}
		expect(parseUrl(`?${serializeUrl(s, 'light')}`)).toEqual(s)
	})
})
