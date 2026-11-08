import { Button } from '@/components/ui/button'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover'
import { fmtDate, fmtInt } from '@/lib/format'
import { REPO_URL } from '@/lib/links'
import { useStore } from '@/lib/store'
import { CircleHelp } from 'lucide-react'

/**
 * The honesty panel: every source with a link, the method, the end-to-end
 * checks against the Village's published totals, and a frank list of known
 * issues — rendered from the manifest, never hardcoded.
 */
export function InfoPopover() {
	const manifest = useStore((s) => s.manifest)

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="outline" size="icon" aria-label="About the data">
					<CircleHelp />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="max-h-[75vh] w-[26rem] max-w-[92vw] overflow-y-auto"
			>
				{manifest ? (
					<div className="space-y-3 text-xs">
						<section>
							<h3 className="mb-1 text-sm font-semibold">Sources</h3>
							<ul className="space-y-2">
								<li>
									<a
										href={manifest.sources.village.url}
										target="_blank"
										rel="noreferrer"
										className="font-medium text-primary underline underline-offset-2"
									>
										{manifest.sources.village.title}
									</a>
									<p className="text-muted-foreground">
										{manifest.sources.village.description}{' '}
										{fmtInt(manifest.sources.village.rows)} crashes,{' '}
										{fmtDate(manifest.sources.village.firstDate)} –{' '}
										{fmtDate(manifest.sources.village.lastDate)}.
									</p>
								</li>
								<li>
									<a
										href={manifest.sources.idot.url}
										target="_blank"
										rel="noreferrer"
										className="font-medium text-primary underline underline-offset-2"
									>
										{manifest.sources.idot.title}
									</a>
									<p className="text-muted-foreground">
										{manifest.sources.idot.description}{' '}
										{manifest.sources.idot.years[0]?.year}–
										{manifest.sources.idot.years.at(-1)?.year},{' '}
										{fmtInt(
											manifest.sources.idot.years.reduce(
												(s, y) => s + y.rows,
												0,
											),
										)}{' '}
										crashes.
									</p>
								</li>
							</ul>
						</section>
						<section>
							<h3 className="mb-1 text-sm font-semibold">Method</h3>
							<p className="text-muted-foreground">{manifest.method}</p>
						</section>
						<section>
							<h3 className="mb-1 text-sm font-semibold">
								Checked against the Village’s published totals
							</h3>
							<table className="w-full tabular-nums">
								<thead className="text-muted-foreground">
									<tr className="border-b border-border">
										<th className="py-0.5 text-left font-medium">Year</th>
										<th className="py-0.5 text-left font-medium">Severity</th>
										<th className="py-0.5 text-right font-medium">Village</th>
										<th className="py-0.5 text-right font-medium">This site</th>
									</tr>
								</thead>
								<tbody>
									{manifest.checks.map((c) => (
										<tr
											key={`${c.year}-${c.severity}`}
											className="border-b border-border/60"
										>
											<td className="py-0.5">{c.year}</td>
											<td className="py-0.5">{c.severity}</td>
											<td className="py-0.5 text-right">
												{fmtInt(c.published)}
											</td>
											<td className="py-0.5 text-right">
												{fmtInt(c.derived)}{' '}
												{c.derived === c.published ? '✓' : '✗'}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							<p className="mt-1 text-muted-foreground">
								Cross-check with IDOT: of the crashes IDOT credits to Oak Park
								police,{' '}
								{Object.entries(manifest.crossSource)
									.map(
										([y, m]) =>
											`${fmtInt(m.matched)} of ${fmtInt(m.idotCity)} (${y})`,
									)
									.join(' and ')}{' '}
								match a Village report by case number.
							</p>
						</section>
						<section>
							<h3 className="mb-1 text-sm font-semibold">Known issues</h3>
							<ul className="list-disc space-y-1 pl-4 text-muted-foreground">
								{manifest.known_issues.map((issue) => (
									<li key={issue}>{issue}</li>
								))}
							</ul>
						</section>
						<section>
							<h3 className="mb-1 text-sm font-semibold">Download the data</h3>
							<p className="text-muted-foreground">
								Decoded CSVs, the raw snapshots, and the code that builds them
								are on{' '}
								<a
									href={REPO_URL}
									target="_blank"
									rel="noreferrer"
									className="text-primary underline underline-offset-2"
								>
									GitHub
								</a>
								.
							</p>
						</section>
						<p className="border-t border-border pt-2 text-muted-foreground">
							Built {fmtDate(manifest.generatedAt.slice(0, 10))} · Village data
							refreshed{' '}
							{fmtDate(manifest.sources.village.sourceUpdatedAt?.slice(0, 10))}
						</p>
					</div>
				) : (
					<p className="text-xs text-muted-foreground">Loading manifest…</p>
				)}
			</PopoverContent>
		</Popover>
	)
}
