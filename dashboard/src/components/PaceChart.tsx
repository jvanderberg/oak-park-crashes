import { ChartCard, Legend, SeriesTable } from '@/components/ChartCard'
import { PLOT_CONFIG, Plot } from '@/components/Plot'
import { baseLayout, resolveChartTheme } from '@/lib/colors'
import { calendarDoy, cumulativeByDay } from '@/lib/crashes'
import { fmtInt, fmtMonthDay } from '@/lib/format'
import { useStore } from '@/lib/store'
import { MEASURE_LABEL, MODE_FILTER_LABEL } from '@/lib/types'
import { useNarrow } from '@/lib/useNarrow'
import { useVillageView } from '@/lib/view'
import type { Data, Layout } from 'plotly.js'
import { useMemo } from 'react'

const MONTH_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
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

/** Non-leap day-of-year → ISO date in a reference non-leap year, so the
 * shared x axis is a real date axis ("Mar 4" in hovers, months on ticks). */
const REF_YEAR = 2001
function doyDate(doy: number): string {
	const d = new Date(Date.UTC(REF_YEAR, 0, doy))
	return d.toISOString().slice(0, 10)
}

/**
 * Running totals, year over year, on a shared Jan 1 → Dec 31 axis — the
 * honest way to ask "is this year worse?" while the year is still going.
 */
export function PaceChart() {
	const view = useVillageView()
	const measure = useStore((s) => s.measure)
	const mode = useStore((s) => s.mode)
	useStore((s) => s.theme)
	const narrow = useNarrow()

	const lines = useMemo(() => {
		if (!view) return null
		const lastDoy = calendarDoy(
			Number(view.lastDate.slice(5, 7)) - 1,
			Number(view.lastDate.slice(8, 10)),
		)
		const lastYear = view.years.at(-1)
		return view.years.map((y) => ({
			year: y,
			values: cumulativeByDay(
				view.allModeFiltered,
				y,
				measure,
				y === lastYear ? lastDoy : 365,
			),
		}))
	}, [view, measure])

	if (!view || !lines)
		return (
			<ChartCard title="Year-to-date pace" loading>
				{null}
			</ChartCard>
		)

	const t = resolveChartTheme()
	const focus = view.year
	const others = lines.filter((l) => l.year !== focus).map((l) => l.year)
	const colorOf = (y: number) => {
		if (y === focus) return t.primary
		// Older years recede further.
		const rank = others.length - 1 - others.indexOf(y)
		return rank === 0 ? t.pastYears[1] : t.pastYears[0]
	}
	const cut = view.period.throughDoy
	const atCut = (l: (typeof lines)[number]) =>
		l.values[Math.min(cut, l.values.length) - 1] ?? 0

	const data: Data[] = lines.map((l) => {
		const x = l.values.map((_, i) => doyDate(i + 1))
		return {
			type: 'scatter',
			mode: 'lines',
			name: String(l.year),
			x,
			y: l.values,
			line: {
				color: colorOf(l.year),
				width: l.year === focus ? 2.5 : 2,
				shape: 'hv',
			},
			hovertemplate: `${l.year}: %{y:,d}<extra></extra>`,
		}
	})
	// End-of-line markers and direct labels (one per line — sparing).
	const ends: Data[] = lines.map((l) => ({
		type: 'scatter',
		mode: 'markers',
		x: [doyDate(l.values.length)],
		y: [l.values.at(-1) ?? 0],
		marker: {
			color: colorOf(l.year),
			size: 8,
			line: { color: t.card, width: 2 },
		},
		hoverinfo: 'skip',
		showlegend: false,
	}))

	const base = baseLayout(t)
	const layout: Partial<Layout> = {
		...base,
		height: 300,
		margin: { ...base.margin, r: narrow ? 12 : 64 },
		hovermode: 'x unified',
		xaxis: {
			...base.xaxis,
			type: 'date',
			range: [doyDate(1), doyDate(narrow ? 366 : 372)],
			// Explicit ticks so the padding past Dec 31 never grows a 13th "Jan".
			tickvals: MONTH_STARTS.filter((_, i) => !narrow || i % 2 === 0).map(
				doyDate,
			),
			ticktext: SHORT.filter((_, i) => !narrow || i % 2 === 0),
			tickangle: 0,
			hoverformat: '%b %-d',
		},
		// Direct end labels on wide screens only. The focus year (the top
		// line while a year is in progress) is labelled above-left of its
		// end point so it never sits on another year's line.
		annotations: narrow
			? []
			: lines.map((l) => {
					const isFocus = l.year === focus && view.period.partial
					return {
						x: doyDate(l.values.length),
						y: l.values.at(-1) ?? 0,
						xanchor: isFocus ? 'right' : 'left',
						yanchor: isFocus ? 'bottom' : 'middle',
						xshift: isFocus ? -4 : 8,
						yshift: isFocus ? 6 : 0,
						text: `${l.year}: ${fmtInt(l.values.at(-1) ?? 0)}`,
						showarrow: false,
						font: {
							size: 11,
							color: l.year === focus ? t.foreground : t.mutedForeground,
						},
					}
				}),
		shapes: view.period.partial
			? [
					{
						type: 'line',
						x0: doyDate(cut),
						x1: doyDate(cut),
						yref: 'paper',
						y0: 0,
						y1: 1,
						line: { color: t.border, width: 1 },
						layer: 'below',
					},
				]
			: [],
	}

	const lastYear = lines.at(-1)
	const prev = lines.find((l) => l.year === (lastYear?.year ?? 0) - 1)
	const who =
		mode === 'all' ? '' : ` · ${MODE_FILTER_LABEL[mode].toLowerCase()} crashes`

	return (
		<ChartCard
			title="Year-to-date pace"
			subtitle={`Running total of ${MEASURE_LABEL[measure].toLowerCase()} since Jan 1, each year${who}`}
			legend={
				<Legend
					items={lines.map((l) => ({
						key: String(l.year),
						label: String(l.year),
						swatch: colorOf(l.year),
						line: true,
					}))}
				/>
			}
			caption={
				lastYear && prev && view.period.partial
					? `Through ${fmtMonthDay(view.lastDate)}: ${fmtInt(atCut(lastYear))} in ${lastYear.year} vs ${fmtInt(atCut(prev))} in ${prev.year} on the same date.`
					: undefined
			}
			table={
				<SeriesTable
					head={['Through', ...lines.map((l) => String(l.year))]}
					rows={MONTH_STARTS.slice(1)
						.map((d) => d - 1)
						.concat([365])
						.map((d, i) => [
							`End of ${SHORT[i]}`,
							...lines.map((l) =>
								d <= l.values.length ? (l.values[d - 1] ?? 0) : '—',
							),
						])}
				/>
			}
		>
			<Plot
				data={[...data, ...ends]}
				layout={layout}
				config={PLOT_CONFIG}
				useResizeHandler
				className="w-full"
				style={{ width: '100%', height: 300 }}
			/>
		</ChartCard>
	)
}
