# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The project owner, exploring Victorian school locations, regions, zones and enrolments.

## Product Purpose

An interactive map with overlays and left-hand controls for discovering schools and understanding enrolment data.

## Capabilities and Constraints

React, TypeScript, Vite with Oxc, Oxlint, HeroUI, deck.gl and Mapbox. Use es-toolkit for data operations. Mapbox token will be provided later. Preserve the supplied archives. Distinguish 2026 zones from February 2025 enrolments. Never present a zone centroid as a school location or aggregate statistics as school-level enrolment.

## Evidence on Hand

The supplied DataVic 2026 school-zone ZIP and schoolsandenrolments.xlsx with four hidden raw sheets. The user-supplied DataVic School Locations 2025 CSV supplements the polygon data with actual school coordinates, sectors and types.

## Open decisions and assumptions

The user requested autonomous completion. Use the specified full-map layout with a left control panel. Assume a desktop-first analysis workflow with mobile support. Administrative regions are school attributes; the supplied polygons are enrolment zones, not administrative region boundaries. No individual school history is inferred from aggregate historical data.

## Local government areas

User requested an independently toggleable LGA layer. Order_HF638P.zip contains a reference table but no polygon geometry. A documented official Vicmap snapshot supplies boundaries; all 79 councils match the workbook’s LGA enrolment totals. Unincorporated areas have no invented totals.
