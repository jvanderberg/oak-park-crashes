// Shared Plotly trace builders so every bar chart obeys the same mark specs:
// stacked in fixed mode order, a 2px surface-colored gap between segments,
// color following the entity (never its rank).

import type { Data } from 'plotly.js'
import type { ChartTheme } from './colors'
import { MODES, MODE_LABEL, type Mode, type ModeFilter } from './types'

export function visibleModes(filter: ModeFilter): Mode[] {
	return filter === 'all' ? [...MODES] : [filter]
}

export function stackedBars(
	x: Array<string | number>,
	values: Record<Mode, number[]>,
	modes: Mode[],
	t: ChartTheme,
	opacity: Array<number> | number = 1,
	hoverX = '%{x}',
): Data[] {
	return modes.map((m) => ({
		type: 'bar',
		name: MODE_LABEL[m],
		x,
		y: values[m],
		marker: {
			color: t.mode[m],
			opacity,
			line: { color: t.card, width: 2 },
		},
		hovertemplate: `${MODE_LABEL[m]}: %{y:,d}<extra></extra>`,
		hoverlabel: { namelength: 0 },
		xhoverformat: hoverX,
	}))
}

/** Invisible trace that puts the stack total into a unified hover. */
export function totalTrace(
	x: Array<string | number>,
	values: Record<Mode, number[]>,
	modes: Mode[],
): Data {
	const totals = x.map((_, i) =>
		modes.reduce((s, m) => s + (values[m][i] ?? 0), 0),
	)
	return {
		type: 'scatter',
		mode: 'markers',
		x,
		y: totals,
		marker: { opacity: 0, size: 1 },
		hovertemplate: '<b>Total: %{y:,d}</b><extra></extra>',
		showlegend: false,
	}
}
