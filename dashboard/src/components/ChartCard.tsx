import { Skeleton } from '@/components/ui/skeleton'
import { ChevronRight } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'

/** Card chrome shared by every chart: title, subtitle, controls row, the
 * plot, a caption, and a collapsible table view carrying every value. */
export function ChartCard({
	title,
	subtitle,
	controls,
	legend,
	children,
	caption,
	table,
	loading,
	id,
}: {
	title: string
	subtitle?: ReactNode
	controls?: ReactNode
	legend?: ReactNode
	children: ReactNode
	caption?: ReactNode
	table?: ReactNode
	loading?: boolean
	id?: string
}) {
	const [open, setOpen] = useState(false)
	const tableId = useId()
	if (loading) {
		return (
			<section className="rounded-md border border-border bg-card p-4 shadow-sm">
				<Skeleton className="h-4 w-56" />
				<Skeleton className="mt-2 h-3 w-72" />
				<Skeleton className="mt-4 h-[300px] w-full" />
			</section>
		)
	}
	return (
		<section
			id={id}
			className="rounded-md border border-border bg-card p-4 shadow-sm"
			aria-label={title}
		>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<h2 className="text-sm font-semibold">{title}</h2>
					{subtitle && (
						<p className="text-xs text-muted-foreground">{subtitle}</p>
					)}
				</div>
				{controls && <div className="flex flex-wrap gap-2">{controls}</div>}
			</div>
			{legend && <div className="mt-2">{legend}</div>}
			<div className="mt-2">{children}</div>
			{caption && (
				<p className="mt-1 text-[0.7rem] text-muted-foreground">{caption}</p>
			)}
			{table && (
				<div className="mt-2">
					<button
						type="button"
						className="flex items-center gap-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-expanded={open}
						aria-controls={tableId}
						onClick={() => setOpen((o) => !o)}
					>
						<ChevronRight
							className={`size-3.5 motion-safe:transition-transform ${open ? 'rotate-90' : ''}`}
							aria-hidden
						/>
						{open ? 'Hide table' : 'Show as table'}
					</button>
					{open && (
						<div
							id={tableId}
							className="thin-scroll mt-2 max-h-80 overflow-auto"
						>
							{table}
						</div>
					)}
				</div>
			)}
		</section>
	)
}

/** Legend row: a swatch beside each name — text stays in text ink. */
export function Legend({
	items,
}: {
	items: Array<{ key: string; label: string; swatch: string; line?: boolean }>
}) {
	return (
		<ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
			{items.map((i) => (
				<li key={i.key} className="flex items-center gap-1.5">
					<span
						className={
							i.line ? 'h-0.5 w-3.5 rounded-full' : 'size-2.5 rounded-sm'
						}
						style={{ background: i.swatch }}
						aria-hidden
					/>
					{i.label}
				</li>
			))}
		</ul>
	)
}

/** Plain numeric table for the "Show as table" view. */
export function SeriesTable({
	head,
	rows,
}: {
	head: string[]
	rows: Array<Array<string | number>>
}) {
	return (
		<table className="w-full text-xs tabular-nums">
			<thead className="sticky top-0 bg-muted text-muted-foreground">
				<tr>
					{head.map((h, i) => (
						<th
							key={h}
							className={`px-2 py-1 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}
						>
							{h}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows.map((r) => (
					<tr key={String(r[0])} className="border-b border-border">
						{r.map((v, i) => (
							<td
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed column order
								key={i}
								className={`px-2 py-1 ${i === 0 ? 'text-left' : 'text-right'}`}
							>
								{typeof v === 'number' ? v.toLocaleString('en-US') : v}
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	)
}
