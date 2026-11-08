// Code → label tables for IDOT SR 1050 crash-report fields.
//
// The Village's export carries bare numeric codes for weather, lighting,
// traffic control, etc. IDOT's statewide crash layers publish each code
// *alongside* its text label, so the tables are derived from IDOT's own rows
// rather than typed in by hand. IDOT's labels are sometimes truncated
// ("Flashing Control Sig") or mis-encoded ("â€“"); the derivation keeps the
// longest label when the observed labels form a prefix chain, otherwise the
// most frequent one, and records every ambiguity so it can be disclosed.

export type Codebook = Record<string, string>

export interface CodebookReport {
	field: string
	codeField: string
	labelField: string
	codes: number
	/** Codes whose observed labels disagreed (beyond truncation/outliers). */
	ambiguous: Array<{ code: string; labels: Record<string, number> }>
}

/** Canonical code key: trimmed, leading zeros stripped for numeric codes. */
export function codeKey(v: unknown): string | null {
	if (v === null || v === undefined) return null
	const s = String(v).trim()
	if (s === '') return null
	return /^\d+$/.test(s) ? String(Number.parseInt(s, 10)) : s
}

export function cleanLabel(v: unknown): string {
	return String(v ?? '')
		.replace(/â€“/g, '–')
		.replace(/\s+/g, ' ')
		.trim()
}

export function deriveCodebook(
	rows: Array<Record<string, unknown>>,
	codeField: string,
	labelField: string,
	field: string,
): { book: Codebook; report: CodebookReport } {
	const seen = new Map<string, Map<string, number>>()
	for (const r of rows) {
		const code = codeKey(r[codeField])
		const label = cleanLabel(r[labelField])
		if (code === null || label === '') continue
		const m = seen.get(code) ?? new Map<string, number>()
		m.set(label, (m.get(label) ?? 0) + 1)
		seen.set(code, m)
	}
	const book: Codebook = {}
	const ambiguous: CodebookReport['ambiguous'] = []
	for (const [code, labels] of seen) {
		const total = [...labels.values()].reduce((a, b) => a + b, 0)
		const names = [...labels.keys()]
		// Fold each truncated label into the longest observed label it is a
		// prefix of ("Freezing Rain" → "Freezing Rain or Freezing Drizzle"),
		// summing counts per full label.
		const heads = new Map<string, number>()
		for (const [label, n] of labels) {
			const head =
				names
					.filter((x) => x.startsWith(label))
					.sort((a, b) => b.length - a.length)[0] ?? label
			heads.set(head, (heads.get(head) ?? 0) + n)
		}
		const ranked = [...heads.entries()].sort((a, b) => b[1] - a[1])
		const pick = ranked[0]
		if (!pick) continue
		book[code] = pick[0]
		// A competing full label with a real share (not a stray misaligned
		// row) is a genuine disagreement — record it for disclosure.
		const rival = ranked[1]
		if (rival && rival[1] / total >= 0.05) {
			ambiguous.push({ code, labels: Object.fromEntries(labels) })
		}
	}
	return {
		book,
		report: {
			field,
			codeField,
			labelField,
			codes: Object.keys(book).length,
			ambiguous,
		},
	}
}

/** Decode with an explicit, visible fallback for codes IDOT never labels. */
export function decode(book: Codebook, v: unknown): string | null {
	const k = codeKey(v)
	if (k === null) return null
	return book[k] ?? `Code ${k} (undocumented)`
}
