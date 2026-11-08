import { ChartCard, Legend, SeriesTable } from '@/components/ChartCard'
import { PLOT_CONFIG, Plot } from '@/components/Plot'
import { type ChartLayout, baseLayout, resolveChartTheme } from '@/lib/colors'
import { monthlySeries } from '@/lib/crashes'
import { fmtDate, fmtMonth } from '@/lib/format'
import { useStore } from '@/lib/store'
import { stackedBars, totalTrace, visibleModes } from '@/lib/traces'
import { MEASURE_LABEL, MODE_LABEL } from '@/lib/types'
import { useNarrow } from '@/lib/useNarrow'
import { useVillageView } from '@/lib/view'
import { useMemo } from 'react'

const SHORT = [
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

export function MonthlyChart() {
	const view = useVillageView()
	const measure = useStore((s) => s.measure)
	const mode = useStore((s) => s.mode)
	useStore((s) => s.theme) // re-read tokens on theme flip
	const narrow = useNarrow()

	const series = useMemo(
		() =>
			view
				? monthlySeries(
						view.allModeFiltered,
						measure,
						view.firstDate,
						view.lastDate,
					)
				: null,
		[view, measure],
	)
	if (!view || !series)
		return (
			<ChartCard title="Month by month" loading>
				{null}
			</ChartCard>
		)

	const t = resolveChartTheme()
	const modes = visibleModes(mode)
	const x = series.months
	// The last month is partial unless the data runs through its final day.
	const last = view.lastDate
	const lastDay = new Date(
		Date.UTC(Number(last.slice(0, 4)), Number(last.slice(5, 7)), 0),
	).getUTCDate()
	const partialLast = Number(last.slice(8, 10)) < lastDay
	const opacity = x.map((_, i) =>
		partialLast && i === x.length - 1 ? 0.45 : 1,
	)

	const base = baseLayout(t)
	const tickvals = x.filter((k) =>
		(narrow ? ['01'] : ['01', '04', '07', '10']).includes(k.slice(5, 7)),
	)
	const layout: ChartLayout = {
		...base,
		barmode: 'stack',
		bargap: 0.25,
		barcornerradius: 4,
		hovermode: 'x unified',
		height: 300,
		xaxis: {
			...base.xaxis,
			type: 'category',
			tickangle: 0,
			tickvals,
			ticktext: tickvals.map((k) =>
				k.endsWith('-01')
					? `Jan<br>${k.slice(0, 4)}`
					: (SHORT[Number(k.slice(5, 7)) - 1] ?? ''),
			),
		},
		yaxis: { ...base.yaxis, title: { text: '' } },
	}

	return (
		<ChartCard
			title="Month by month"
			subtitle={`${MEASURE_LABEL[measure]}, Oak Park police reports, ${fmtMonth(x[0] ?? '')} – ${fmtMonth(x.at(-1) ?? '')}`}
			legend={
				modes.length > 1 ? (
					<Legend
						items={modes.map((m) => ({
							key: m,
							label: MODE_LABEL[m],
							swatch: t.mode[m],
						}))}
					/>
				) : undefined
			}
			caption={
				partialLast
					? `The last bar is a partial month (through ${fmtDate(last)}).`
					: undefined
			}
			table={
				<SeriesTable
					head={['Month', ...modes.map((m) => MODE_LABEL[m]), 'Total']}
					rows={x.map((k, i) => [
						fmtMonth(k),
						...modes.map((m) => series.values[m][i] ?? 0),
						modes.reduce((s, m) => s + (series.values[m][i] ?? 0), 0),
					])}
				/>
			}
		>
			<Plot
				data={[
					...stackedBars(x, series.values, modes, t, opacity),
					totalTrace(x, series.values, modes),
				]}
				layout={layout}
				config={PLOT_CONFIG}
				useResizeHandler
				className="w-full"
				style={{ width: '100%', height: 300 }}
			/>
		</ChartCard>
	)
}
