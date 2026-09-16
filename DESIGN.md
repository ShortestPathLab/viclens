---
name: Where are the schools?
description: A quiet map workspace for Victorian schools, zones and enrolments.
colors:
  accent: "oklch(0.6204 0.195 253.83)"
  accent-foreground: "oklch(0.9911 0 0)"
  surface: "oklch(100% 0 0)"
  surface-dark: "oklch(0.2103 0.0059 285.89)"
  water: "#dce9e7"
  water-dark: "#1b2523"
  land: "rgb(235, 238, 226)"
  land-dark: "rgb(30, 38, 36)"
  primary-school: "#007AFF"
  secondary-school: "#FF9500"
  combined-school: "#AF52DE"
  special-school: "#34C759"
  language-school: "#FF2D55"
  region-north-eastern: "#5856D6"
  region-north-western: "#32ADE6"
  region-south-eastern: "#FF9500"
  region-south-western: "#FF2D55"
  zone-boundary: "#64748b"
  zone-boundary-dark: "#94a3b8"
  lga-boundary: "#6e578f"
typography:
  body:
    fontFamily: '"Inter Variable", "Inter", system-ui, sans-serif'
    fontSize: "16px"
  body-small:
    fontFamily: '"Inter Variable", "Inter", system-ui, sans-serif'
    fontSize: "14px"
  body-xsmall:
    fontFamily: '"Inter Variable", "Inter", system-ui, sans-serif'
    fontSize: "12px"
  heading:
    fontFamily: '"Inter Variable", "Inter", system-ui, sans-serif'
    fontSize: "24px"
    fontWeight: 600
    letterSpacing: "-0.025em"
  map-label:
    fontFamily: "Arial"
    fontSize: "13px"
rounded:
  control: "0.75rem"
  panel: "1rem"
  sheet: "1rem 1rem 0 0"
spacing:
  panel-inset: "20px"
  panel-gap: "16px"
  row: "12px"
components:
  explorer-panel:
    width: "366px"
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  detail-panel:
    width: "326px"
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  detail-sheet:
    height: "33dvh"
    rounded: "{rounded.sheet}"
---

# Design System: Where are the schools?

## Overview

**Creative North Star: "A quiet workspace over a loud map"**

The map carries all the colour. Everything else is a pale pane of glass holding controls and
numbers, so the only saturated things on screen are the school markers themselves.

**Key characteristics:**

- Panels float over a full-bleed map rather than sitting beside a cropped one.
- Category colour is vivid and consistent between markers, list rows and the legend.
- Chrome comes from HeroUI components at their default appearance.

## Colours

### Category

School types use five hues from Apple's system palette: blue, orange, purple, green and pink.
They are the loudest thing in the interface, and they carry meaning, so nothing else competes at
that saturation. Dark mode swaps each for its brighter variant. Education regions have their own
four-colour set, used only while region colouring is on and always with a matching legend.

### Map surfaces

Enrolment zones and local government boundaries stay neutral. Zones use slate, boundaries use
violet, and both sit well below the markers in weight. Water and land have separate light and dark
values so the offline preview reads in either scheme.

### Interface

HeroUI's default theme supplies the surface, foreground, muted, separator and accent tokens, in
both schemes. Nothing overrides them. The accent is HeroUI's blue and appears on controls only,
never on the map, which keeps it clear of the blue that means a primary school.

**The Legend Agreement Rule.** Markers, list dots and the legend use the same active mapping.
Switching to region colours changes the legend labels with it.

## Typography

Inter ships with the application through `@fontsource-variable/inter`, so no request leaves for a
font CDN. Every piece of text is a HeroUI `Typography` node, which fixes size, weight and tracking
to the component scale rather than to local classes. Headings run from `h6` at 16px to `h3` at
24px; body text runs 16px, 14px and 12px. Numbers stay on Inter's proportional figures, which is
what the rest of the interface reads in. Map city labels are drawn into the WebGL canvas rather than the DOM, so they use Arial, which is
available to the canvas without waiting for a webfont.

## Layout

The map fills the viewport at every width. Above 760px the explorer panel floats at the left,
366px wide with a 16px inset, and the detail panel opens beside it at 326px when a school is
selected. The detail panel is as tall as the school's details, up to the height of the map, and
each school opens scrolled to the top.

The local government summary and the zone notice stack as cards in the top left of the open map,
320px wide, just right of whichever panels are showing. When the detail panel opens they move over
beside it. On a screen too narrow for that, they stop short of the camera controls and overlap the
detail panel instead.

The map's viewport padding matches whatever the panels and the summary card cover, so the camera
centres what the reader can actually see, and the basemap receives the same padding. It always
leaves at least 240px of map open.

