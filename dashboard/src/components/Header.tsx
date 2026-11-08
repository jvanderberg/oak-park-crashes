import { InfoPopover } from '@/components/InfoPopover'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fmtDate } from '@/lib/format'
import { useStore } from '@/lib/store'
import { Check, Moon, Share2, Sun } from 'lucide-react'
import { useRef, useState } from 'react'

export function Header() {
	const manifest = useStore((s) => s.manifest)
	const theme = useStore((s) => s.theme)
	const toggleTheme = useStore((s) => s.toggleTheme)
	const last = manifest?.sources.village.lastDate

	return (
		<header className="border-b border-border bg-card">
			<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="text-base font-semibold leading-tight">
							Oak Park Crash Explorer
						</h1>
						{last && (
							<Badge variant="muted">Data through {fmtDate(last)}</Badge>
						)}
					</div>
					<p className="text-xs text-muted-foreground">
						Every Oak Park police crash report since 2024, plus IDOT crash data
						back to 2014 · counts checked against the Village’s published totals
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					<ShareViewButton />
					<Button
						variant="outline"
						size="icon"
						aria-label={
							theme === 'dark'
								? 'Switch to light theme'
								: 'Switch to dark theme'
						}
						aria-pressed={theme === 'dark'}
						onClick={toggleTheme}
					>
						{theme === 'dark' ? <Sun /> : <Moon />}
					</Button>
					<InfoPopover />
				</div>
			</div>
		</header>
	)
}

function ShareViewButton() {
	const [copied, setCopied] = useState(false)
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
	return (
		<Button
			variant="outline"
			size="sm"
			onClick={() => {
				navigator.clipboard?.writeText(location.href)
				setCopied(true)
				if (timer.current) clearTimeout(timer.current)
				timer.current = setTimeout(() => setCopied(false), 1800)
			}}
		>
			{copied ? <Check /> : <Share2 />}
			<span className="hidden sm:inline">
				{copied ? 'Copied' : 'Share this view'}
			</span>
		</Button>
	)
}
