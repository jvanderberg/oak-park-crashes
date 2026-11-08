import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Compose Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}
