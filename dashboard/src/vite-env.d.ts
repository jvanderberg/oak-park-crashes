/// <reference types="vite/client" />

// plotly.js-basic-dist-min ships no types; it is API-compatible with the
// plotly.js surface we use (bar + scatter), so alias the @types/plotly.js
// definitions onto it.
declare module 'plotly.js-basic-dist-min' {
	import * as Plotly from 'plotly.js'
	export = Plotly
}
