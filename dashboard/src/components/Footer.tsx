import { DOWNLOADS, REPO_URL } from '@/lib/links'
import { useStore } from '@/lib/store'

export function Footer() {
	const manifest = useStore((s) => s.manifest)
	return (
		<footer className="border-t border-border bg-card">
			<div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 text-xs text-muted-foreground md:grid-cols-2">
				<div>
					<h2 className="mb-1 text-sm font-semibold text-foreground">
						Get the data
					</h2>
					<ul className="space-y-1">
						{DOWNLOADS.map((d) => (
							<li key={d.href}>
								<a
									href={d.href}
									className="font-medium text-primary underline underline-offset-2"
									target="_blank"
									rel="noreferrer"
								>
									{d.label}
								</a>{' '}
								— {d.note}
							</li>
						))}
					</ul>
				</div>
				<div>
					<h2 className="mb-1 text-sm font-semibold text-foreground">
						Sources
					</h2>
					<p>
						Crash reports:{' '}
						<a
							href={
								manifest?.sources.village.url ??
								'https://opendata.oak-park.us/TrafficCrash'
							}
							className="text-primary underline underline-offset-2"
							target="_blank"
							rel="noreferrer"
						>
							Village of Oak Park Traffic Crash Dashboard
						</a>
						. History:{' '}
						<a
							href={manifest?.sources.idot.url ?? '#'}
							className="text-primary underline underline-offset-2"
							target="_blank"
							rel="noreferrer"
						>
							Illinois Department of Transportation crash data
						</a>
						. Not affiliated with the Village of Oak Park or IDOT. Refreshed
						automatically; code and method on{' '}
						<a
							href={REPO_URL}
							className="text-primary underline underline-offset-2"
							target="_blank"
							rel="noreferrer"
						>
							GitHub
						</a>
						.
					</p>
				</div>
			</div>
		</footer>
	)
}
