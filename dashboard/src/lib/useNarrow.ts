import { useEffect, useState } from 'react'

const QUERY = '(max-width: 639px)'

/** True on phone-width screens, where charts drop direct labels and use
 * shorter ticks (the legend, caption and table carry the values). */
export function useNarrow(): boolean {
	const [narrow, setNarrow] = useState(
		() => typeof matchMedia !== 'undefined' && matchMedia(QUERY).matches,
	)
	useEffect(() => {
		const mq = matchMedia(QUERY)
		const on = () => setNarrow(mq.matches)
		mq.addEventListener('change', on)
		return () => mq.removeEventListener('change', on)
	}, [])
	return narrow
}
