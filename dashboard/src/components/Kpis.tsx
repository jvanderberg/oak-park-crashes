import { Skeleton } from '@/components/ui/skeleton'
import { type Comparison, compare } from '@/lib/crashes'
import { fmtInt, fmtPct } from '@/lib/format'
import { useStore } from '@/lib/store'
import { MODE_LABEL, type Measure } from '@/lib/types'
import { periodSpan, useVillageView } from '@/lib/view'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { useMemo } from 'react'

const CARDS: Array<{ measure: Measure; label: string; hint: string }> = [
	{ measure: 'crashes', label: 'Crashes', hint: 'every police crash report' },
	{
		measure: 'injury',
		label: 'Injury crashes',
		hint: 'someone was hurt (K, A, B or C)',
	},
	{
		measure: 'ksi',
		label: 'Fatal & serious-injury crashes',
		hint: 'someone was killed or incapacitated (K or A)',
	},
	{
		measure: 'people',
		label: 'People hurt',
		hint: 'everyone injured or killed',
	},
]

export function Kpis() {
	const view = useVillageView()
	const mode = useStore((s) => s.mode)
	const measure = useStore((s) => s.measure)

	const rows = useMemo(() => {
		if (!view) return null
		const first = view.years[0] ?? view.year
		return CARDS.map((c) => ({
			...c,
			cmp: compare(view.allModeFiltered, view.period, c.measure, first),
		}))
	}, [view])

	if (!view || !rows) {
		return (
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{['a', 'b', 'c', 'd'].map((k) => (
					<div key={k} className="rounded-md border border-border bg-card p-4">
						<Skeleton className="h-3 w-32" />
						<Skeleton className="mt-3 h-8 w-24" />
						<Skeleton className="mt-2 h-3 w-40" />
					</div>
				))}
			</div>
		)
	}

	const span = periodSpan(view.period, view.lastDate)
	const who =
		mode === 'all' ? '' : ` · ${MODE_LABEL[mode].toLowerCase()} crashes`

	return (
		<section aria-label="Headline numbers">
			<p className="mb-2 text-xs text-muted-foreground">
				Oak Park police reports, {span}
				{view.period.partial ? `, ${view.year}` : ''}
				{who}. Changes compare the same dates a year earlier.
			</p>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{rows.map((r) => (
					<KpiCard
						key={r.measure}
						label={r.label}
						hint={r.hint}
						cmp={r.cmp}
						prevYear={view.year - 1}
						active={r.measure === measure}
					/>
				))}
			</div>
		</section>
	)
}

function KpiCard({
	label,
	hint,
	cmp,
	prevYear,
	active,
}: {
	label: string
	hint: string
	cmp: Comparison
	prevYear: number
	active: boolean
}) {
	return (
		<div
			className={`rounded-md border bg-card p-4 shadow-sm ${active ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border'}`}
			aria-current={active || undefined}
		>
			<p className="text-xs font-medium text-muted-foreground">{label}</p>
			<p className="mt-1 text-2xl font-semibold">{fmtInt(cmp.current)}</p>
			<Delta cmp={cmp} prevYear={prevYear} />
			<p className="mt-0.5 text-[0.7rem] text-muted-foreground">{hint}</p>
		</div>
	)
}

/** Change vs. the same span last year. For crashes, up is bad: the icon and
 * the word carry the direction; color only reinforces it. */
function Delta({ cmp, prevYear }: { cmp: Comparison; prevYear: number }) {
	if (cmp.previous === null) {
		return (
			<p className="mt-1 text-xs text-muted-foreground">
				first year of Village data
			</p>
		)
	}
	if (cmp.change === null || Math.abs(cmp.change) < 0.005) {
		return (
			<p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
				<Minus className="size-3.5" aria-hidden />
				same as {prevYear} ({fmtInt(cmp.previous)})
			</p>
		)
	}
	const up = cmp.change > 0
	return (
		<p
			className={`mt-1 flex items-center gap-1 text-xs font-medium ${up ? 'text-destructive' : 'text-success'}`}
		>
			{up ? (
				<ArrowUp className="size-3.5" aria-hidden />
			) : (
				<ArrowDown className="size-3.5" aria-hidden />
			)}
			{up ? 'up' : 'down'} {fmtPct(Math.abs(cmp.change), { signed: false })}{' '}
			<span className="font-normal text-muted-foreground">
				vs {fmtInt(cmp.previous)} in {prevYear}
			</span>
		</p>
	)
}
