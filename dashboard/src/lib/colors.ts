// Plotly and Leaflet can't read CSS custom properties, and Plotly's color
// math chokes on oklch() strings (getComputedStyle preserves the oklch color
// space). So resolve every token at render time: read the computed value off
// a probe element, then round-trip it through a 1x1 canvas, which parses any
// CSS color and hands back plain RGBA. Recomputed whenever the theme flips
// (the .dark class is applied synchronously before React re-renders).

import type { Layout } from 'plotly.js'
import type { Mode } from './types'

/** Layout fields Plotly 3 supports that @types/plotly.js hasn't caught up
 * with yet. */
export type ChartLayout = Partial<Layout> & { barcornerradius?: number }

/** Convert any CSS color string (incl. oklch) to an rgb()/rgba() string. */
function cssColorToRgb(css: string): string {
	const canvas = document.createElement('canvas')
	canvas.width = 1
	canvas.height = 1
	const ctx = canvas.getContext('2d', { willReadFrequently: true })
	if (!ctx) return css
	ctx.fillStyle = css
	ctx.fillRect(0, 0, 1, 1)
	const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
	return a === 255
		? `rgb(${r}, ${g}, ${b})`
		: `rgba(${r}, ${g}, ${b}, ${((a ?? 255) / 255).toFixed(3)})`
}

export interface ChartTheme {
	mode: Record<Mode, string>
	/** Year-to-date lines: [two years back, last year]; focus year = primary. */
	pastYears: [string, string]
	primary: string
	foreground: string
	mutedForeground: string
	border: string
	card: string
	muted: string
	map: {
		bg: string
		park: string
		street: string
		streetMajor: string
		rail: string
		boundary: string
	}
	fontFamily: string
}

/** Snapshot every color/font the charts need from the live CSS tokens. */
export function resolveChartTheme(): ChartTheme {
	const el = document.createElement('div')
	el.style.display = 'none'
	document.body.appendChild(el)
	const read = (token: string) => {
		el.style.color = `var(${token})`
		return cssColorToRgb(getComputedStyle(el).color)
	}
	try {
		return {
			mode: {
				veh: read('--mode-veh'),
				ped: read('--mode-ped'),
				bike: read('--mode-bike'),
			},
			pastYears: [read('--year-past-1'), read('--year-past-2')],
			primary: read('--primary'),
			foreground: read('--foreground'),
			mutedForeground: read('--muted-foreground'),
			border: read('--border'),
			card: read('--card'),
			muted: read('--muted'),
			map: {
				bg: read('--map-bg'),
				park: read('--map-park'),
				street: read('--map-street'),
				streetMajor: read('--map-street-major'),
				rail: read('--map-rail'),
				boundary: read('--map-boundary'),
			},
			fontFamily: getComputedStyle(document.body).fontFamily,
		}
	} finally {
		el.remove()
	}
}

/** Shared Plotly layout chrome: recessive hairline grid, app font, no
 * dual axes anywhere. */
export function baseLayout(t: ChartTheme) {
	return {
		paper_bgcolor: 'rgba(0,0,0,0)',
		plot_bgcolor: 'rgba(0,0,0,0)',
		font: { family: t.fontFamily, size: 11, color: t.mutedForeground },
		margin: { l: 44, r: 12, t: 8, b: 36 },
		hoverlabel: {
			bgcolor: t.card,
			bordercolor: t.border,
			font: { family: t.fontFamily, size: 12, color: t.foreground },
		},
		xaxis: {
			showgrid: false,
			linecolor: t.border,
			tickcolor: t.border,
			fixedrange: true,
		},
		yaxis: {
			gridcolor: t.border,
			gridwidth: 1,
			zeroline: false,
			linecolor: t.border,
			rangemode: 'tozero' as const,
			fixedrange: true,
			tickformat: ',d',
		},
		showlegend: false,
	}
}
