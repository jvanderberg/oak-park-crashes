// Formatters defined once and reused by KPIs, charts, tables and the map so
// every surface agrees. All tolerate null and return a sentinel.

export const SENTINEL = '—'

const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function fmtInt(v: number | null | undefined): string {
	if (v == null || !Number.isFinite(v)) return SENTINEL
	return int.format(v)
}

/** Fractional input (0.486) → "+48.6%". */
export function fmtPct(
	v: number | null | undefined,
	{ signed = true, digits = 0 } = {},
): string {
	if (v == null || !Number.isFinite(v)) return SENTINEL
	const pct = v * 100
	const sign = signed && pct > 0 ? '+' : ''
	return `${sign}${pct.toFixed(digits)}%`
}

const MONTHS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
]

/** "2026-10-31" → "Oct 31, 2026". */
export function fmtDate(iso: string | null | undefined): string {
	if (!iso) return SENTINEL
	const y = iso.slice(0, 4)
	const m = Number(iso.slice(5, 7)) - 1
	const d = Number(iso.slice(8, 10))
	return `${MONTHS[m] ?? '?'} ${d}, ${y}`
}

/** "2026-10-31" → "Oct 31" (no year). */
export function fmtMonthDay(iso: string | null | undefined): string {
	if (!iso) return SENTINEL
	const m = Number(iso.slice(5, 7)) - 1
	return `${MONTHS[m] ?? '?'} ${Number(iso.slice(8, 10))}`
}

/** "2026-10" → "Oct 2026". */
export function fmtMonth(key: string): string {
	return `${MONTHS[Number(key.slice(5, 7)) - 1] ?? '?'} ${key.slice(0, 4)}`
}

/** 0–23 → "3 PM". */
export function fmtHour(h: number | null | undefined): string {
	if (h == null) return SENTINEL
	const ap = h < 12 ? 'AM' : 'PM'
	const hh = h % 12 === 0 ? 12 : h % 12
	return `${hh} ${ap}`
}
