import { ChartCard, Legend } from '@/components/ChartCard'
import { resolveChartTheme } from '@/lib/colors'
import { isInjury, isKsi, peopleHurt } from '@/lib/crashes'
import { fmtDate, fmtHour, fmtInt } from '@/lib/format'
import { useStore } from '@/lib/store'
import {
	MEASURE_LABEL,
	MODE_LABEL,
	type Measure,
	SEVERITY_LABEL,
	type Severity,
	type VillageCrash,
} from '@/lib/types'
import { periodSpan, useVillageView } from '@/lib/view'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'

const OAK_PARK_BOUNDS: L.LatLngBoundsExpression = [
	[41.8655, -87.8065],
	[41.9095, -87.7735],
]

const RADIUS: Record<Severity, number> = { K: 9, A: 7, B: 5, C: 5, O: 3, U: 3 }
const DRAW_ORDER: Record<Severity, number> = {
	O: 0,
	U: 0,
	C: 1,
	B: 2,
	A: 3,
	K: 4,
}

function passes(c: VillageCrash, measure: Measure): boolean {
	switch (measure) {
		case 'crashes':
			return true
		case 'injury':
			return isInjury(c)
		case 'ksi':
			return isKsi(c)
		case 'people':
			return peopleHurt(c) > 0
	}
}

const ESC: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
}
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ESC[ch] ?? ch)

function popupHtml(c: VillageCrash): string {
	const hurt = [
		c.k ? `${c.k} killed` : '',
		c.a ? `${c.a} seriously injured` : '',
		c.b ? `${c.b} minor injury` : '',
		c.c ? `${c.c} possible injury` : '',
	]
		.filter(Boolean)
		.join(', ')
	const rows: Array<[string, string | null]> = [
		['Severity', SEVERITY_LABEL[c.sev]],
		['Hurt', hurt || null],
		['Type', c.mode === 'veh' ? c.type : MODE_LABEL[c.mode]],
		['Cause', c.cause1],
		['Light', c.light],
		['Weather', c.weather],
		['Control', c.control],
		['Hit & run', c.hitRun ? 'Yes' : null],
	]
	return `<div style="min-width:180px">
		<div style="font-weight:600;font-size:0.8rem">${esc(c.location)}</div>
		<div style="color:var(--color-muted-foreground);margin-bottom:4px">${esc(fmtDate(c.date))} · ${esc(fmtHour(c.hour))}</div>
		<table style="border-collapse:collapse">${rows
			.filter(([, v]) => v)
			.map(
				([k, v]) =>
					`<tr><td style="color:var(--color-muted-foreground);padding:1px 8px 1px 0;vertical-align:top">${esc(k)}</td><td>${esc(v ?? '')}</td></tr>`,
			)
			.join('')}</table>
		<button type="button" data-crash-link="${esc(c.id)}" style="margin-top:6px;color:var(--color-primary);text-decoration:underline;cursor:pointer;background:none;border:0;padding:0;font:inherit">Copy link to this crash</button>
	</div>`
}

