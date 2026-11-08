# Oak Park Crash Explorer

**➡️ Live dashboard: https://jvanderberg.github.io/oak-park-crashes/**

Every traffic crash the Oak Park Police Department has reported since
January 2024, plus twelve years of Illinois Department of Transportation
(IDOT) crash data, in one place: who gets hurt, where, why, and whether it's
getting better. The data refreshes automatically every day.

## What's in the dashboard

- **Headline numbers** — crashes, injury crashes, crashes that killed or
  seriously injured someone, and people hurt, each compared with *the same
  dates a year earlier* (so a year in progress is never compared with a
  whole year).
- **Who gets hurt** — the share of harm by who was involved (vehicles only,
  pedestrian, bicycle) and how often each kind of crash injures someone.
- **Year-to-date pace** — running totals for each year on a shared
  Jan 1 → Dec 31 axis.
- **Month by month** — stacked by mode.
- **Map** — every crash with a location; color = mode, size = severity.
  The card lists every filter in effect. **Full screen** pops the map out
  under the page's filter bar, with the more-filters form in a side panel.
  Click a dot for the full record; every crash has a shareable permalink.
- **Where / Why** — top intersections and corridors, and the officer's
  primary contributing cause.
- **Twelve years of IDOT data (2014 →)** — annual totals with the Vision Zero
  plan's 2018–2022 baseline shaded, with or without crashes on I-290.

Filters apply to everything on the page: year · who · what to count, plus
**More filters** — weekday/weekend, time of day, street, primary cause and
hit-and-run. (The twelve-year IDOT chart can't filter by street: IDOT's
files have no street names.) Every filter lives in the URL — as does the
full-screen map — so any view can be shared.

## Where the data comes from

