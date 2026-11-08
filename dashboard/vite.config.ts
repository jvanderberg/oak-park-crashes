import { URL, fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
// vitest/config re-exports Vite's defineConfig with the `test` field typed.
import { defineConfig } from 'vitest/config'

// Static SPA. `base: './'` keeps asset paths relative so the built
// folder deploys under any path (GitHub Pages project sites, S3 prefixes).
export default defineConfig({
	base: './',
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	build: {
		// Plotly (basic dist) dwarfs the app code — give it its own chunk so
		// app changes don't invalidate the chart library in visitors' caches.
		rollupOptions: {
			output: {
				manualChunks: { plotly: ['plotly.js-basic-dist-min'] },
			},
		},
		chunkSizeWarningLimit: 1500,
	},
	test: {
		environment: 'node',
		include: ['test/**/*.test.ts'],
	},
})