export function CrashMap() {
	const view = useVillageView()
	const village = useStore((s) => s.village)
	const basemap = useStore((s) => s.basemap)
	const measure = useStore((s) => s.measure)
	const theme = useStore((s) => s.theme)
	const crashId = useStore((s) => s.crash)
	const setCrash = useStore((s) => s.setCrash)

	const el = useRef<HTMLDivElement | null>(null)
	const map = useRef<L.Map | null>(null)
	const base = useRef<L.LayerGroup | null>(null)
	const layer = useRef<L.LayerGroup | null>(null)
	const ring = useRef<L.LayerGroup | null>(null)
	const opened = useRef<string | null>(null)
	const [mapReady, setMapReady] = useState(false)
	// The container only exists once data has loaded (before that the card
	// renders its skeleton), so map creation keys off this.
	const hasView = view !== null

	const points = useMemo(() => {
		if (!view) return []
		return view.crashes
			.filter((c) => c.lat !== null && c.lon !== null && passes(c, measure))
			.sort((a, b) => DRAW_ORDER[a.sev] - DRAW_ORDER[b.sev])
	}, [view, measure])

	const selected = useMemo(
		() =>
			crashId && village
				? (village.find((c) => c.id === crashId) ?? null)
				: null,
		[crashId, village],
	)

	// Create the map once its container exists.
	useEffect(() => {
		if (!hasView || !el.current || map.current) return
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
		const m = L.map(el.current, {
			preferCanvas: true,
			zoomSnap: 0.25,
			scrollWheelZoom: false,
			zoomAnimation: !reduce,
			fadeAnimation: !reduce,
			markerZoomAnimation: !reduce,
		})
		m.fitBounds(OAK_PARK_BOUNDS)
		// Panes: basemap under the crash dots, street names above them,
		// the permalink ring on top.
		m.createPane('basemap').style.zIndex = '250'
		m.createPane('labels').style.zIndex = '450'
		m.createPane('highlight').style.zIndex = '650'
		m.attributionControl.addAttribution(
			'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		)
		// Secondary street names appear once zoomed in.
		const tier2 = () =>
			m.getContainer().classList.toggle('show-tier2', m.getZoom() >= 14)
		m.on('zoomend', tier2)
		tier2()
		layer.current = L.layerGroup().addTo(m)
		ring.current = L.layerGroup().addTo(m)
		map.current = m
		setMapReady(true)
		// Popup "copy link" buttons are plain HTML; delegate the click.
		const onClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement | null
			const id = target?.getAttribute?.('data-crash-link')
			if (!target || !id) return
			setCrash(id)
			const url = new URL(location.href)
			url.searchParams.set('crash', id)
			navigator.clipboard?.writeText(url.toString())
			target.textContent = 'Link copied'
		}
		el.current.addEventListener('click', onClick)
		const node = el.current
		return () => {
			node.removeEventListener('click', onClick)
			m.remove()
			map.current = null
			setMapReady(false)
		}
	}, [hasView, setCrash])

	// Basemap: OpenStreetMap geometry baked into a static file at build time
	// and drawn as vector layers in its own pane under the crash markers — no
	// tile server, no API key. Restyled from the theme tokens on every flip.
	// biome-ignore lint/correctness/useExhaustiveDependencies: theme re-resolves colors
	useEffect(() => {
		const m = map.current
		if (!mapReady || !m || !basemap) return
		base.current?.remove()
		const t = resolveChartTheme()
		const renderer = L.canvas({ pane: 'basemap', padding: 0.5 })
		const g = L.layerGroup()
		const toLatLng = (line: Array<[number, number]>) =>
			line.map(([lon, lat]) => [lat, lon] as L.LatLngTuple)
		const draw = (
			lines: Array<Array<[number, number]>>,
			style: L.PolylineOptions,
			polygon = false,
		) => {
			for (const ln of lines) {
				const opts = { ...style, renderer, interactive: false }
				;(polygon
					? L.polygon(toLatLng(ln), opts)
					: L.polyline(toLatLng(ln), opts)
				).addTo(g)
			}
		}
		draw(
			basemap.parks,
			{ stroke: false, fillColor: t.map.park, fillOpacity: 1 },
			true,
		)
		draw(basemap.streets.local, { color: t.map.street, weight: 1.5 })
		draw(basemap.streets.minor, { color: t.map.street, weight: 2.5 })
		draw(basemap.streets.major, { color: t.map.streetMajor, weight: 3.5 })
		draw(basemap.streets.highway, { color: t.map.streetMajor, weight: 5 })
		draw(basemap.rail, { color: t.map.rail, weight: 1, dashArray: '4 3' })
		draw(basemap.boundary, {
			color: t.map.boundary,
			weight: 1.5,
			dashArray: '6 4',
		})
		for (const l of basemap.labels) {
			L.marker([l.lat, l.lon], {
				pane: 'labels',
				interactive: false,
				keyboard: false,
				icon: L.divIcon({
					className: `street-label tier-${l.tier}`,
					html: `<span style="--angle:${l.angle}deg">${esc(l.name)}</span>`,
					iconSize: [0, 0],
				}),
			}).addTo(g)
		}
		g.addTo(m)
		base.current = g
	}, [theme, mapReady, basemap])

	// Redraw markers whenever the filtered set or theme changes.
	// biome-ignore lint/correctness/useExhaustiveDependencies: theme re-resolves colors; mapReady gates first draw
	useEffect(() => {
		const g = layer.current
		if (!mapReady || !g) return
		g.clearLayers()
		const t = resolveChartTheme()
		const renderer = L.canvas({ padding: 0.3 })
		for (const c of points) {
			if (c.lat === null || c.lon === null) continue
			const marker = L.circleMarker([c.lat, c.lon], {
				renderer,
				radius: RADIUS[c.sev],
				color: t.card,
				weight: c.sev === 'O' ? 0.5 : 1.5,
				fillColor: t.mode[c.mode],
				fillOpacity: c.sev === 'O' ? 0.55 : 0.9,
			})
			marker.bindPopup(() => popupHtml(c), { maxWidth: 280 })
			marker.on('popupopen', () => setCrash(c.id))
			marker.on('popupclose', () => {
				if (useStore.getState().crash === c.id) setCrash(null)
			})
			marker.addTo(g)
		}
	}, [points, theme, setCrash, mapReady])

	// Permalink: ring the selected crash and open its popup once.
	// biome-ignore lint/correctness/useExhaustiveDependencies: theme re-resolves colors; mapReady gates first draw
	useEffect(() => {
		const m = map.current
		const r = ring.current
		if (!mapReady || !m || !r) return
		r.clearLayers()
		if (!selected || selected.lat === null || selected.lon === null) return
		const t = resolveChartTheme()
		const at: L.LatLngExpression = [selected.lat, selected.lon]
		L.circleMarker(at, {
			pane: 'highlight',
			radius: 14,
			color: t.foreground,
			weight: 2,
			fill: false,
			interactive: false,
		}).addTo(r)
		if (opened.current !== selected.id) {
			opened.current = selected.id
			const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
			m.setView(at, Math.max(m.getZoom(), 16), { animate: !reduce })
			L.popup({ maxWidth: 280 })
				.setLatLng(at)
				.setContent(popupHtml(selected))
				.openOn(m)
		}
	}, [selected, theme, mapReady])

	if (!view)
		return (
			<ChartCard title="Where crashes happen" loading>
				{null}
			</ChartCard>
		)
	const t = resolveChartTheme()
	const span = periodSpan(view.period, view.lastDate)
	const unplaced = view.crashes.filter(
		(c) => (c.lat === null || c.lon === null) && passes(c, measure),
	).length

	return (
		<ChartCard
			id="map"
			title="Where crashes happen"
			subtitle={`${fmtInt(points.length)} ${MEASURE_LABEL[measure === 'people' ? 'injury' : measure].toLowerCase()}, ${span}${view.period.partial ? `, ${view.year}` : ''} · click a dot for details`}
			legend={
				<div className="flex flex-wrap items-center gap-x-6 gap-y-1">
					<Legend
						items={(['veh', 'ped', 'bike'] as const).map((m) => ({
							key: m,
							label: MODE_LABEL[m],
							swatch: t.mode[m],
						}))}
					/>
					<span className="flex items-center gap-2 text-xs text-muted-foreground">
						Size:
						<span
							className="inline-block size-1.5 rounded-full bg-muted-foreground"
							aria-hidden
						/>{' '}
						no injury
						<span
							className="inline-block size-2.5 rounded-full bg-muted-foreground"
							aria-hidden
						/>{' '}
						injury
						<span
							className="inline-block size-4 rounded-full bg-muted-foreground"
							aria-hidden
						/>{' '}
						fatal or serious
					</span>
				</div>
			}
			caption={
				unplaced > 0
					? `${fmtInt(unplaced)} crash${unplaced === 1 ? '' : 'es'} in this view had no usable location and ${unplaced === 1 ? 'is' : 'are'} not drawn.`
					: undefined
			}
		>
			<div
				ref={el}
				className="isolate h-[480px] w-full overflow-hidden rounded-md border border-border"
				role="region"
				aria-label="Map of crash locations"
			/>
		</ChartCard>
	)
}