| Source | What | Years |
|---|---|---|
| [Village of Oak Park Traffic Crash Dashboard](https://opendata.oak-park.us/TrafficCrash) | Every OPPD crash report on a public roadway in the Village, pulled row-by-row from the public Power BI model behind the Village's dashboard | 2024 → (≈ weekly) |
| [IDOT statewide crash data](https://www.arcgis.com/home/search.html?q=owner%3AIDOTAdmin%20crashes) | IDOT's annual crash files, filtered to Oak Park | 2014 → newest IDOT year |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) (via the Overpass API) | Streets, rail, parks and the Village boundary for the map | — |

The map is drawn entirely from OpenStreetMap geometry baked into a static
file — no tile server and no API key. Map data © OpenStreetMap contributors,
available under the Open Database License.

**The two crash sources count different things and are never added
together.** The Village data has every Oak Park PD report, including minor
fender-benders, but not crashes worked by the State Police on I-290. IDOT
covers every agency, including I-290, but only state-reportable crashes (an
injury or death, or property damage over $1,500 — $500 if a vehicle is
uninsured; 625 ILCS 5/11-407), and finalizes each year months after it ends.

## Why these numbers can be trusted

- **Fetched verbatim.** Every upstream table is saved exactly as received in
  [`data/raw/`](data/raw), with its URL, query and fetch time.
- **Checked against the Village's own totals.** The Village dashboard
  publishes a "Total Accidents" count for every year and severity. The build
  re-derives each of those numbers from the raw rows and **fails if any
  differs** — so a partial or broken pull can never ship. The checks are
  shown in the dashboard's `?` panel.
- **Cross-checked against IDOT.** Village case numbers match IDOT's agency
  report numbers for ~95% of the crashes IDOT credits to the Oak Park PD
  (946 of 995 in 2024; 919 of 966 in 2025). On matched crashes the severity,
  mode, weather, lighting, road-surface and traffic-control values agree
  >99% of the time, and the primary cause ~96%.
- **Codes decoded from IDOT's own labels.** The Village export carries bare
  SR 1050 codes (weather `8`, lighting `5`, …). IDOT's files publish each code
  beside its label, so the code tables in [`data/codebook.json`](data/codebook.json)
  are derived from IDOT's rows, not typed in by hand. Codes IDOT never labels
  stay visible as "Code N (undocumented)".
- **Tests on the math.** Vitest covers the same-period comparison (including
  leap years), shares, series, the Power BI decoder, code-table derivation,
  and an end-to-end audit that decodes exactly what the browser loads and
  re-matches the Village totals.

Every known caveat — the two sources' coverage, crash-vs-person counting,
how "pedestrian" and "bicycle" are classified, missing coordinates, quirks
in IDOT's files — is listed in the dashboard's `?` panel and in
[`data/manifest.json`](data/manifest.json).

## The data files

| File | Contents |
|---|---|
| [`data/village_crashes.csv`](data/village_crashes.csv) | One row per Oak Park PD crash, decoded |
| [`data/idot_crashes.csv`](data/idot_crashes.csv) | One row per IDOT crash in Oak Park, decoded |
| [`data/codebook.json`](data/codebook.json) | SR 1050 code → label tables and any ambiguities |
| [`data/manifest.json`](data/manifest.json) | Sources, fetch times, row counts, checks, known issues |
| [`data/raw/`](data/raw) | Every upstream table exactly as fetched |

### CSV columns

Both CSVs share these columns:

| Column | Meaning |
|---|---|
| `id` | Village `tamainid` / IDOT `ICN` (unique per crash) |
| `date`, `hour` | Local date (YYYY-MM-DD) and hour (0–23) |
| `sev` | Most severe injury in the crash, KABCO: `K` fatal, `A` incapacitating ("serious"), `B` non-incapacitating, `C` possible, `O` none, `U` unknown |
| `mode` | `ped` / `bike` when the first harmful event struck a pedestrian / cyclist, else `veh` |
| `type` | Type of first crash (Angle, Front To Rear, Pedestrian, …) |
| `k`, `a`, `b`, `c` | Number of **people** killed / seriously / moderately / possibly injured |
| `hitRun` | Hit and run (Y/N) |
| `cause1`, `cause2` | Primary / secondary contributing cause |
| `light`, `weather`, `surface`, `control` | Lighting, weather, road surface, traffic control device |
| `lat`, `lon` | WGS84 coordinates (blank when unusable) |

Village-only: `report` (police report number), `idotNo` (IDOT crash
number), `location`, `street`, `cross` (street names without N/S/E/W
prefix), `atIntersection`. IDOT-only: `agency`, `agencyReport`,
`interstate` (on I-290 or its ramps, by IDOT road class), `roadClass`.

## Repo layout

```
extract/                 data pipeline (Node 22, TypeScript, no dependencies)
  powerbi.ts             client + decoder for the Village's public Power BI model
  fetch-village.ts       Village tables + the dashboard's published totals
  fetch-idot.ts          IDOT annual crash layers, filtered to Oak Park
  fetch-osm.ts           OpenStreetMap basemap geometry (Overpass API)
  codebook.ts            SR 1050 code tables derived from IDOT's labels
  basemap.ts             compact static basemap for the map
  build.ts               decode, normalize, verify → CSVs + app data
data/                    decoded CSVs, code tables, manifest, raw snapshots
dashboard/               Vite + React 19 + TypeScript + Plotly + Leaflet app
.github/workflows/       daily refresh → check → test → build → deploy
```

## Development

```bash
cd dashboard
npm install
npm run data:refresh   # fetch upstream data + rebuild (optional; data is committed)
npm run check          # biome + tsc (app and extract)
npm run test           # vitest
npm run dev
```

`npm run data:build` rebuilds from the committed raw snapshots without
fetching. IDOT history and the OSM basemap are only re-fetched when missing;
`node ../extract/fetch-idot.ts --all` and `node ../extract/fetch-osm.ts --all`
force a full re-pull.

The [workflow](.github/workflows/refresh-deploy.yml) refreshes the data
daily, runs every check, commits any changed data, and deploys to GitHub
Pages. If an upstream source is down or changes shape, the build fails and
the last good version stays live.

Not affiliated with the Village of Oak Park or IDOT.
