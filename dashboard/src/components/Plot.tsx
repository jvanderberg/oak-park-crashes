// Single Plotly entry point for the whole app: the basic bundle (bar +
// scatter only, ~1MB min vs ~4MB for full plotly.js) wired through the
// react-plotly.js factory so the full library never enters the bundle.

import Plotly from 'plotly.js-basic-dist-min'
import createPlotlyComponent from 'react-plotly.js/factory'

export const Plot = createPlotlyComponent(Plotly)

/** Shared config: no mode bar, resize with the container. */
export const PLOT_CONFIG = { displayModeBar: false, responsive: true } as const
