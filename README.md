# Where are the schools?

A configurable map for analysing Victorian schools: where they are, who attends, how they are
zoned and the places around them. Layers can be stacked in any order, each drawing one dataset
in a chosen way.

## Run

Requires Node.js 22.12+ (or 24+), npm and Python 3.

```sh
npm ci
npm run data   # fetch every source, then build public/data
npm run dev
```

Open http://localhost:5173. The data is not in the repository; `npm run data` downloads it from the
publishers and builds the JSON the site reads. Run it again whenever you want newer releases.

A local geographic preview works without a Mapbox token, with every layer but no street basemap. To
enable Mapbox, copy `.env.example` to `.env.local` and set:

```dotenv
VITE_MAPBOX_ACCESS_TOKEN=pk.your_public_mapbox_token
```

Restart Vite. Use a public browser token with appropriate URL restrictions. Vite exposes `VITE_*`
variables to the browser, so do not use a secret token.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which fetches every source, builds the data,
runs the tests and publishes the site to GitHub Pages. It also runs every Sunday at 18:00 UTC to
pick up new releases, and can be started by hand from the Actions tab. The fetch runs with
`--strict`, so a source that cannot be reached stops the deploy instead of publishing a map
without it.

- ACARA's School Profile is left out of the published site. The My School terms of use do not
  allow it on a public website without ACARA's written permission. Once that permission is
  granted, set the repository variable `PUBLISH_ACARA` to `true` and run the workflow again.
- The education department no longer serves the school zone ZIPs, so the workflow downloads them
  from the `data-inputs` release, where each is attached as `school-zones-<year>.zip`. To add a
  zone year, attach its ZIP there.
- The build job runs in the `dev` environment and reads the Mapbox token from its
  `VITE_MAPBOX_ACCESS_TOKEN` variable.

`BASE_PATH` sets the subpath every asset and data file is requested under, with a trailing slash
(`BASE_PATH=/viclens/ npm run build`). The workflow takes it from the Pages configuration.

## Data

`npm run data` runs two steps, which can also be run on their own:

```sh
npm run data:fetch                                   # download into data/sources/
python3 scripts/fetch_data.py --only school-zones    # one source
python3 scripts/fetch_data.py --refresh              # download even if unchanged
npm run data:build                                   # build public/data/ from data/sources/, offline
```

The fetch finds the newest edition of each yearly series through the publishers' own catalogues,
skips files that have not changed, and keeps the last good copy when a download fails. Both
`data/sources/` and `public/data/` are ignored by git. `public/data/report.json` records, for every
source, where it came from, when it was fetched, its hash and whether it is current.

The education department's old file host (`www.education.vic.gov.au/Documents/`) stopped serving
files in 2026, and the school zone ZIPs are still only there. Until they move, place a zones ZIP
from DataVic at `data/sources/school-zones/<year>.zip` and the build uses it as is. See
[data/SOURCES.md](data/SOURCES.md) for every source, its licence and its caveats.

## Explore

- Search names, towns, school numbers, addresses and postcodes, and filter by school type,
  sector, education region or enrolment data.
- Open **Map layers** and add as many layers as you need. Each one draws a dataset (schools,
  enrolment zones, local government areas, SA2 statistical areas or public transport stops) in
  one of its displays: points coloured by a category, graduated colour, proportional circles, a
  heatmap, hexagon bins, boundaries or a choropleth.
- Choose what a display encodes: enrolments and their change since an earlier census, ICSEA and
  the advantage quarters, students per teacher, staff, student mix, transport stops nearby, fire
  risk listings, SEIFA deciles, population and school-age change, Census school attendance by
  sector, or totals of the filtered schools in each area.
- Drag a layer by its grip (or pick it up with Space and move it with the arrow keys) to change
  what draws on top. Each layer has its own visibility, opacity and size, and the arrangement is
  kept between visits.
- Click a school for its enrolments by year level, ACARA profile, transport access and zones.
  Click a council or SA2 area, or pick one in its layer's settings, for schools by sector,
  population and SEIFA deciles.
- The legend follows the visible layers in list order. The result list remains a
  keyboard-accessible way to reach any school.
- Switch between the light and dark scheme in the panel footer. Colour ramps flip with the scheme
  so the high end always stands out.
- On a phone the explorer opens as a drawer from the floating button, and a selected school rests
  on the lower third of the map without dimming it.

## Stack

