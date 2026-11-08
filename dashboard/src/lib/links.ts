export const REPO_URL = 'https://github.com/jvanderberg/oak-park-crashes'
const RAW = `${REPO_URL}/blob/main/data`

export const DOWNLOADS = [
	{
		label: 'Village crashes (CSV)',
		href: `${RAW}/village_crashes.csv`,
		note: 'one row per Oak Park PD crash report, 2024 →',
	},
	{
		label: 'IDOT crashes (CSV)',
		href: `${RAW}/idot_crashes.csv`,
		note: 'one row per IDOT crash in Oak Park, 2014 →',
	},
	{
		label: 'Code tables (JSON)',
		href: `${RAW}/codebook.json`,
		note: 'SR 1050 code → label, derived from IDOT',
	},
	{
		label: 'Raw snapshots',
		href: `${REPO_URL}/tree/main/data/raw`,
		note: 'every upstream table exactly as fetched',
	},
] as const
