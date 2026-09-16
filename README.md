# Where are the schools?

A map-based explorer for Victorian schools, 2026 enrolment zones, local government areas and February 2025 enrolments.

## Run

Requires Node.js 22.12+ (or 24+) and npm. Python 3 is needed only to regenerate data.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. A local geographic preview works without a Mapbox token, with school points and real zone boundaries. It has no street basemap.

To enable Mapbox, copy `.env.example` to `.env.local` and set:

```dotenv
VITE_MAPBOX_ACCESS_TOKEN=pk.your_public_mapbox_token
```

Restart Vite. Use a public browser token with appropriate URL restrictions. Vite exposes `VITE_*` variables to the browser, so do not use a secret token.

## Explore

- Search names, towns, school numbers, addresses and postcodes.
- Filter by school type, sector, education region or availability of enrolment data.
- Toggle school locations, enrolment zones and LGA boundaries independently.
- Choose primary or secondary year-specific zones, including applicable standalone zones.
- Colour markers by school type or education region; size them by enrolments.
- Click a school or select a search result for FTE totals and a year-level breakdown. The camera flies to the school rather than cutting, and holds still instead when the browser asks for reduced motion.
- Toggle LGAs, then click a boundary or use the accessible area selector for sector totals. School markers take precedence over polygons. When LGAs are enabled, area clicks show LGA totals; turn off LGAs to inspect school zones.
- Use the result list as a keyboard-accessible alternative to canvas picking. Arrow keys move through it and the open school stays marked.
- Switch between the light and dark scheme in the panel footer. The choice is remembered, and the basemap follows it.
- On a phone the explorer opens as a drawer from the floating button, and a selected school rests on the lower third of the map without dimming it.

## Stack

React 19, TypeScript, Vite 8 and its Oxc transforms, `@vitejs/plugin-react` 6, Oxlint and Oxfmt. Jotai holds the explorer state, so filters, layer toggles, the selection and the map camera are read by whichever component needs them rather than passed down the tree. TanStack Query loads the JSON files and owns their caching, loading and error states. `es-toolkit` handles sorting, deduplication and aggregation. Motion animates what CSS cannot reach: content crossfading as the selection changes, panel heights, and the map's viewport padding. deck.gl owns the map camera and visualization layers, and `react-map-gl` supplies the Mapbox basemap using the [documented reverse-controlled integration](https://deck.gl/docs/developer-guide/base-maps/using-with-mapbox). [Vite 8](https://vite.dev/blog/announcing-vite8) and [HeroUI setup](https://heroui.com/en/docs/react/getting-started/quick-start) informed the project setup.

HeroUI 3 supplies the buttons, fields and switches, and publishes its palette, radii and shadows as Tailwind 4 theme variables. Layout and data displays are written as Tailwind utilities against those variables. `src/styles.css` holds the project tokens, the base body and reduced-motion rules, the `glass` utility for floating panels, the panel enter and exit animations, the slide of the map cards beside the detail panel, and one override that reaches inside the HeroUI switch. Inter is bundled with the app through `@fontsource-variable/inter`, so no request goes to a font CDN.

The basemap has to be a direct child of `DeckGL`. deck.gl identifies it by its `mapStyle` prop, clones the current viewport into it and places it behind the deck canvas. Wrapping it in `Suspense` or any other element hides it from that check, which leaves the basemap on its own default camera and painted over every data layer. Its projection is pinned to mercator: Mapbox styles otherwise curve into a globe below about zoom 6, while deck.gl only projects Web Mercator, so the points drift away from the coastline underneath them.

The system colour scheme is read into a Jotai atom that starts from `matchMedia`'s current answer. Jotai 3's `useAtomValue` subscribes in an effect and does not read the atom again afterwards. If the atom only learned the device's scheme when the first component mounted it, components that subscribed after that would stay on the old value, which is how a dark device used to get a light app.

Enrolment zones draw their fill through `PolygonFillLayer`, a small subclass of deck.gl's `SolidPolygonLayer`. deck.gl 9.4.0 gives the fill model a vertex count, but luma.gl 9.4 sizes indexed draws by an index count and otherwise draws the whole index buffer. deck.gl never shrinks that buffer, so once a search narrowed the zones, the fill kept drawing leftover statewide triangles across the map. The subclass sets the index count. Check whether it is still needed when deck.gl is upgraded.

`mapbox-gl` stays in its own chunk. react-map-gl imports it dynamically when the map mounts, which happens only when a token is set. Zone files load by selected year; LGA geometry loads when enabled. A production server should enable gzip/Brotli for the GeoJSON responses.

## Data and limitations

2,301 school locations; all 1,575 government school names in the hidden enrolment sheet matched. There are 3,127 zone features across the supplied files. Thirty-five zone names have no exact 2025 school-name match. They remain visible with filters cleared and can be clicked for an explanation. No approximate school locations, guessed name matches, private school enrolments or school-level historical series are manufactured.

FTE is full-time equivalent, not necessarily headcount. Multi-LGA rows are summed to school-wide totals, not assigned to individual campuses. LGA summaries include all sectors and are independent of school filters. Regions are school attributes, not inferred administrative boundary polygons.

Your LGA ZIP contains reference data but no polygon geometry. The application includes a documented official Vicmap snapshot instead: 87 areas, including 79 councils matched to the workbook. See [source provenance](data/SOURCES.md) and the generated [matching report](public/data/report.json).

```sh
npm run data:build     # regenerate JSON from local inputs, no downloads
npm run lint          # Oxlint
npm run test          # source reconciliation and filter tests
npx playwright install chromium
npm run test:e2e      # desktop/mobile interactions and failed-fetch recovery
npm run build         # TypeScript check and production build
npm run preview       # serve production output
npm run format        # Oxfmt
```

`public/data/workbook-raw.json` preserves all four hidden sheets, with source column letters and their header row. The application initially displays the school-level data and LGA aggregates; regional historical aggregates are available for future layers.

Map interactions require WebGL2. The list, filters and school details remain useful if the map fails. Live Mapbox tiles cannot be verified until a valid key is supplied.
