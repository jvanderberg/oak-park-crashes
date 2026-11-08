import { Controls } from '@/components/Controls'
import { CrashMap } from '@/components/CrashMap'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Kpis } from '@/components/Kpis'
import { LongView } from '@/components/LongView'
import { MonthlyChart } from '@/components/MonthlyChart'
import { PaceChart } from '@/components/PaceChart'
import { Rankings } from '@/components/Rankings'
import { WhoGetsHurt } from '@/components/WhoGetsHurt'
import { Button } from '@/components/ui/button'
import { SYSTEM_THEME, urlStateOf, useStore } from '@/lib/store'
import { writeUrl } from '@/lib/url'
import { useEffect } from 'react'

export default function App() {
	const status = useStore((s) => s.status)
	const error = useStore((s) => s.error)
	const load = useStore((s) => s.load)

	useEffect(() => {
		load()
	}, [load])

	// Persist view state to the URL (debounced replaceState — back button
	// stays useful).
	useEffect(() => {
		let id: ReturnType<typeof setTimeout> | undefined
		const unsub = useStore.subscribe((s) => {
			clearTimeout(id)
			id = setTimeout(() => writeUrl(urlStateOf(s), SYSTEM_THEME), 200)
		})
		const onPop = () => useStore.getState().onPopState()
		addEventListener('popstate', onPop)
		return () => {
			unsub()
			clearTimeout(id)
			removeEventListener('popstate', onPop)
		}
	}, [])

	return (
		<div className="min-h-dvh">
			<a
				href="#map"
				className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[2000] focus:rounded focus:bg-card focus:px-2 focus:py-1 focus:text-sm"
			>
				Skip to map
			</a>
			<Header />
			<main className="mx-auto max-w-6xl space-y-4 px-4 pb-8">
				{status === 'error' ? (
					<div className="pt-5">
						<ErrorCard
							message={error?.message}
							url={error?.url}
							status={error?.status}
							onRetry={load}
						/>
					</div>
				) : (
					<>
						<Controls />
						<Kpis />
						<div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
							<WhoGetsHurt />
							<PaceChart />
						</div>
						<MonthlyChart />
						<CrashMap />
						<Rankings />
						<LongView />
					</>
				)}
			</main>
			<Footer />
		</div>
	)
}

function ErrorCard({
	message,
	url,
	status,
	onRetry,
}: {
	message?: string
	url?: string
	status?: number
	onRetry: () => void
}) {
	return (
		<div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
			<h2 className="text-sm font-semibold text-destructive">
				Couldn't load the data
			</h2>
			<p className="mt-1 text-xs text-muted-foreground">{message}</p>
			{url && (
				<p className="mt-1 break-all text-[0.7rem] text-muted-foreground">
					{status ? `HTTP ${status} · ` : ''}
					{url}
				</p>
			)}
			<Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
				Retry
			</Button>
		</div>
	)
}