React 19, TypeScript, Vite 8 and its Oxc transforms, `@vitejs/plugin-react` 6, Oxlint and Oxfmt. Jotai holds the explorer state, so filters, the layer list, the selection and the map camera are read by whichever component needs them rather than passed down the tree. TanStack Query loads the JSON files and owns their caching, loading and error states. `es-toolkit` handles sorting, deduplication and aggregation. Motion animates what CSS cannot reach: content crossfading as the selection changes, panel heights, and the map's viewport padding. deck.gl owns the map camera and visualization layers, with `@deck.gl/aggregation-layers` for heatmaps and hexagon bins, and `react-map-gl` supplies the Mapbox basemap using the [documented reverse-controlled integration](https://deck.gl/docs/developer-guide/base-maps/using-with-mapbox). [Vite 8](https://vite.dev/blog/announcing-vite8) and [HeroUI setup](https://heroui.com/en/docs/react/getting-started/quick-start) informed the project setup.

HeroUI 3 supplies the buttons, fields and switches, and publishes its palette, radii and shadows as Tailwind 4 theme variables. Layout and data displays are written as Tailwind utilities against those variables. `src/styles.css` holds the project tokens, the base body and reduced-motion rules, the `glass` utility for floating panels, the panel enter and exit animations, the slide of the map cards beside the detail panel, and the layer row states. Inter is bundled with the app through `@fontsource-variable/inter`, so no request goes to a font CDN.

The basemap has to be a direct child of `DeckGL`. deck.gl identifies it by its `mapStyle` prop, clones the current viewport into it and places it behind the deck canvas. Wrapping it in `Suspense` or any other element hides it from that check, which leaves the basemap on its own default camera and painted over every data layer. Its projection is pinned to mercator: Mapbox styles otherwise curve into a globe below about zoom 6, while deck.gl only projects Web Mercator, so the points drift away from the coastline underneath them.

The system colour scheme is read into a Jotai atom that starts from `matchMedia`'s current answer. Jotai 3's `useAtomValue` subscribes in an effect and does not read the atom again afterwards. If the atom only learned the device's scheme when the first component mounted it, components that subscribed after that would stay on the old value, which is how a dark device used to get a light app.

Enrolment zones draw their fill through `PolygonFillLayer`, a small subclass of deck.gl's `SolidPolygonLayer`. deck.gl 9.4.0 gives the fill model a vertex count, but luma.gl 9.4 sizes indexed draws by an index count and otherwise draws the whole index buffer. deck.gl never shrinks that buffer, so once a search narrowed the zones, the fill kept drawing leftover statewide triangles across the map. The subclass sets the index count. Check whether it is still needed when deck.gl is upgraded.

Layers are plain settings objects in `src/layers/`. `model.ts` defines the datasets, their displays and the options each display uses, and normalises every stored layer against them, so an old or hand-edited arrangement cannot name a field that no longer exists. `fields.ts` is the catalogue of measures, `scales.ts` classifies values, and `palettes.ts` builds the ramps in OKLCH. `useLayerViews.ts` turns each layer into its data, state and encoding once for the whole app; the map (`deckLayers.ts`), the legend and the layer list all read those views. Encodings are cached on everything except visibility and opacity, so dragging an opacity slider does not rebuild a scale. dnd-kit reorders the list by pointer, touch and keyboard, with its own announcements.

`mapbox-gl` stays in its own chunk. react-map-gl imports it dynamically when the map mounts, which happens only when a token is set. Each layer's data loads when the layer is first shown, and a zone layer loads only its own year and level. A production server should enable gzip/Brotli for the GeoJSON responses.

## Data and limitations

FTE is full-time equivalent, not necessarily headcount. Schools join across sources on their
school number and sector wherever a source carries them: enrolments directly, zones through the
school number inside each zone's entity code, and ACARA's profile through the state school
identifier in the Australian Schools List. The fire risk registers name facilities only, so they
join on exact name and town, and campuses that are not separate schools stay unmatched.
`public/data/report.json` lists every unmatched record.

ACARA reports multi-campus schools as one, so a campus can carry its whole school's profile; the
detail panel says when. ICSEA describes a school's families and SEIFA describes an area's
residents, so the two measure different populations. SEIFA is from the 2021 Census and stays
current until the 2026 Census results arrive. Area totals built from schools follow the filters;
the area card always counts every school in the area. Education regions are school attributes, not
boundaries. Zones are an exploration aid; eligibility is confirmed by the school or Find my School.
