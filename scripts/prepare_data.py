"""Rebuild browser data from the supplied archives. Python standard library only."""
import csv
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data'
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def normalize(name):
    return re.sub(r'[^a-z0-9]', '', name.lower())


def workbook_rows(archive, sheet):
    strings = [''.join(node.itertext()) for node in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
    tree = ET.fromstring(archive.read(f'xl/worksheets/sheet{sheet}.xml'))
    result = []
    for row in tree.findall('m:sheetData/m:row', NS):
        cells = {}
        for cell in row:
            value = cell.find('m:v', NS)
            if value is not None:
                cells[re.sub(r'\d', '', cell.get('r'))] = strings[int(value.text)] if cell.get('t') == 's' else value.text
        if cells:
            result.append(cells)
    return result


def write(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    workbook = zipfile.ZipFile(ROOT / 'schoolsandenrolments.xlsx')
    enrolments = {}
    for row in workbook_rows(workbook, 9)[1:]:
        if not row.get('B') or not row.get('A'):
            continue
        key = normalize(row['B'])
        entry = enrolments.setdefault(key, {'name': row['B'], 'region': row['D'], 'area': row['F'], 'lga': row['G'], 'levels': {}})
        level = row['C']
        # Rows split across LGAs belong to one school; sum their FTE, not campuses.
        entry['levels'][level] = round(entry['levels'].get(level, 0) + float(row['A']), 1)
    schools = []
    matched = set()
    with (ROOT / 'dv402-SchoolLocations2025.csv').open(encoding='utf-8-sig') as source:
        for row in csv.DictReader(source):
            entry = enrolments.get(normalize(row['School_Name'])) if row['Education_Sector'] == 'Government' else None
            if entry:
                matched.add(normalize(row['School_Name']))
            position = [float(row['X']), float(row['Y'])] if row['X'] and row['Y'] else None
            if position:
                assert 140 < position[0] < 151 and -40 < position[1] < -33, position
            schools.append({'id': f"{row['Education_Sector']}-{row['School_No']}", 'number': int(row['School_No']), 'name': row['School_Name'], 'type': row['School_Type'], 'sector': row['Education_Sector'], 'position': position, 'town': row['Address_Town'].title(), 'address': ', '.join(filter(None, [row['Address_Line_1'], row['Address_Line_2'], row['Address_Town'].title(), row['Address_Postcode']])), 'region': entry['region'] if entry else row['Region'].title(), 'area': row['Area'], 'lga': row['LGA_Name'], 'enrolment': round(sum(entry['levels'].values()), 1) if entry else None, 'levels': entry['levels'] if entry else {}, 'zoneLevels': []})
    assert len({s['id'] for s in schools}) == len(schools), 'Duplicate school IDs'
    by_name = {normalize(s['name']): s for s in schools if s['sector'] == 'Government'}
    archive = zipfile.ZipFile(ROOT / 'dv418_DataVic_School_Zones_2026_MAR26.zip')
    zone_files = {}
    unmatched_zones = {}
    total_zones = 0
    for filename in archive.namelist():
        if not filename.endswith('.geojson'):
            continue
        data = json.loads(archive.read(filename))
        key = filename.removesuffix('.geojson')
        for index, feature in enumerate(data['features']):
            p = feature['properties']
            school = by_name.get(normalize(p['School_Name']))
            # Only exact, normalised school names are joined. Never guess a campus or name change.
            feature['properties'] = {'id': f'{key}-{index}', 'schoolId': school['id'] if school else None, 'name': p['School_Name'], 'campus': p['Campus_Name'], 'level': p['Year_Level'], 'year': 2026, 'entityCode': p['ENTITY_CODE']}
            if school and p['Year_Level'] not in school['zoneLevels']:
                school['zoneLevels'].append(p['Year_Level'])
            if not school:
                unmatched_zones[p['School_Name']] = p['ENTITY_CODE']
        data.pop('crs', None)
        write(f'{key}.json', data)
        zone_files[key] = len(data['features'])
        total_zones += len(data['features'])
    # Preserve all four hidden datasets for later analysis, without treating aggregates as school records.
    raw = {name: workbook_rows(workbook, sheet) for name, sheet in [('schoolCounts', 3), ('regionalEnrolments', 5), ('lgaEnrolments', 7), ('schoolEnrolments', 9)]}
    write('workbook-raw.json', raw)
    lga_rows = defaultdict(list)
    for row in raw['lgaEnrolments'][1:]:
        key = normalize(re.sub(r'\s*\([^)]*\)', '', row['C']))
        lga_rows[key].append({'sector': row['A'], 'enrolment': round(float(row['B']), 1), 'schools': int(row['D'])})
    lga_data = json.loads((ROOT / 'data/lga-boundaries.geojson').read_text())
    lga_data.pop('crs', None)
    assert len(lga_data['features']) >= 79, 'Incomplete LGA download'
    for feature in lga_data['features']:
        p = feature['properties']
        feature['properties'] = {'code': p['lga_code'], 'name': p['lga_name'].title(), 'officialName': p['lga_official_name'], 'sectors': lga_rows.get(normalize(p['lga_name']), [])}
    write('lgas.json', lga_data)

    sources = ['schoolsandenrolments.xlsx', 'dv418_DataVic_School_Zones_2026_MAR26.zip', 'dv402-SchoolLocations2025.csv', 'Order_HF638P.zip', 'data/lga-boundaries.geojson']
    report = {'locationYear': 2025, 'enrolmentYear': 2025, 'zoneYear': 2026, 'schools': len(schools), 'locatedSchools': sum(s['position'] is not None for s in schools), 'matchedEnrolments': len(matched), 'enrolmentSchools': len(enrolments), 'unmatchedEnrolments': [v['name'] for k, v in enrolments.items() if k not in matched], 'unmatchedZones': unmatched_zones, 'lgaFeatures': len(lga_data['features']), 'lgaNames': len({f['properties']['name'] for f in lga_data['features']}), 'lgaMatchedNames': len({f['properties']['name'] for f in lga_data['features'] if f['properties']['sectors']}), 'lgaSource': 'https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/ArcGIS/rest/services/Vicmap_Admin/FeatureServer/9', 'lgaSnapshotDate': '2026-09-16', 'zoneFeatures': total_zones, 'zoneFiles': zone_files, 'sourceHashes': {f: hashlib.sha256((ROOT / f).read_bytes()).hexdigest() for f in sources}}
    write('schools.json', sorted(schools, key=lambda s: s['name']))
    write('report.json', report)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
