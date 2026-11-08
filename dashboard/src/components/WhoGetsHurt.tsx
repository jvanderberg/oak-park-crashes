import { Skeleton } from '@/components/ui/skeleton'
import { inPeriod, modeShares } from '@/lib/crashes'
import { fmtInt, fmtPct } from '@/lib/format'
import { useStore } from '@/lib/store'
import { MEASURE_LABEL, MODE_LABEL, type Mode } from '@/lib/types'
import { useVillageView } from '@/lib/view'
import { useMemo } from 'react'

const SWATCH: Record<Mode, string> = {
	veh: 'bg-mode-veh',
	ped: 'bg-mode-ped',
	bike: 'bg-mode-bike',
}

/**
 * Share of harm by mode — one whole split into parts (a tall segmented bar)
 * plus the table that carries every number. Always all modes: this card is
 * the answer to "who is this for?", so the mode filter doesn't apply.
 */
export function WhoGetsHurt() {
	const view = useVillageView()
	const measure = useStore((s) => s.measure)

	const shares = useMemo(() => {
		if (!view) return null
		return modeShares(inPeriod(view.allModes, view.period), measure)
	}, [view, measure])

	if (!view || !shares) {
		return (
			<section className="rounded-md border border-border bg-card p-4 shadow-sm">
				<Skeleton className="h-4 w-40" />
				<Skeleton className="mt-4 h-7 w-full" />
				<Skeleton className="mt-4 h-24 w-full" />
			</section>
		)
	}

	const total = shares.reduce((s, m) => s + m.value, 0)
	const crashTotal = shares.reduce((s, m) => s + m.crashes, 0)
	const veh = shares.find((s) => s.mode === 'veh')
	const ped = shares.find((s) => s.mode === 'ped')
	const rateRatio =
		veh && ped && veh.injuryRate > 0 ? ped.injuryRate / veh.injuryRate : null

	return (
		<section
			className="rounded-md border border-border bg-card p-4 shadow-sm"
			aria-labelledby="who-title"
		>
			<h2 id="who-title" className="text-sm font-semibold">
				Who gets hurt
			</h2>
			<p className="text-xs text-muted-foreground">
				{MEASURE_LABEL[measure]} by who was involved, {view.span} ·{' '}
				{fmtInt(total)} in all
			</p>

			{total > 0 ? (
				<div
					className="mt-3 flex h-7 w-full gap-0.5"
					role="img"
					aria-label={shares
						.map(
							(s) =>
								`${MODE_LABEL[s.mode]}: ${fmtInt(s.value)} (${fmtPct(s.share, { signed: false })})`,
						)
						.join('; ')}
				>
					{shares
						.filter((s) => s.value > 0)
						.map((s) => (
							<div
								key={s.mode}
								className={`flex items-center overflow-hidden rounded-[4px] px-2 text-xs font-medium text-white ${SWATCH[s.mode]}`}
								style={{ flexGrow: s.value, flexBasis: 0 }}
								title={`${MODE_LABEL[s.mode]}: ${fmtInt(s.value)} (${fmtPct(s.share, { signed: false })})`}
							>
								{/* Print the share only where it fits; the table has it too. */}
								{s.share >= 0.08 ? fmtPct(s.share, { signed: false }) : ''}
							</div>
						))}
				</div>
			) : (
				<p className="mt-3 text-xs text-muted-foreground">
					None in this period.
				</p>
			)}

			<ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden>
				{shares.map((s) => (
					<li key={s.mode} className="flex items-center gap-1.5">
						<span className={`size-2.5 rounded-sm ${SWATCH[s.mode]}`} />
						{MODE_LABEL[s.mode]}
					</li>
				))}
			</ul>

			<table className="mt-3 w-full text-xs tabular-nums">
				<thead className="bg-muted text-muted-foreground">
					<tr>
						<th className="px-2 py-1 text-left font-medium">Involved</th>
						<th className="px-2 py-1 text-right font-medium">Crashes</th>
						<th className="px-2 py-1 text-right font-medium">
							{MEASURE_LABEL[measure]}
						</th>
						<th className="px-2 py-1 text-right font-medium">Share</th>
						<th className="px-2 py-1 text-right font-medium">
							Crashes that injure someone
						</th>
					</tr>
				</thead>
				<tbody>
					{shares.map((s) => (
						<tr key={s.mode} className="border-b border-border">
							<td className="px-2 py-1">
								<span className="flex items-center gap-1.5">
									<span className={`size-2.5 rounded-sm ${SWATCH[s.mode]}`} />
									{MODE_LABEL[s.mode]}
								</span>
							</td>
							<td className="px-2 py-1 text-right">
								{fmtInt(s.crashes)}
								<span className="block text-[0.7rem] text-muted-foreground">
									{fmtPct(crashTotal ? s.crashes / crashTotal : null, {
										signed: false,
									})}{' '}
									of crashes
								</span>
							</td>
							<td className="px-2 py-1 text-right">{fmtInt(s.value)}</td>
							<td className="px-2 py-1 text-right">
								{fmtPct(s.share, { signed: false })}
							</td>
							<td className="px-2 py-1 text-right">
								{fmtPct(s.injuryRate, { signed: false })}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			{rateRatio !== null && ped && veh && (
				<p className="mt-2 text-xs text-muted-foreground">
					A crash involving a pedestrian injured someone{' '}
					{fmtPct(ped.injuryRate, { signed: false })} of the time, against{' '}
					{fmtPct(veh.injuryRate, { signed: false })} for crashes between
					vehicles only — about {rateRatio.toFixed(0)}× as often.
				</p>
			)}
		</section>
	)
}
