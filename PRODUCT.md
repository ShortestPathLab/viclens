# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The project owner, analysing Victorian schools. The site is published on GitHub Pages.

## Product Purpose

A configurable map for analysing Victorian schools in their setting. Any number of layers can be
stacked, each drawing one dataset (schools, enrolment zones, council areas, SA2 statistical areas
or public transport stops) in a chosen way: points by category, graduated colour, proportional
circles, heatmaps, hexagon bins, boundaries or choropleths. The left panel holds search, filters
and the layer list; detail panels describe a school or an area.

## Capabilities and Constraints

React, TypeScript, Vite with Oxc, Oxlint, HeroUI, deck.gl, Mapbox and dnd-kit. Use es-toolkit for
data operations. Data is never committed: `npm run data` fetches every source and builds the JSON
the site reads. Keep enrolment census years, zone years, ACARA profile years and ABS reference
years labelled wherever they appear. Never present a zone centroid as a school location or an area
statistic as a school figure.

ACARA's School Profile is used under the My School terms of use. Until ACARA gives written
permission, it appears only in local builds and the published site leaves it out. Wherever its
figures appear they are credited to ACARA, and the map offers no way to rank schools by results.

## Evidence on Hand

DataVic school locations, all-sector FTE enrolments from 2007 and school zones; the education
department's bushfire and grassfire risk registers; Vicmap council boundaries; ACARA's School
Profile joined through the Australian Schools List; ABS SEIFA 2021, estimated resident population
and Census 2021 school attendance by SA2 and council area; Department of Transport and Planning
stop locations; Natural Earth for the offline coastline. `data/SOURCES.md` records each source and
`public/data/report.json` records what each build used.

## Open decisions and assumptions

Desktop-first analysis with mobile support. Education regions are school attributes, not
boundaries. Area totals built from schools follow the school filters on the map, while the area
card always counts every school in the area. No individual school history is inferred from
aggregate data. Joins use the school number and sector wherever a source carries them; the fire
risk registers name facilities only, so they join on name and town.
