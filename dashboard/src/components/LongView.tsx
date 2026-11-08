import { ChartCard, Legend, SeriesTable } from '@/components/ChartCard'
import { PLOT_CONFIG, Plot } from '@/components/Plot'
import { ToggleGroup } from '@/components/ToggleGroup'
import { type ChartLayout, baseLayout, resolveChartTheme } from '@/lib/colors'
import { annualSeries, byMode } from '@/lib/crashes'
import { passesFilters } from '@/lib/filters'
import { fmtInt } from '@/lib/format'
import { VISION_ZERO_BASELINE } from '@/lib/milestones'
import { useStore } from '@/lib/store'
import { stackedBars, totalTrace, visibleModes } from '@/lib/traces'
import { MEASURE_LABEL, MODE_LABEL } from '@/lib/types'
import type { Interstate } from '@/lib/url'
import { useNarrow } from '@/lib/useNarrow'
import { useMemo } from 'react'

/** IDOT's statewide files, 2014 → — the long view the Village data can't give. */
export function LongView() {
	const idot = useStore((s) => s.idot)
	const manifest = useStore((s) => s.manifest)
	const measure = useStore((s) => s.measure)
	const mode = useStore((s) => s.mode)
	const interstate = useStore((s) => s.interstate)
	const filters = useStore((s) => s.filters)
	const setInterstate = useStore((s) => s.setInterstate)
	useStore((s) => s.theme)
	const narrow = useNarrow()

	const view = useMemo(() => {
		if (!idot || !manifest) return null
		const years = manifest.sources.idot.years.map((y) => y.year)
		const scoped =
			interstate === 'excl' ? idot.filter((c) => !c.interstate) : idot
		// IDOT's files have no street names, so the street filter can't apply.
		const filtered = byMode(scoped, mode).filter((c) =>
			passesFilters(c, filters, 'street'),
		)
		const series = annualSeries(filtered, measure, years)
		const i290 = idot.filter((c) => c.interstate)
		return {
			years,
			series,
			i290Share: idot.length ? i290.length / idot.length : 0,
		}
	}, [idot, manifest, measure, mode, interstate, filters])

	if (!view) {
		return (
			<ChartCard title="Twelve years of IDOT crash data" loading>
				{null}
			</ChartCard>
		)
	}

	const t = resolveChartTheme()
	const modes = visibleModes(mode)
	const { years, series } = view
	const x = years.map(String)
	const newest = years.at(-1)
	// The newest IDOT year can still move as late reports arrive.
	const opacity = years.map((y) => (y === newest ? 0.55 : 1))
	const totals = years.map((_, i) =>
		modes.reduce((s, m) => s + (series.values[m][i] ?? 0), 0),
	)
	const baseIdx = years
		.map((y, i) => ({ y, i }))
		.filter(
			({ y }) => y >= VISION_ZERO_BASELINE.from && y <= VISION_ZERO_BASELINE.to,
		)
	const baselineAvg = baseIdx.length
		? baseIdx.reduce((s, { i }) => s + (totals[i] ?? 0), 0) / baseIdx.length
		: null

	// Category axes place items at integer positions; pad half a band either
	// side so the shade covers whole bars.
	const i0 = x.indexOf(String(VISION_ZERO_BASELINE.from))
	const i1 = x.indexOf(String(VISION_ZERO_BASELINE.to))
	const base = baseLayout(t)
	const layout: ChartLayout = {
		...base,
		barmode: 'stack',
		bargap: 0.35,
		barcornerradius: 4,
		hovermode: 'x unified',
		height: 300,
		xaxis: {
			...base.xaxis,
			type: 'category',
			tickangle: 0,
			// "’14" on phones so twelve years fit without rotating.
			tickvals: x,
			ticktext: narrow ? x.map((y) => `’${y.slice(2)}`) : x,
		},
		shapes:
			i0 >= 0 && i1 >= 0
				? [
						{
							type: 'rect',
							xref: 'x',
							yref: 'paper',
							x0: i0 - 0.5,
							x1: i1 + 0.5,
							y0: 0,
							y1: 1,
							fillcolor: t.muted,
							line: { width: 0 },
							layer: 'below',
						},
					]
				: [],
		annotations:
			i0 >= 0
				? [
						{
							xref: 'x',
							yref: 'paper',
							x: i0 - 0.45,
							y: 1,
							xanchor: 'left',
							yanchor: 'top',
							text: 'Vision Zero baseline years',
							showarrow: false,
							font: { size: 10, color: t.mutedForeground },
						},
					]
				: [],
	}

	return (
		<ChartCard
			title="Twelve years of IDOT crash data"
			subtitle={`${MEASURE_LABEL[measure]} per year in Oak Park, ${years[0]}–${newest}, all reporting agencies · Illinois Department of Transportation`}
			controls={
				<ToggleGroup<Interstate>
					ariaLabel="Interstate crashes"
					value={interstate}
					onChange={setInterstate}
					options={[
						{ value: 'excl', label: 'Village streets' },
						{ value: 'incl', label: 'Include I-290' },
					]}
				/>
			}
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
				<>
					{filters.street && (
						<strong className="font-medium text-foreground">
							Not filtered to {filters.street}: IDOT’s files have no street
							names.{' '}
						</strong>
					)}
					{baselineAvg !== null &&
						`${VISION_ZERO_BASELINE.from}–${VISION_ZERO_BASELINE.to} averaged ${fmtInt(baselineAvg)} a year. `}
					{newest} is faded: IDOT’s newest file may still change. IDOT counts
					only state-reportable crashes, so its totals run lower than the
					Village’s police reports — compare years within this chart, not
					against the charts above.{' '}
					{interstate === 'excl' &&
						`“Village streets” leaves out crashes on I-290 and its ramps (${Math.round(view.i290Share * 100)}% of IDOT’s Oak Park crashes), which the Village doesn’t police or design.`}
				</>
			}
			table={
				<SeriesTable
					head={['Year', ...modes.map((m) => MODE_LABEL[m]), 'Total']}
					rows={years.map((y, i) => [
						y === newest ? `${y} (preliminary)` : String(y),
						...modes.map((m) => series.values[m][i] ?? 0),
						totals[i] ?? 0,
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
