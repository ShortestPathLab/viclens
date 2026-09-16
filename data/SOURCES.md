# Source provenance

The root CSV, workbook and ZIPs are supplied inputs and remain unchanged.

- `dv402-SchoolLocations2025.csv`: [DataVic School Locations 2025](https://discover.data.vic.gov.au/dataset/school-locations-2025), Victorian Department of Education. 2,301 school records with longitude/latitude; these are school locations, not a full campus inventory.
- `schoolsandenrolments.xlsx`: Summary Statistics Victorian Schools, February 2025. Four hidden raw sheets are exported. `School Name raw Data` has 1,575 government school names. Repeated school/year rows split across LGAs are summed, preserving fractional FTE. No individual school history is present. Other historical sheets contain regional/sector aggregates.
- `dv418_DataVic_School_Zones_2026_MAR26.zip`: supplied 2026 zone polygons, in CRS84 longitude/latitude. Exact normalised school-name joins only; 35 unmatched zone names remain reported and visible when school filters are cleared. Boundary coordinates are never used as school coordinates. Geometry is preserved.
- `Order_HF638P.zip`: supplied Vicmap LGA reference table (`VMREFTAB/LGA.dbf`) and licensing metadata. It contains no `.shp` polygon file; it is **not** the geometry used by this application.
- `data/lga-boundaries.geojson`: snapshot downloaded 16 September 2026 from the [official Vicmap Admin ArcGIS service, layer 9](https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/ArcGIS/rest/services/Vicmap_Admin/FeatureServer/9). [DataVic metadata](https://discover.data.vic.gov.au/dataset/vicmap-admin-rest-api). 87 named areas, including unincorporated areas; all 79 councils match the workbook. The query requests EPSG:4326, `maxAllowableOffset=0.00015` degrees and six decimal places for an exploratory display. It is not a cadastral precision product. State of Victoria (Department of Transport and Planning), Creative Commons Attribution 4.0; retain source attribution. Current boundaries are not claimed to be the 2025 statistical boundaries.
- `public/data/australia.geojson`: Australia from [Natural Earth's 1:50m country boundaries](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson), public domain. Used only as a coarse, local preview without a Mapbox token. Place labels provide orientation; streets load from Mapbox once configured.

`public/data/report.json` records source SHA-256 hashes, data years, matching counts, and unmatched names. Generated JSON is deterministic and local. No workbook or school data is uploaded to a third-party service.

## LGA snapshot query

```sh
curl -fG 'https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/ArcGIS/rest/services/Vicmap_Admin/FeatureServer/9/query' \
  --data-urlencode 'where=1=1' \
  --data-urlencode 'outFields=lga_code,lga_name,lga_official_name,abs_lga_code' \
  --data-urlencode 'outSR=4326' \
  --data-urlencode 'maxAllowableOffset=0.00015' \
  --data-urlencode 'geometryPrecision=6' \
  --data-urlencode 'f=geojson' \
  -o data/lga-boundaries.geojson
```

Check the response for ArcGIS errors or transfer limits before replacing a snapshot. Update the snapshot date in the importer, documentation and UI when refreshing. The importer validates the minimum area count. School preparation uses only Python's standard library; no live network calls are needed to rebuild.
