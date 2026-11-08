// Policy milestones drawn as reference lines. Only dates with a citable
// source belong here.

export interface Milestone {
	/** ISO date. */
	date: string
	label: string
	source: string
}

export const MILESTONES: Milestone[] = [
	{
		date: '2025-02-18',
		label: 'Vision Zero plan adopted',
		source:
			'https://www.oakpark.com/2025/02/19/oak-park-vision-zero-plan-approved/',
	},
	{
		date: '2025-07-22',
		label: 'Bike plan adopted',
		source:
			'https://www.oakpark.com/2025/07/23/oak-park-oks-wide-ranging-bike-plan-including-harvard-st/',
	},
]

/** Vision Zero Action Plan's crash-analysis years (2018–2022). */
export const VISION_ZERO_BASELINE = { from: 2018, to: 2022 }
