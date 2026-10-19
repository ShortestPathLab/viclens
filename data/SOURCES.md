# Data sources

The map is built from public datasets that are downloaded on your machine and never committed. Two scripts do the work:

- `scripts/fetch_data.py` downloads the raw files into `data/sources/<source-id>/` and records where each one came from in `data/sources/manifest.json`.
- `scripts/prepare_data.py` reads only `data/sources/` and writes the browser files in `public/data/`. It makes no network calls.

Both use the Python standard library only (Python 3.10 or later). `data/sources/` and `public/data/` are listed in `.gitignore`.

## Running it

```sh
npm run data          # fetch, then build
npm run data:fetch    # python3 scripts/fetch_data.py
npm run data:build    # python3 scripts/prepare_data.py
```

Fetch options:

- `--only <id> [<id> ...]` limits the run to some sources, for example `python3 scripts/fetch_data.py --only enrolments school-zones`. The other entries in the manifest are left as they were.
- `--refresh` downloads again even when the change check says nothing has changed.
- `--skip <id> [<id> ...]` leaves sources out of the run.
- `--strict` exits with an error when any source in the run has no usable copy, not only a required one. The deploy workflow uses it.

Build option:

- `python3 scripts/prepare_data.py --exclude <id> [<id> ...]` leaves sources out of the build even when they were fetched, and marks them "left out of this build" in `report.json`. The deploy workflow leaves out `acara-profile` and `acara-asl` until ACARA permits publication (see `README.md`).

Each source is found through its publisher's API or download page, so a new yearly edition is picked up without editing the script. Before downloading, the script compares a cheap change signal with the one it saved last time (the CKAN resource record, an ArcGIS `dataLastEditDate`, HTTP `ETag` and `Last-Modified`, or the newest period ABS holds) and skips files that have not changed. Requests are sequential, send a `User-Agent` naming this project, time out, and are retried twice.

The summary table at the end gives each source a status, and the same status appears in `public/data/report.json`:

- `fresh`: downloaded on this run, or checked and found unchanged since the last download. Sources pinned to a fixed edition (Natural Earth, SEIFA 2021, Census 2021, ASGS 2021 boundaries) are not downloaded again, because that edition cannot change.
- `cached`: an older copy is in use because the check or the download failed, or because the file was put there by hand. These always carry a note saying why.
- `missing`: no usable copy.

A failed download never replaces a good copy. Files are written to a `.part` file and moved into place only after they pass a format check. The fetch exits with a non-zero status only when school locations, the latest FTE enrolments, LGA boundaries or Natural Earth have no usable copy. The build fails with a message when one of those is missing. Any other source can be missing: its fields come out `null` and the report marks it `missing`.

`fetchedAt` in the manifest and the report is the time of the last successful download. The manifest also keeps `checkedAt`, the time of the last check.

### Adding files by hand

When a publisher's file cannot be downloaded, save a copy at the path the script would use and run the fetch again. The script records it as a manual drop-in, uses it as it is, and never overwrites or deletes it. To hand the file back to the script, delete it. If the published file changes later, the fetch prints a warning.

| Source | Path |
| --- | --- |
| School zones | `data/sources/school-zones/<zone year>.zip` (the ZIP from DataVic, unchanged) |
| FTE enrolments | `data/sources/enrolments/<census year>.csv` |
| School locations | `data/sources/school-locations/<year>.csv` |
| ACARA School Profile | `data/sources/acara-profile/<year>.xlsx` |

A hand-placed file has to pass the same format check as a download, otherwise it is reported as `missing` and left in place.

### What is still manual (19 October 2026)