Below 760px the explorer becomes a bottom drawer at 85% of the viewport, opened from a floating
button. The school detail is a separate sheet resting on the bottom third of the map, with no
backdrop, so the map stays visible and interactive behind it. The camera pads upward by the sheet
height instead of leftward.

Map chrome keeps the corners: camera controls top right and the legend bottom right. On a phone
the cards stack across the top of the map, clear of the camera controls.

## Elevation and depth

Floating panels are glass. Each one is a translucent tint of HeroUI's surface colour over a blur of
the map, with a one-pixel rim lit from the top left and a soft shadow underneath. Inside a panel,
HeroUI's grey fills for fields, tabs, chips and meter tracks turn into faint tints of the
foreground, so the map shows through the controls as well. Dark glass is a touch lighter than the
dark map, which keeps the panels reading as panes in front of it.

The phone explorer drawer and the "About the data" modal sit on HeroUI's blurred backdrop and use
a thicker tint. Thin glass over a dimmed backdrop comes out grey. The modal keeps HeroUI's own
shape and entrance.

## Motion

Panels arrive and leave the way HeroUI's own overlays do. react-aria's animation hooks set
`data-entering` and `data-exiting` on a panel, and tw-animate-css keyframes run against those
attributes with the timing and curve of HeroUI's drawer: 250ms in, 200ms out. Each panel fades
and slides in from the side it is anchored to. The explorer, the detail panel, the local
government summary and the zone notice all come from the left, the map controls from the right
and the legend from below. The phone sheet rises from the bottom edge, and the map tooltip keeps
HeroUI's quicker tooltip timing. A closing panel keeps showing what it held until it has gone, and
it can no longer be clicked or focused.

Everything else that moves uses Motion on the same curve and timing:

- Picking another school or area while its panel is open crossfades the old contents into the
  new, and the panel eases to the new height. Starting each change from blank made the contents
  blink when items were clicked through quickly.
- The cards slide sideways as the detail panel opens and closes.
- The map's viewport padding eases to its new value, so the map glides over with the panels
  rather than jumping.

When the browser asks for reduced motion, all of it happens at once without animating.

## Shapes

Panels and map cards use a 16px radius and a 20px inset, and the mobile sheet rounds only its top
corners. Controls, fields and
list rows take HeroUI's own radii. Markers and legend dots are circles; zone and boundary swatches
are outlined rectangles, which keeps them readable as areas rather than points.

## Components

Everything visible is a HeroUI component at its default appearance, with local classes used for
placement rather than for looks.

### Explorer panel

Tabs split search and filters from the map layer switches, so the result list is never pushed
below the fold. Search is a `SearchField`, school types are a detached `ToggleButtonGroup`, and the
remaining filters are `Select` fields in the secondary variant, which reads as tinted rather than
white on an already white surface.

### Results

A `ListBox` in single-selection mode. Arrow keys move through the results, the open school stays
marked while its detail is on screen, and each row carries a category dot, a `Label`, a
`Description` and its enrolment. The listbox is pulled out by its own padding so row text lines up
with the fields above it.

### Detail

A `Typography` heading, `Chip` tags for type and sector, a definition list, and one `Meter` per
year level with the track at full width. Missing enrolments are an `Alert`, never a zero. Closing
is a `CloseButton` at the top right, which is the same control used for the boundary summary, the
zone notice, the phone drawer and the About modal.

### Local government summary

A `Card` shaped like the panels, with a `Typography` heading, a description and a secondary
`Table` of sector totals. The glass supplies the surface, so the table has no tinted header or
white body: rules separate the rows, numbers align right under right-aligned headings, and the
outer columns line up with the card's edges. The close button sits outside the changing contents,
so it stays still while areas crossfade.

### Map

School points carry a pale outline in light mode and a dark one in dark mode. Optional enrolment
sizing uses a square-root radius clamped to 3 to 28 pixels, and fades points with no data. A ring
marks the selected school. Selecting one flies the camera rather than cutting, and holds still
when the browser asks for reduced motion.

**The Independent Layers Rule.** School points, enrolment zones and boundaries stay independently
controllable and visually distinct.

## Do's and Don'ts

### Do:

- **Do** let the map hold the colour and keep the panels quiet.
- **Do** reach for a HeroUI component before writing a class.
- **Do** pair category colour with a label and keep the legend in step.
- **Do** keep visible keyboard focus and honour reduced motion, including the camera.

### Don't:

- **Don't** switch numbers to tabular figures.
- **Don't** imply a missing enrolment is zero.
- **Don't** style enrolment zones and boundaries alike.
- **Don't** put the interface accent on the map, where blue already means a primary school.
- **Don't** darken the map behind the detail sheet.
