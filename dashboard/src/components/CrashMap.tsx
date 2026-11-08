import { ChartCard } from '@/components/ChartCard'
import { Controls } from '@/components/Controls'
import {
	AppliedFilters,
	MapFilterPod,
	MapLegend,
} from '@/components/MapFilterPod'
import { Button } from '@/components/ui/button'
import { resolveChartTheme } from '@/lib/colors'
import { weight } from '@/lib/crashes'
import { MAP_NOUN } from '@/lib/filters'
import { fmtDate, fmtHour, fmtInt } from '@/lib/format'
import { useStore } from '@/lib/store'
import {
	MODE_LABEL,
	SEVERITY_LABEL,
	type Severity,
	type VillageCrash,
} from '@/lib/types'
import { useNarrow } from '@/lib/useNarrow'
import { periodSpan, useVillageView } from '@/lib/view'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ArrowLeft, Maximize2 } from 'lucide-react'
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
	const theme = useStore((s) => s.theme)
	const crashId = useStore((s) => s.crash)
	const setCrash = useStore((s) => s.setCrash)
	const mapFull = useStore((s) => s.mapFull)
	const openMapFull = useStore((s) => s.openMapFull)
	const closeMapFull = useStore((s) => s.closeMapFull)
	const measure = useStore((s) => s.measure)
	const narrow = useNarrow()

	const el = useRef<HTMLDivElement | null>(null)
	const expandBtn = useRef<HTMLButtonElement | null>(null)
	const backBtn = useRef<HTMLButtonElement | null>(null)
	const map = useRef<L.Map | null>(null)
	const base = useRef<L.LayerGroup | null>(null)
	const layer = useRef<L.LayerGroup | null>(null)
	const ring = useRef<L.LayerGroup | null>(null)
	const opened = useRef<string | null>(null)
	const [mapReady, setMapReady] = useState(false)
	// The container only exists once data has loaded (before that the card
	// renders its skeleton), so map creation keys off this.
	const hasView = view !== null

	// Crashes under every page filter (the view applies the more-filters),
	// limited to what "Count" counts.
	const shown = useMemo(
		() => (view?.crashes ?? []).filter((c) => weight(c, measure) > 0),
		[view, measure],
	)
	const points = useMemo(
		() =>
			shown
				.filter((c) => c.lat !== null && c.lon !== null)
				.sort((a, b) => DRAW_ORDER[a.sev] - DRAW_ORDER[b.sev]),
		[shown],
	)

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
			zoomControl: false,
			zoomSnap: 0.25,
			scrollWheelZoom: false,
			zoomAnimation: !reduce,
			fadeAnimation: !reduce,
			markerZoomAnimation: !reduce,
		})
		m.fitBounds(OAK_PARK_BOUNDS)
		L.control.zoom({ position: 'topright' }).addTo(m)
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

	// Pop-out: resize the map to its new box, let the wheel zoom (it can't
	// hijack page scrolling when the map is the whole page), and re-frame
	// the Village unless a crash permalink is driving the view.
	useEffect(() => {
		const m = map.current
		if (!mapReady || !m) return
		m.invalidateSize()
		if (mapFull) m.scrollWheelZoom.enable()
		else m.scrollWheelZoom.disable()
		if (!useStore.getState().crash) {
			m.fitBounds(OAK_PARK_BOUNDS, {
				paddingTopLeft: mapFull && !narrow ? [360, 0] : [0, 0],
				paddingBottomRight: mapFull && narrow ? [0, 60] : [0, 0],
				animate: false,
			})
		}
	}, [mapFull, mapReady, narrow])

	// While popped out: lock page scroll, Esc closes (an open popup first),
	// focus moves to the back button and returns to the expand button.
	useEffect(() => {
		if (!mapFull) return
		const root = document.documentElement
		const prev = root.style.overflow
		root.style.overflow = 'hidden'
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return
			const m = map.current
			if (m && el.current?.querySelector('.leaflet-popup')) {
				m.closePopup()
				return
			}
			closeMapFull()
		}
		addEventListener('keydown', onKey)
		backBtn.current?.focus({ preventScroll: true })
		const expand = expandBtn.current
		return () => {
			root.style.overflow = prev
			removeEventListener('keydown', onKey)
			expand?.focus({ preventScroll: true })
		}
	}, [mapFull, closeMapFull])

	if (!view)
		return (
			<ChartCard title="Where crashes happen" loading>
				{null}
			</ChartCard>
		)
	const t = resolveChartTheme()
	const span = periodSpan(view.period, view.lastDate)
	const unplaced = shown.length - points.length
	const countLabel = MAP_NOUN[measure]
	const title = `Where ${countLabel} happened`
	const spanText = `${span}${view.period.partial ? `, ${view.year}` : ''}`

	return (
		<ChartCard
			id="map"
			title={title}
			subtitle={`${fmtInt(points.length)} ${countLabel}, ${spanText} · click a dot for details`}
			controls={
				<Button
					ref={expandBtn}
					variant="outline"
					size="sm"
					onClick={openMapFull}
					aria-label="Open the map full screen"
				>
					<Maximize2 aria-hidden />
					Full screen
				</Button>
			}
			legend={
				<div className="space-y-1.5">
					<AppliedFilters view={view} />
					<MapLegend swatches={t.mode} measure={measure} />
				</div>
			}
			caption={
				unplaced > 0
					? `${fmtInt(unplaced)} crash${unplaced === 1 ? '' : 'es'} in this view had no usable location and ${unplaced === 1 ? 'is' : 'are'} not drawn.`
					: undefined
			}
		>
			{/* Keeps the card's height while the map is popped out. */}
			<div className="h-[480px]">
				<div
					className={
						mapFull
							? 'fixed inset-0 z-50 flex flex-col bg-background'
							: 'relative h-full'
					}
					role={mapFull ? 'dialog' : undefined}
					aria-modal={mapFull || undefined}
					aria-label={mapFull ? 'Crash map, full screen' : undefined}
				>
					{mapFull && (
						<Controls
							variant="map"
							leading={
								<Button
									ref={backBtn}
									variant="outline"
									size="sm"
									className="shrink-0"
									onClick={closeMapFull}
									aria-label="Back to dashboard"
								>
									<ArrowLeft aria-hidden />
									<span>
										Back<span className="hidden sm:inline"> to dashboard</span>
									</span>
								</Button>
							}
						/>
					)}
					<div
						className={
							mapFull
								? 'relative min-h-0 flex-1'
								: 'h-full overflow-hidden rounded-md border border-border'
						}
					>
						{/* Constant className: Leaflet adds its own classes to this
						    node, and a React re-render with a new class string would
						    wipe them. */}
						<div
							ref={el}
							className="isolate h-full w-full"
							role="region"
							aria-label="Map of crash locations"
						/>
						{mapFull && (
							<MapFilterPod
								count={points.length}
								countLabel={countLabel}
								span={spanText}
								swatches={t.mode}
								measure={measure}
								defaultOpen={!narrow}
							/>
						)}
					</div>
				</div>
			</div>
		</ChartCard>
	)
}
