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
  sector-government: "#1baf7a"
  sector-catholic: "#6250d6"
  sector-independent: "#eb6834"
  transport-train: "#2a78d6"
  transport-tram: "#1baf7a"
  transport-bus: "#eb6834"
  zone-boundary: "#64748b"
  zone-boundary-dark: "#94a3b8"
  lga-boundary: "#6e578f"
  sa2-boundary: "#116e68"
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
  legend:
    width: "248px"
    rounded: "{rounded.control}"
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
four-colour set, used only while a layer colours by region and always with a matching legend.

Sectors and transport modes come from a categorical set checked for colour-blind separation
across every pair, which a map needs because any two points can sit side by side. That check holds
for three colours at most, so sectors get aqua, violet and orange, and stops are grouped into
train, tram and bus. Categories with an order, such as remoteness and the fire risk registers,
take one hue at rising strength instead of separate hues.

### Values

Numbers are shaded along one-hue ramps built in OKLCH, so each step changes lightness by the same
amount: violet, teal, blue and orange. In light mode a ramp runs pale to deep; in dark mode it runs
the other way, so the high end is always the step that stands out from the map. Points skip the
palest steps, which would vanish on the basemap. Change over time uses a diverging pair, red for a
fall and blue for a rise, with a grey at zero that recedes into the map. Fixed scales such as
SEIFA deciles get one step per value.

### Map surfaces

Enrolment zones, council boundaries and statistical areas stay neutral when drawn as boundaries.
Zones use slate, councils violet and SA2 areas a dark teal, and all three sit well below the
markers in weight. Shaded areas are separated by a hairline in the colour of the ground. Water and
land have separate light and dark values so the offline preview reads in either scheme.

### Interface

HeroUI's default theme supplies the surface, foreground, muted, separator and accent tokens, in
both schemes. Nothing overrides them. The accent is HeroUI's blue and appears on controls only,
never on the map, which keeps it clear of the blue that means a primary school.

**The Legend Agreement Rule.** The map, the legend and the thumbnails in the layer list read from
one computed view of each layer, so a scale or a category colour can never differ between them.
The legend lists every visible layer in the same order as the list. The result list keeps the
school type dots whatever the layers show.

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

The area card and the zone notice stack as cards in the top left of the open map,
320px wide, just right of whichever panels are showing. When the detail panel opens they move over
beside it. On a screen too narrow for that, they stop short of the camera controls and overlap the
detail panel instead.

The map's viewport padding matches whatever the panels and the area card cover, so the camera
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
and slides in from the side it is anchored to. The explorer, the detail panel, the area card and
the zone notice all come from the left, the map controls from the right
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
- A layer's settings open and close by easing their height while they fade, and the box keeps
  easing when a change of display adds or removes controls inside it.
- A new layer grows into the top of the list and a removed one folds away.
- A dragged layer lifts into a copy that follows the pointer, its neighbours slide aside to make
  room, and on release the copy settles into its slot on the panel curve.

When the browser asks for reduced motion, all of it happens at once without animating. The map
itself recolours instantly: deck.gl's attribute transitions run on the GPU and stalled the page for
seconds on large zone layers.

## Shapes

Panels and map cards use a 16px radius and a 20px inset, and the mobile sheet rounds only its top
corners. Controls, fields and
list rows take HeroUI's own radii. Markers and legend dots are circles; zone and boundary swatches
are outlined rectangles, which keeps them readable as areas rather than points.

## Components

Everything visible is a HeroUI component at its default appearance, with local classes used for
placement rather than for looks.

### Explorer panel

Tabs split search and filters from the layer list, so the result list is never pushed below the
fold. Search is a `SearchField`, school types are a detached `ToggleButtonGroup`, and the
remaining filters are `Select` fields in the secondary variant, which reads as tinted rather than
white on an already white surface.

### Layer list

The map draws whatever the list holds, top of the list on top of the map. Each row has a grip, a
thumbnail of how the layer draws, its dataset and a one-line summary such as "Shaded by ICSEA",
and an eye toggle. Pressing the row opens its settings underneath: a `Select` for the dataset and
one for how it is displayed, then only the controls that display uses. Fields are grouped by
topic and list only measures with data. Short choices (classes, palette, total or average) are
toggle button rows, and sizes and opacity are `Slider`s. One layer is open at a time. Rows take
the field tint on hover and while open, so they read as rows rather than as cards inside a card.
"Add layer" is a `Dropdown` of datasets with a line describing each.

Dragging works from the grip by pointer, touch or keyboard, and the list announces each move. The
dragged row leaves a faint slot behind and travels as a lifted copy drawn on the page body, which
the panel's blur would otherwise offset from the pointer.

### Results

A `ListBox` in single-selection mode. Arrow keys move through the results, the open school stays
marked while its detail is on screen, and each row carries a category dot, a `Label`, a
`Description` and its enrolment. The listbox is pulled out by its own padding so row text lines up
with the fields above it.

### Detail

A `Typography` heading, `Chip` tags for type, sector and any fire risk listing, a definition list,
and one `Meter` per year level with the track at full width. Missing enrolments are an `Alert`,
never a zero. ACARA's profile follows as ICSEA, a bar of the four advantage quarters in one ink at
rising strength, and staff and student facts, credited to ACARA. Transport access and zone years
close the panel. Closing is a `CloseButton` at the top right, which is the same control used for
the area card, the zone notice, the phone drawer and the About modal.

### Area card

A `Card` shaped like the panels, opened by clicking a council or SA2 area or by picking one in the
layer's settings. It holds a `Typography` heading, a secondary `Table` of schools and FTE by
sector, then population, school-age residents and SEIFA deciles as a definition list. The glass
supplies the surface, so the table has no tinted header or white body: rules separate the rows,
numbers align right under right-aligned headings, and the outer columns line up with the card's
edges. Its totals cover every school in the area whatever the filters, so the card describes the
place. The close button sits outside the changing contents, so it stays still while areas
crossfade.

### Map

School points carry a pale outline in light mode and a dark one in dark mode. Proportional circles
scale their area, not their radius, with the value, and the largest is set in the layer's
settings. Graduated points draw missing values small and grey beneath the rest. A ring marks the
selected school whatever the layers show. Selecting one flies the camera rather than cutting, and
holds still when the browser asks for reduced motion. Hover and click go to the topmost feature
under the pointer, whichever layer it is in.

**The Independent Layers Rule.** Every layer is controlled on its own and draws in its own
style: zones, council boundaries and statistical areas never share an outline colour.

## Do's and Don'ts

### Do:

- **Do** let the map hold the colour and keep the panels quiet.
- **Do** reach for a HeroUI component before writing a class.
- **Do** pair category colour with a label and keep the legend in step.
- **Do** credit ACARA wherever its figures are drawn or listed.
- **Do** keep visible keyboard focus and honour reduced motion, including the camera.

### Don't:

- **Don't** switch numbers to tabular figures.
- **Don't** imply a missing enrolment is zero.
- **Don't** offer ways to rank schools by results. ACARA's terms rule out league tables.
- **Don't** style enrolment zones and boundaries alike.
- **Don't** put the interface accent on the map, where blue already means a primary school.
- **Don't** darken the map behind the detail sheet.