- The 2027 school zones ZIP. DataVic lists it, but its only download link is on `www.education.vic.gov.au`, which drops every connection, and the Internet Archive has no copy. Save `dv419_DataVic_School_Zones_2027_MAR26.zip` from [School Zones 2027](https://discover.data.vic.gov.au/dataset/victorian-government-school-zones-2027) as `data/sources/school-zones/2027.zip` when you can get it.
- The 2026 zones ZIP in `data/sources/school-zones/2026.zip` is a manual drop-in, copied from the file supplied with this project in September 2026.

## Sources

### `school-locations`: School Locations

- Publisher: State of Victoria (Department of Education), on DataVic. Licence: CC BY 4.0.
- Fetch: `package_search` on the DataVic CKAN API for datasets named `school-locations-2*`, the newest year in the slug, then the CSV resource. The datastore dump (`/datastore/dump/<resource id>`) is used when available, because it is UTF-8 and is served by DataVic itself.
- Cadence: yearly, from the February census, released between August and November. The 2026 edition (2,320 rows) appeared on 19 October 2026.
- Caveats: the raw 2026 CSV is Windows-1252, the 2025 one UTF-8 with a byte order mark; the build accepts both. The 2026 file lists Victory Christian College (Independent 1946) twice with one address and two sets of coordinates; the build keeps the first row, whose coordinates match the address.

### `enrolments`: All Schools FTE Enrolments

- Publisher: State of Victoria (Department of Education), on DataVic. Licence: CC BY 4.0.
- Fetch: every dataset named `all-schools-fte-enrolments-*`, one per February census from 2007. For each year the script tries the datastore dump, then the resource URL, then the newest Internet Archive capture of that URL.
- Cadence: yearly, released with School Locations.
- Caveats: files for 2015 to 2020 and 2023 to 2025 exist only on `www.education.vic.gov.au/Documents/`, which dropped every connection when tested on 19 October 2026. Those years come from Internet Archive captures (the 2025 capture matches the size DataVic records). The 2026 CSV is Windows-1252 and wraps its year-level headers in literal quotes (`"""Prep Total"""`). The 2009 file names its sector column `2009`. 2011 and 2012 call secondary ungraded students "Postprimary". Records join to School Locations on sector and school number, since government and non-government schools reuse numbers.

### `school-zones`: Victorian Government School Zones

- Publisher: State of Victoria (Department of Education), on DataVic. Licence: CC BY 4.0.
- Fetch: the two newest datasets named `victorian-government-school-zones-*` (the current school year and the next), each a ZIP of GeoJSON and MapInfo layers.
- Cadence: yearly, published around March for the following school year. The 2026 ZIP was replaced in March 2026 without a new dataset.
- Caveats: every zones ZIP is hosted on `www.education.vic.gov.au`, so none can be downloaded at the moment (see "What is still manual"). Zones join to schools on `ENTITY_CODE`, which is "1", the four-digit government school number and a two-digit campus number. Ten 2026 zones belong to schools missing from School Locations 2026 and stay unmatched. The zones are not for property decisions, as the publisher notes.

### `lga-boundaries`: Vicmap Admin LGA boundaries

- Publisher: State of Victoria (Department of Transport and Planning). Licence: CC BY 4.0. [DataVic record](https://discover.data.vic.gov.au/dataset/vicmap-admin-rest-api).
- Fetch: one query against `https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/ArcGIS/rest/services/Vicmap_Admin/FeatureServer/9/query` with `where=1=1`, `outFields=lga_code,lga_name,lga_official_name,abs_lga_code`, `outSR=4326`, `maxAllowableOffset=0.00015`, `geometryPrecision=6`, `f=geojson`, paged by `resultOffset`. The layer's `dataLastEditDate` is the change signal and the period shown.
- Cadence: a live service, edited weekly or more often.
- Caveats: 87 areas, including eight unincorporated ones that share the ABS code 29399; ABS figures are left empty for those. The geometry is simplified to about 15 m for display and is not a cadastral product. Vicmap still gives Merri-bek its 2021 ABS code (25250), so the build matches ABS tables by name when a code is missing from them.

### `natural-earth`: Natural Earth 1:50m countries

- Publisher: Natural Earth. Licence: public domain.
- Fetch: `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson`, pinned to the v5.1.2 tag. The build keeps the Australia feature only.
- Cadence: unchanged since 2022.

### `acara-profile`: ACARA School Profile

- Publisher: Australian Curriculum, Assessment and Reporting Authority (ACARA).
- Licence: the [My School terms of use](https://www.myschool.edu.au/terms-of-use). They allow personal and non-commercial educational use, and bar reproducing the content on a publicly accessible website without ACARA's written consent. The project owner is seeking that permission. Until it is granted, keep these fields local: the deploy workflow leaves this source out, and no other build that contains them should be shared.
- Fetch: the script reads [ACARA's data access page](https://www.acara.edu.au/contact-us/acara-data-access), finds the link to `School Profile <year>.xlsx` with the highest year, and downloads it. It skips the multi-year history file (about 30 MB). The blob's `ETag` and `Last-Modified` are the change signal.
- Cadence: yearly, after the December My School update. The 2025 file was published on 20 February 2026. ACARA removes last year's file when the new one goes up, so keep your copy.
- Caveats: multi-campus schools are reported as one rolled-up school, flagged as `rolled` in the output.

### `acara-asl`: Australian Schools List

- Publisher: ACARA. Licence: CC BY 4.0, per the site footer.
- Fetch: the JSON download on the [ASL search page for Victoria](https://asl.acara.edu.au/School-Search?state=VIC) is an ASP.NET form postback. The script loads the page, collects its form fields and submits them with the JSON button. The "last updated on" date on the ASL home page is the change signal. If that date cannot be found, a copy less than seven days old is reused and reported as `cached`.
- Cadence: updated each school term.
- Caveats: the list is used only to link ACARA IDs to Victorian school numbers. For Victoria, `StateProvinceId` is "07", a sector digit (1 Government, 2 Catholic, 3 Independent), the four-digit school number and a two-digit campus number. ACARA does not document this layout; it was worked out from the data, so confirm it with aslsupport@acara.edu.au before relying on it. Schools the crosswalk misses are matched on sector, name and postcode when exactly one profile fits.

### `fire-risk`: Bushfire At-Risk Register and grassfire Category 4 list

- Publisher: State of Victoria (Department of Education), Security and Emergency Management Division, on DataVic. Licence: CC BY 4.0.
- Fetch: DataVic search for the newest "Bushfire At-Risk Register" and "grassfire Category 4" datasets, downloaded from the datastore dump. Without a datastore copy the script tries the publisher's XLSX and then the Internet Archive.
- Cadence: yearly, around February.
- Caveats: the register uses categories 0 to 3, with 0 the highest risk; the second list holds Category 4. In the output they read "Bushfire Category 0" to "Bushfire Category 3" and "Grassfire Category 4"; a school on both lists gets the more severe one. Neither list has a school number, so school rows (early childhood services are skipped) are matched on name and town, then on name alone when unique, then on street address and town. A row such as "School - Junior Campus" matches the school when it is in the school's town and the rest of the name only describes the campus, or when it is on the same street. Camps, farms, outdoor education centres and campuses in other towns are left unmatched and listed in the report, because the map point is the school's main site.

### `abs-seifa`: SEIFA 2021

- Publisher: Australian Bureau of Statistics. Licence: CC BY 4.0.
- Fetch: the ABS Data API at `https://data.api.abs.gov.au/rest/`, dataflows `ABS_SEIFA2021_SA2` and `ABS_SEIFA2021_LGA`, the four indexes (IRSD, IRSAD, IER, IEO) with measures `SCORE` and `RWSD` (decile within the state). LGA tables are requested with labels so names are available.
- Cadence: SEIFA follows each Census. The next release depends on 2026 Census data, first due in June 2027.
- Caveats: the fetch prints a note when ABS publishes a newer SEIFA flow. SA2 tables stay on the 2021 edition to match the SA2 2021 boundaries; moving to the 2026 edition is a deliberate change to the script.

### `abs-erp`: Estimated Resident Population by age

- Publisher: Australian Bureau of Statistics. Licence: CC BY 4.0.
- Fetch: `ERP_ASGS2021` for SA2s and the newest `ABS_ANNUAL_ERP_LGA<year>` flow for LGAs, persons, all ages plus 0 to 4, 5 to 9, 10 to 14 and 15 to 19, for the latest year and the five before it. A one-row query for the newest Victorian total is the change signal.
- Cadence: yearly. The current data runs to 30 June 2025.
- Caveats: `age5to19Change` compares the 5 to 19 population with five years earlier. The 15 to 19 group includes school leavers.

### `abs-census-g15`: Census 2021 G15, type of educational institution attending

- Publisher: Australian Bureau of Statistics. Licence: CC BY 4.0.
- Fetch: dataflows `C21_G15_SA2` and `C21_G15_LGA`, persons, primary and secondary students by sector, Victoria only.
- Caveats: ABS perturbs small cells, so totals do not always equal the sum of their parts. The sector shares are calculated from the six sector cells so that they add to 100.

### `abs-sa2-boundaries`: SA2 boundaries, ASGS Edition 3 (2021)

- Publisher: Australian Bureau of Statistics. Licence: CC BY 4.0.
- Fetch: the generalised layer of `https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SA2/FeatureServer`, filtered to Victoria (`state_code_2021='2'`), five decimal places, paged.
- Caveats: 522 SA2s with land area (two non-spatial codes are dropped). The build simplifies each polygon separately with about 30 m of tolerance, so neighbouring SA2s can show small gaps or overlaps. Schools are assigned with the unsimplified shapes.

### `pt-stops`: Public Transport Lines and Stops

- Publisher: State of Victoria (Department of Transport and Planning), on the DTP open data portal. Licence: CC BY 4.0.
- Fetch: `package_show` for `public-transport-lines-and-stops` on `https://opendata.transport.vic.gov.au/api/3/action/`, then the stops GeoJSON. The URL is resolved on every run because resource IDs have changed before.
- Cadence: updated regularly; the copy fetched on 19 October 2026 was last modified on 12 October 2026.
- Caveats: platforms and both sides of a road appear as separate stops. The build merges stops with the same name and mode within 150 m (about 32,000 records become about 23,000). School buses are not in this dataset. A few interstate stations are included.

## How the build joins the data

- Schools are keyed `<sector>-<school number>`, for example `Government-1886`. Enrolments join on sector and number, and zones on the school number inside `ENTITY_CODE`.
- `lgaCode` and `sa2` come from the polygon containing the school, or the nearest polygon within 2 km when a school sits just outside every polygon, as on a coastline.
- `transit` counts merged stops within 400 m and 800 m and gives the distance to the nearest stop.
- LGA metrics use Vicmap's `abs_lga_code`, falling back to the ABS area name when the code is not in an ABS table.
- `report.json` lists every source with its status, plus match counts and the records that did not match, so mismatches can be checked by hand.
- The build checks that every school has a unique ID and coordinates inside Victoria, that there are at least 2,000 schools and 79 LGAs, that year levels add up to each school's total in the latest census, and that most schools match their enrolments, zones and ACARA rows. It stops with a message when a check fails.
