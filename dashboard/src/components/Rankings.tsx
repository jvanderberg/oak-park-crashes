import { ToggleGroup } from '@/components/ToggleGroup'
import { Skeleton } from '@/components/ui/skeleton'
import { type Ranked, locationKey, rank } from '@/lib/crashes'
import { fmtInt } from '@/lib/format'
import { useStore } from '@/lib/store'
import { MEASURE_LABEL, type VillageCrash } from '@/lib/types'
import { periodSpan, useVillageView } from '@/lib/view'
import { useMemo, useState } from 'react'

type WhereBy = 'place' | 'street'

const UNHELPFUL_CAUSES = new Set([
	'Unable To Determine',
	'Not Applicable',
	'Unable to Determine',
	'(N/A)',
	'(UNK)',
])

export function Rankings() {
	const view = useVillageView()
	const measure = useStore((s) => s.measure)
	const [by, setBy] = useState<WhereBy>('place')

	const where = useMemo(() => {
		if (!view) return null
		const key =
			by === 'place'
				? (c: VillageCrash) => locationKey(c)
				: (c: VillageCrash) => c.street || null
		return rank(view.crashes, key, measure, 15)
	}, [view, measure, by])

	const why = useMemo(() => {
		if (!view) return null
		return rank(view.crashes, (c) => c.cause1, measure, 12)
	}, [view, measure])

	if (!view || !where || !why) {
		return (
			<div className="grid gap-4 md:grid-cols-2">
				<Skeleton className="h-80 w-full" />
				<Skeleton className="h-80 w-full" />
			</div>
		)
	}
	const span = `${periodSpan(view.period, view.lastDate)}${view.period.partial ? `, ${view.year}` : ''}`
	const label = MEASURE_LABEL[measure]
	const whyKnown = why.filter((r) => !UNHELPFUL_CAUSES.has(r.key))

	return (
		<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
			<section
				className="rounded-md border border-border bg-card p-4 shadow-sm"
				aria-labelledby="where-title"
			>
				<div className="flex flex-wrap items-start justify-between gap-2">
					<div>
						<h2 id="where-title" className="text-sm font-semibold">
							Where
						</h2>
						<p className="text-xs text-muted-foreground">
							Top locations by {label.toLowerCase()}, {span}
						</p>
					</div>
					<ToggleGroup<WhereBy>
						ariaLabel="Group locations by"
						value={by}
						onChange={setBy}
						options={[
							{ value: 'place', label: 'Intersection' },
							{ value: 'street', label: 'Street' },
						]}
					/>
				</div>
				<RankTable
					rows={where}
					label={label}
					keyHead={by === 'place' ? 'Location' : 'Street'}
				/>
			</section>
			<section
				className="rounded-md border border-border bg-card p-4 shadow-sm"
				aria-labelledby="why-title"
			>
				<h2 id="why-title" className="text-sm font-semibold">
					Why
				</h2>
				<p className="text-xs text-muted-foreground">
					Primary contributing cause the officer recorded, {span}
				</p>
				<RankTable rows={why} label={label} keyHead="Cause" />
				{whyKnown[0] && (
					<p className="mt-2 text-xs text-muted-foreground">
						Most common identified cause:{' '}
						<span className="text-foreground">{whyKnown[0].key}</span> (
						{fmtInt(whyKnown[0].value)}).
					</p>
				)}
			</section>
			<p className="text-[0.7rem] text-muted-foreground md:col-span-2">
				These are counts, not rates: a busy street sees more crashes partly
				because it carries more traffic. Street names drop the N/S prefix so a
				corridor’s two halves add together. A location without a cross street is
				a mid-block crash.
			</p>
		</div>
	)
}

function RankTable({
	rows,
	label,
	keyHead,
}: {
	rows: Ranked[]
	label: string
	keyHead: string
}) {
	if (rows.length === 0) {
		return (
			<p className="mt-3 text-xs text-muted-foreground">None in this view.</p>
		)
	}
	const max = rows[0]?.value ?? 1
	return (
		<div className="thin-scroll mt-3 max-h-[26rem] overflow-y-auto">
			<table className="w-full text-xs tabular-nums">
				<thead className="sticky top-0 bg-muted text-muted-foreground">
					<tr>
						<th className="px-2 py-1 text-left font-medium">{keyHead}</th>
						<th className="w-[30%] px-2 py-1 text-right font-medium">
							{label}
						</th>
						<th
							className="px-2 py-1 text-right font-medium"
							title="Crashes that killed or seriously injured someone"
						>
							Fatal or serious
						</th>
						<th
							className="px-2 py-1 text-right font-medium"
							title="Pedestrian or bicycle crashes"
						>
							Ped/bike
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((r) => (
						<tr key={r.key} className="border-b border-border">
							<td className="px-2 py-1 leading-snug" title={r.key}>
								{r.key}
							</td>
							<td className="px-2 py-1 text-right">
								<div className="flex items-center justify-end gap-2">
									<span
										className="h-1.5 rounded-full bg-primary/60"
										style={{ width: `${Math.max(4, (r.value / max) * 64)}px` }}
										aria-hidden
									/>
									<span className="w-8">{fmtInt(r.value)}</span>
								</div>
							</td>
							<td className="px-2 py-1 text-right">
								{r.ksi ? fmtInt(r.ksi) : '—'}
							</td>
							<td className="px-2 py-1 text-right">
								{r.ped + r.bike ? fmtInt(r.ped + r.bike) : '—'}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}
