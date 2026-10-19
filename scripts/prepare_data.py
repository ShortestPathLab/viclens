"""Build the browser data in public/data/ from data/sources/. Python standard library only.

Runs offline on whatever scripts/fetch_data.py left in data/sources/ (see manifest.json there).
Optional sources may be missing: their fields come out null and report.json marks them missing.

    python3 scripts/prepare_data.py                                  # build from everything fetched
    python3 scripts/prepare_data.py --exclude acara-profile acara-asl  # leave sources out
"""
import argparse
import csv
import hashlib
import importlib.util
import io
import json
import math
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'data/sources'
OUT = ROOT / 'public/data'
SECTORS = ['Government', 'Catholic', 'Independent']
ZONE_LEVELS = ['P6', '7', '8', '9', '10', '11', '12']
REQUIRED = ['school-locations', 'enrolments', 'lga-boundaries', 'natural-earth']
XL = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
XL_REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'


def write(name, data):
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    return path


def text(data):
    try:
        return data.decode('utf-8-sig')
    except UnicodeDecodeError:
        return data.decode('cp1252')


def read_csv(path):
    rows = csv.reader(io.StringIO(text(path.read_bytes())))
    # Some DataVic headers carry literal quotes, e.g. """Prep Total""".
    header = [cell.strip().strip('"').strip() for cell in next(rows)]
    return [dict(zip(header, row)) for row in rows if any(cell.strip() for cell in row)]


def read_xlsx(path, sheet=None):
    """Rows of a worksheet as lists of cell values, in column order."""
    archive = zipfile.ZipFile(path)
    names = archive.namelist()
    strings = [''.join(t.text or '' for t in si.iter(XL + 't')) for si in ET.fromstring(archive.read('xl/sharedStrings.xml'))] if 'xl/sharedStrings.xml' in names else []
    targets = {r.get('Id'): r.get('Target') for r in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
    sheets = [(s.get('name'), targets[s.get(XL_REL + 'id')]) for s in ET.fromstring(archive.read('xl/workbook.xml')).iter(XL + 'sheet')]
    target = next(t for n, t in sheets if sheet is None or n.startswith(sheet)).lstrip('/')
    target = target if target.startswith('xl/') else f'xl/{target}'
    rows = []
    for _, row in ET.iterparse(archive.open(target)):
        if row.tag != XL + 'row':
            continue
        cells = {}
        for cell in row:
            column = 0
            for letter in re.match(r'[A-Z]+', cell.get('r')).group():
                column = column * 26 + ord(letter) - 64
            kind, value = cell.get('t'), cell.find(XL + 'v')
            if kind == 's':
                cells[column] = strings[int(value.text)]
            elif kind == 'inlineStr':
                cells[column] = ''.join(t.text or '' for t in cell.iter(XL + 't'))
            elif value is not None:
                cells[column] = value.text
        row.clear()
        rows.append([cells.get(i, '') for i in range(1, max(cells, default=0) + 1)])
    return rows


def table(path, marker):
    """CSV or XLSX rows as dicts. For XLSX the header is the first row containing marker."""
    if path.suffix == '.csv':
        return read_csv(path)
    rows = read_xlsx(path)
    start = next(i for i, row in enumerate(rows) if marker in row)
    header = [str(cell).strip() for cell in rows[start]]
    return [dict(zip(header, row)) for row in rows[start + 1:] if any(str(cell).strip() for cell in row)]


def number(value):
    try:
        value = float(str(value).replace(',', '').strip())
    except ValueError:
        return None
    return int(value) if value.is_integer() else value


def title(value):
    # str.title() gives "Mary'S"; capitalise whole words instead.
    return re.sub(r"[A-Za-z]+(?:['’][A-Za-z]+)*", lambda m: m.group(0)[0].upper() + m.group(0)[1:].lower(), value.strip())


def norm(value):
    value = value.lower().replace('&', ' and ').replace('’', '').replace("'", '').replace('\xa0', ' ')
    value = re.sub(r'\bsaint\b', 'st', value)
    return ' '.join(re.sub(r'[^a-z0-9]+', ' ', value).split())


STREET_TYPES = {'road': 'rd', 'street': 'st', 'avenue': 'av', 'ave': 'av', 'drive': 'dr', 'court': 'ct', 'highway': 'hwy', 'crescent': 'cr',
                'cres': 'cr', 'parade': 'pde', 'place': 'pl', 'lane': 'ln', 'terrace': 'tce', 'grove': 'gr', 'close': 'cl', 'boulevard': 'bvd',
                'blvd': 'bvd', 'circuit': 'cct', 'esplanade': 'esp', 'square': 'sq', 'track': 'trk', 'corner': 'cnr'}


def norm_address(value):
    return ' '.join(STREET_TYPES.get(word, word) for word in norm(value).split())


def rounded(coordinates, digits):
    if isinstance(coordinates[0], (int, float)):
        return [round(coordinates[0], digits), round(coordinates[1], digits)]
    return [rounded(c, digits) for c in coordinates]


def polygons(geometry):
    if not geometry:
        return []
    return [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else []


def ring_area(ring):
    # Spherical polygon area (Chamberlain and Duquette), as used by turf.
    total = sum(math.radians(x2 - x1) * (2 + math.sin(math.radians(y1)) + math.sin(math.radians(y2))) for (x1, y1), (x2, y2) in zip(ring, ring[1:]))
    return abs(total) * 6378137 ** 2 / 2


def area_sq_km(geometry):
    return round(sum(ring_area(p[0]) - sum(ring_area(h) for h in p[1:]) for p in polygons(geometry)) / 1e6, 1)


def metres(lon1, lat1, lon2, lat2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 12742000 * math.asin(math.sqrt(a))


class Areas:
    """Point-in-polygon lookups over a grid of bounding boxes."""
    CELL = 0.1

    def __init__(self, items):
        self.parts = []
        self.grid = defaultdict(list)
        for code, geometry in items:
            for polygon in polygons(geometry):
                xs = [x for x, _ in polygon[0]]
                ys = [y for _, y in polygon[0]]
                box = (min(xs), min(ys), max(xs), max(ys))
                index = len(self.parts)
                self.parts.append((code, polygon, box))
                for cx in range(int(box[0] // self.CELL), int(box[2] // self.CELL) + 1):
                    for cy in range(int(box[1] // self.CELL), int(box[3] // self.CELL) + 1):
                        self.grid[cx, cy].append(index)

    @staticmethod
    def inside(x, y, ring):
        result = False
        for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
            if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                result = not result
        return result

    def candidates(self, x, y, reach=0):
        cells = range(-1, 2) if reach else range(1)
        seen = set()
        for dx in cells:
            for dy in cells:
                for index in self.grid.get((int(x // self.CELL) + dx, int(y // self.CELL) + dy), []):
                    if index not in seen:
                        seen.add(index)
                        yield index

    def locate(self, x, y, within=2000):
        for index in self.candidates(x, y):
            code, polygon, (x0, y0, x1, y1) = self.parts[index]
            if x0 <= x <= x1 and y0 <= y <= y1 and self.inside(x, y, polygon[0]) and not any(self.inside(x, y, hole) for hole in polygon[1:]):
                return code
        # Points just off a coastline or a river boundary go to the nearest polygon within 2 km.
        kx, ky = math.cos(math.radians(y)) * 111320, 110540
        best, found = within, None
        for index in sorted(self.candidates(x, y, reach=1)):
            code, polygon, (x0, y0, x1, y1) = self.parts[index]
            if (max(x0 - x, 0, x - x1) * kx) > within or (max(y0 - y, 0, y - y1) * ky) > within:
                continue
            for ring in polygon:
                for (ax, ay), (bx, by) in zip(ring, ring[1:]):
                    ax, ay, bx, by = (ax - x) * kx, (ay - y) * ky, (bx - x) * kx, (by - y) * ky
                    dx, dy = bx - ax, by - ay
                    t = max(0, min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) if dx or dy else 0
                    distance = math.hypot(ax + t * dx, ay + t * dy)
                    if distance < best:
                        best, found = distance, code
        return found


def simplify(ring, tolerance):
    """Douglas-Peucker on one closed ring."""
    keep = [False] * len(ring)
    keep[0] = keep[-1] = True
    stack = [(0, len(ring) - 1)]
    limit = tolerance * tolerance
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = ring[a], ring[b]
        dx, dy = bx - ax, by - ay
        length = dx * dx + dy * dy
        best, index = 0, None
        for i in range(a + 1, b):
            px, py = ring[i]
            t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / length)) if length else 0
            distance = (ax + t * dx - px) ** 2 + (ay + t * dy - py) ** 2
            if distance > best:
                best, index = distance, i
        if index is not None and best > limit:
            keep[index] = True
            stack += [(a, index), (index, b)]
    return [point for point, kept in zip(ring, keep) if kept]


def simplify_geometry(geometry, tolerance, digits):
    result = []
    for polygon in polygons(geometry):
        outer = rounded(simplify(polygon[0], tolerance), digits)
        if len(outer) >= 4:
            result.append([outer] + [ring for ring in (rounded(simplify(hole, tolerance), digits) for hole in polygon[1:]) if len(ring) >= 4])
    if not result:
        # Keep a tiny area visible rather than dropping it.
        largest = max(polygons(geometry), key=lambda p: ring_area(p[0]))
        result = [[rounded(largest[0], digits)]]
    return {'type': 'Polygon', 'coordinates': result[0]} if len(result) == 1 else {'type': 'MultiPolygon', 'coordinates': result}


class Inputs:
    """Usable files per source, from data/sources/manifest.json, checked against the disk."""

    def __init__(self, exclude=()):
        self.exclude = set(exclude)
        path = SRC / 'manifest.json'
        if not path.exists():
            sys.exit('data/sources/manifest.json not found. Fetch the inputs first: npm run data:fetch')
        self.manifest = json.loads(path.read_text())['sources']
        self.problems = {}

    def files(self, source):
        if source in self.exclude:
            return []
        entry = self.manifest.get(source) or {}
        return sorted((f['period'], SRC / f['path']) for f in entry.get('files', []) if f.get('status') != 'missing' and f.get('path') and (SRC / f['path']).exists())

    def fail(self, source, error):
        print(f'warning: could not read {source}: {error}', file=sys.stderr)
        self.problems[source] = f'could not be read: {error}'

    def report(self):
        # The fetch script's source list, so sources that were never fetched still show up as missing.
        spec = importlib.util.spec_from_file_location('fetch_data', Path(__file__).with_name('fetch_data.py'))
        fetch = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(fetch)
        known = {s['id']: {'id': s['id'], 'title': s['title'], 'publisher': s['publisher'], 'licence': s['licence'], 'page': s['page'],
                           'files': [], 'note': 'not fetched yet'} for s in fetch.SOURCE_LIST}
        sources = []
        for key, entry in {**known, **self.manifest}.items():
            files = [f for f in entry.get('files', []) if f.get('status') != 'missing' and f.get('path')]
            present = [f for f in files if (SRC / f['path']).exists()]
            item = {k: entry.get(k) for k in ('id', 'title', 'publisher', 'licence', 'page', 'url', 'period', 'fetchedAt', 'sha256', 'status')}
            notes = [entry['note']] if entry.get('note') else []
            changed = [f['path'] for f in present if hashlib.sha256((SRC / f['path']).read_bytes()).hexdigest() != f.get('sha256')]
            if changed:
                notes.append(f'changed since the last fetch: {", ".join(changed)}')
            if key in self.exclude:
                item.update(status='missing', url=None, period=None, fetchedAt=None, sha256=None)
                item['note'] = 'left out of this build'
                sources.append(item)
                continue
            if not present or key in self.problems:
                item.update(status='missing', sha256=None)
                if key in self.problems or entry.get('files'):
                    notes.append(self.problems.get(key) or 'no file in data/sources')
            if notes:
                item['note'] = '; '.join(notes)
            sources.append(item)
        return sources


def load_schools(inputs):
    year, path = inputs.files('school-locations')[-1]
    schools, seen = [], {}
    for row in read_csv(path):
        key = (row['Education_Sector'], int(row['School_No']))
        if key in seen:
            # 2026 lists Victory Christian College twice with one address; keep the first row.
            assert seen[key] == row['School_Name'].strip(), f'School number {key} is used by two schools'
            print(f'warning: {path.name} lists {row["School_Name"]} ({key[0]} {key[1]}) twice; keeping the first row', file=sys.stderr)
            continue
        seen[key] = row['School_Name'].strip()
        position = [round(float(row['X']), 6), round(float(row['Y']), 6)] if row['X'].strip() and row['Y'].strip() else None
        if position:
            assert 140 < position[0] < 151 and -40 < position[1] < -33, (row['School_Name'], position)
        town = title(row['Address_Town'])
        schools.append({
            'id': f'{row["Education_Sector"]}-{int(row["School_No"])}', 'number': int(row['School_No']), 'name': row['School_Name'].strip(),
            'type': row['School_Type'], 'sector': row['Education_Sector'], 'position': position, 'town': town,
            'address': ', '.join(filter(None, [row['Address_Line_1'].strip(), row['Address_Line_2'].strip(), town, row['Address_Postcode'].strip()])),
            'postcode': row['Address_Postcode'].strip(), 'region': title(row['Region']), 'area': row['Area'].strip(), 'lga': row['LGA_Name'].strip(),
            'lgaCode': None, 'sa2': None, 'enrolment': None, 'levels': {}, 'history': {}, 'zoneLevels': {}, 'acara': None, 'fireRisk': None, 'transit': None,
            '_line1': row['Address_Line_1']})
    assert len(schools) >= 2000, f'only {len(schools)} schools in {path.name}; is the CSV complete?'
    assert len({s['id'] for s in schools}) == len(schools), 'Duplicate school IDs'
    assert set(s['sector'] for s in schools) <= set(SECTORS), 'Unexpected sector'
    return int(year), schools


LEVEL_COLUMNS = [('Prep Total', 'Prep')] + [(f'Year {n} Total', f'Year {n}') for n in range(1, 7)] + [('Primary Ungraded Total', 'Primary ungraded')] + \
    [(f'Year {n} Total', f'Year {n}') for n in range(7, 13)] + [('Secondary Ungraded Total', 'Secondary ungraded'), ('Postprimary Ungraded Total', 'Secondary ungraded')]


def read_enrolments(path):
    rows = read_csv(path)
    # The 2009 file labels its sector column "2009".
    sector = 'Education_Sector' if 'Education_Sector' in rows[0] else next(k for k in rows[0] if k != '_id')
    result = {}
    for row in rows:
        assert row[sector].strip() in SECTORS, f'{path.name}: unexpected sector {row[sector]!r}'
        key = f'{row[sector].strip()}-{int(row["School_No"])}'
        entry = result.setdefault(key, {'name': row['School_Name'].strip(), 'total': 0, 'levels': {}, 'parts': 0})
        entry['total'] += number(row['Grand Total']) or 0
        entry['parts'] += sum(number(row.get(column)) or 0 for column in ('Primary Total', 'Secondary Total'))
        for column, level in LEVEL_COLUMNS:
            value = number(row.get(column, ''))
            if value:
                entry['levels'][level] = entry['levels'].get(level, 0) + value
    return result


def add_enrolments(inputs, schools):
    by_id = {s['id']: s for s in schools}
    years = {}
    for period, path in inputs.files('enrolments'):
        years[int(period)] = read_enrolments(path)
    latest = max(years)
    for year, entries in sorted(years.items()):
        for key, entry in entries.items():
            if key in by_id:
                by_id[key]['history'][str(year)] = round(entry['total'], 1)
    unmatched, mismatched = [], []
    for key, entry in sorted(years[latest].items()):
        levels = {level: round(value, 1) for level, value in entry['levels'].items() if value > 0}
        # A broken parse shows up as year levels that no longer add up to the school total.
        if abs(sum(levels.values()) - entry['total']) > 0.5 or abs(entry['parts'] - entry['total']) > 0.5:
            mismatched.append(key)
        school = by_id.get(key)
        if school:
            school['enrolment'] = round(entry['total'], 1)
            school['levels'] = levels
        else:
            unmatched.append(f'{entry["name"]} ({key.replace("-", " ")})')
    assert len(mismatched) <= len(years[latest]) // 100, f'year levels do not add up for {len(mismatched)} schools, e.g. {mismatched[:5]}'
    matched = sum(s['enrolment'] is not None for s in schools)
    assert matched >= 0.9 * len(schools), f'only {matched} of {len(schools)} schools have {latest} enrolments'
    return latest, sorted(years), unmatched


def expand_levels(level):
    level = str(level).strip()
    if level.upper().startswith('P'):
        return ['P6']
    span = re.fullmatch(r'(\d+)\s*(?:to|-)\s*(\d+)', level)
    if span:
        return [str(n) for n in range(int(span.group(1)), int(span.group(2)) + 1) if str(n) in ZONE_LEVELS]
    return [level] if level in ZONE_LEVELS else []


def file_levels(key):
    # Which year levels a zone layer applies to, from its file name.
    if key.startswith('Primary'):
        return ['P6']
    year = re.search(r'Year(\d+)', key)
    if year:
        return [year.group(1)]
    if 'singlesex' in key:
        return ZONE_LEVELS[1:]
    if 'juniorsec' in key:
        return ['7', '8', '9']
    if 'seniorsec' in key:
        return ['11', '12']
    return []


def add_zones(inputs, schools):
    by_id = {s['id']: s for s in schools}
    index, written, unmatched = [], set(), {}
    total = matched = 0
    for period, path in inputs.files('school-zones'):
        year = int(period)
        archive = zipfile.ZipFile(path)
        layers = defaultdict(set)
        count = 0
        for name in sorted(n for n in archive.namelist() if n.lower().endswith('.geojson')):
            key = Path(name).stem
            key = key if key.endswith(str(year)) else f'{key}_{year}'
            data = json.loads(archive.read(name))
            data.pop('crs', None)
            covered = set(file_levels(key))
            for i, feature in enumerate(data['features']):
                p = feature['properties']
                code = str(p.get('ENTITY_CODE') or '').strip()
                # ENTITY_CODE is "1", the four-digit government School_No, then a two-digit campus number.
                school = by_id.get(f'Government-{int(code[1:5])}') if re.fullmatch(r'1\d{6}', code) else None
                levels = expand_levels(p.get('Year_Level'))
                covered.update(levels)
                feature['properties'] = {'id': f'{key}-{i}', 'schoolId': school['id'] if school else None, 'name': p.get('School_Name'),
                                         'campus': p.get('Campus_Name'), 'level': str(p.get('Year_Level')), 'year': year, 'entityCode': code}
                feature['geometry']['coordinates'] = rounded(feature['geometry']['coordinates'], 6)
                if school:
                    matched += 1
                    zone = school['zoneLevels'].setdefault(str(year), [])
                    zone += [level for level in levels if level not in zone]
                else:
                    unmatched[p.get('School_Name')] = code
            for level in covered:
                layers[level].add(key)
            count += len(data['features'])
            write(f'zones/{key}.json', {'type': 'FeatureCollection', 'features': data['features']})
            written.add(f'{key}.json')
        total += count
        order = lambda key: (not key.startswith(('Primary', 'Secondary')), len(key), key)
        index.append({'year': year, 'features': count, 'levels': {level: sorted(layers[level], key=order) for level in ZONE_LEVELS if layers[level]}})
    for school in schools:
        for levels in school['zoneLevels'].values():
            levels.sort(key=ZONE_LEVELS.index)
    if total:
        assert matched >= 0.9 * total, f'only {matched} of {total} zones matched a school'
    write('zones/index.json', {'years': index})
    for stale in (OUT / 'zones').glob('*.json'):
        if stale.name != 'index.json' and stale.name not in written:
            stale.unlink()
    return [entry['year'] for entry in index], total, matched, dict(sorted(unmatched.items()))


def add_acara(inputs, schools):
    profile_files, asl_files = inputs.files('acara-profile'), inputs.files('acara-asl')
    if not profile_files:
        return None, 0, 'none (ACARA School Profile missing)'
    rows = read_xlsx(profile_files[-1][1], 'SchoolProfile')
    header = rows[0]
    profiles = {}
    for row in rows[1:]:
        record = dict(zip(header, row))
        if record.get('State') == 'VIC':
            profiles[str(number(record['ACARA SML ID']))] = record
    assert len(profiles) >= 2000, f'only {len(profiles)} Victorian rows in the ACARA School Profile'
    year = number(next(iter(profiles.values()))['Calendar Year'])
    found = {}
    method = []
    if asl_files:
        # ASL StateProvinceId for Victoria is "07", a sector digit (1 Government, 2 Catholic, 3 Independent),
        # the four-digit school number and a two-digit campus. ACARA does not document this.
        campuses = defaultdict(list)
        for row in json.loads(text(asl_files[-1][1].read_bytes())):
            state_id = row.get('StateProvinceId') or ''
            if re.fullmatch(r'07[123]\d{6}', state_id):
                campuses[f'{SECTORS[int(state_id[2]) - 1]}-{int(state_id[3:7])}'].append(row)
        for school in schools:
            rows_ = sorted(campuses.get(school['id'], []), key=lambda r: (r['StateProvinceId'][7:] != '01', r['StateProvinceId']))
            for row in rows_:
                parent = (row.get('Campus') or {}).get('ParentSchoolId')
                acara_id = next((i for i in (row.get('ACARAId'), parent) if i in profiles), None)
                if acara_id:
                    found[school['id']] = (acara_id, acara_id != row.get('ACARAId'))
                    break
        method.append(f'ASL state ID crosswalk ({len(found)})')
    # Exact sector, name and postcode, for anything the crosswalk did not reach.
    by_name = defaultdict(list)
    for acara_id, record in profiles.items():
        by_name[record['School Sector'], norm(record['School Name']), str(record['Postcode']).strip()].append(acara_id)
    extra = 0
    for school in schools:
        if school['id'] not in found:
            ids = by_name.get((school['sector'], norm(school['name']), school['postcode']), [])
            if len(ids) == 1:
                found[school['id']] = (ids[0], False)
                extra += 1
    method.append(f'sector, name and postcode ({extra})')
    for school in schools:
        if school['id'] not in found:
            continue
        acara_id, via_parent = found[school['id']]
        p = profiles[acara_id]
        sea = [number(p.get(k)) for k in ('Bottom SEA Quarter (%)', 'Lower Middle SEA Quarter (%)', 'Upper Middle SEA Quarter (%)', 'Top SEA Quarter (%)')]
        school['acara'] = {
            'id': int(acara_id), 'year': year, 'icsea': number(p.get('ICSEA')), 'icseaPercentile': number(p.get('ICSEA Percentile')),
            'sea': sea if None not in sea else None, 'teachingStaff': number(p.get('Teaching Staff')),
            'teachingStaffFte': number(p.get('Full Time Equivalent Teaching Staff')), 'nonTeachingStaff': number(p.get('Non-Teaching Staff')),
            'nonTeachingStaffFte': number(p.get('Full Time Equivalent Non-Teaching Staff')), 'enrolments': number(p.get('Total Enrolments')),
            'girls': number(p.get('Girls Enrolments')), 'boys': number(p.get('Boys Enrolments')),
            'fteEnrolments': number(p.get('Full Time Equivalent Enrolments')), 'indigenousPct': number(p.get('Indigenous Enrolments (%)')),
            'lbotePct': number(p.get('Language Background Other Than English - Yes (%)')), 'remoteness': p.get('Geolocation') or None,
            'rolled': via_parent or p.get('Rolled Reporting Description') == 'Rolled Reporting'}
    assert len(found) >= 0.8 * len(schools), f'only {len(found)} schools matched ACARA profiles'
    return year, len(found), '; '.join(method)


SEVERITY = {'barr': 'Bushfire', 'grassfire': 'Grassfire'}
CAMP_WORDS = re.compile(r'\b(camp|outdoor|farm|homestead|environment|annexe|unit|facility|centre|center|program|online|hub|administration)\b')
SITE_WORDS = {'main', 'junior', 'senior', 'primary', 'secondary', 'middle', 'campus', 'school', 'college'}


def street(address):
    return ' '.join(word for word in norm_address(address).split() if not any(c.isdigit() for c in word) and len(word) > 1)


def add_fire_risk(inputs, schools):
    files = inputs.files('fire-risk')
    if not files:
        return None, 0, []
    by_name_town, by_name, by_address = defaultdict(list), defaultdict(list), defaultdict(list)
    for school in schools:
        town = norm(school['town'])
        by_name_town[school['sector'], norm(school['name']), town].append(school)
        by_name[school['sector'], norm(school['name'])].append(school)
        by_address[school['sector'], norm_address(school['_line1']), town].append(school)

    def unique(found):
        return found[0] if len(found) == 1 else None

    def find(row):
        sector, name, town = row['Education sector'].strip(), row['Facility name'], norm(row['Town/Suburb'])
        school = unique(by_name_town.get((sector, norm(name), town), [])) or unique(by_name.get((sector, norm(name)), [])) \
            or unique(by_address.get((sector, norm_address(row['Facility address']), town), []))
        if school:
            return school
        # "School - Junior Campus" in the school's town, or on the school's street, is the school.
        # Camps, farms and satellite programs elsewhere in town are not.
        parts = [part for part in re.split(r'\s+[-\u2013|]\s+', name) if part]
        for i, part in enumerate(parts if len(parts) > 1 else []):
            school = unique(by_name_town.get((sector, norm(part), town), []))
            rest = set(norm(' '.join(parts[:i] + parts[i + 1:])).split()) - set(norm(part).split())
            if school and not CAMP_WORDS.search(' '.join(rest)) and (rest <= SITE_WORDS or street(row['Facility address']) == street(school['_line1'])):
                return school
        return None

    matched, unmatched, period, worst = 0, set(), None, {}
    for _, path in files:
        kind = path.stem
        for row in table(path, 'Facility name'):
            if row.get('Education sector', '').strip() not in SECTORS:
                continue
            category_column = next(k for k in row if k.lower().startswith('fire risk category'))
            period = period or category_column.lower().removeprefix('fire risk category').strip() or None
            level = int(re.search(r'\d', row[category_column]).group())
            school = find(row)
            if not school:
                unmatched.add(f'{row["Facility name"].strip()} ({row["Town/Suburb"].strip()})')
                continue
            matched += 1
            # Lower categories are more severe; Category 4 is the grassfire list.
            if level < worst.get(school['id'], 99):
                worst[school['id']] = level
                school['fireRisk'] = f'{SEVERITY[kind]} Category {level}'
    return period, matched, sorted(unmatched)


def read_abs(path):
    """ABS SDMX CSV rows, the area code column, and Victorian codes by name when the file has labels."""
    rows = read_csv(path)
    header = list(rows[0])
    region = next(k for k in header if k in ('ASGS_2021', 'REGION') or k.startswith('LGA_'))
    label = header[header.index(region) + 1] if 'STRUCTURE' in header else None
    names = {norm(re.sub(r'\s*\([^)]*\)$', '', row[label])): row[region] for row in rows if label and row[region].startswith('2')}
    return region, rows, names


INDEX_NAMES = {'IRSD': 'Irsd', 'IRSAD': 'Irsad', 'IER': 'Ier', 'IEO': 'Ieo'}
SHARES = {'govSchoolShare': ('21', '31'), 'catholicSchoolShare': ('22', '32'), 'independentSchoolShare': ('23', '33')}


def area_metrics(inputs, kind, areas):
    """Metrics for {key: (ABS code, name)} areas of one kind, "sa2" or "lga". Returns ({key: metrics}, years)."""
    metrics = {key: {k: None for k in METRIC_KEYS} for key in areas}
    years = {}

    def dataset(source):
        files = {path.stem: path for _, path in inputs.files(source)}
        if kind not in files:
            return None
        region, rows, names = read_abs(files[kind])
        present = {row[region] for row in rows}
        # Fall back to the area name when a code changed between ABS editions.
        return region, rows, {key: code if code in present else names.get(norm(name)) for key, (code, name) in areas.items()}

    def seifa():
        region, rows, codes = found
        values = defaultdict(dict)
        for row in rows:
            suffix = 'Score' if row['SEIFA_MEASURE'] == 'SCORE' else 'Decile'
            values[row[region]][f'seifa{INDEX_NAMES[row["SEIFAINDEXTYPE"]]}{suffix}'] = number(row['OBS_VALUE'])
        for key, code in codes.items():
            metrics[key].update(values.get(code, {}))
        years['seifa'] = int(rows[0]['TIME_PERIOD'])

    def erp():
        region, rows, codes = found
        values = defaultdict(dict)
        for row in rows:
            values[row[region], int(row['TIME_PERIOD'])][row['AGE']] = number(row['OBS_VALUE'])
        latest = max(year for _, year in values)
        for key, code in codes.items():
            now, then = values.get((code, latest), {}), values.get((code, latest - 5), {})
            m = metrics[key]
            m.update(population=now.get('TOT'), age0to4=now.get('A04'), age5to9=now.get('A59'), age10to14=now.get('A10'), age15to19=now.get('A15'))
            current, earlier = [now.get(a) for a in ('A59', 'A10', 'A15')], [then.get(a) for a in ('A59', 'A10', 'A15')]
            if None not in current and None not in earlier and sum(earlier) > 0:
                m['age5to19Change'] = round((sum(current) - sum(earlier)) / sum(earlier) * 100, 1)
        years.update(erp=latest, erpBase=latest - 5)

    def census():
        region, rows, codes = found
        counts = defaultdict(dict)
        for row in rows:
            if row['SEXP'] == '3':
                counts[row[region]][row['TYSTAP']] = number(row['OBS_VALUE']) or 0
        for key, code in codes.items():
            c = counts.get(code, {})
            # Shares of the six sector cells, so the three add to 100 despite ABS cell perturbation.
            total = sum(c.get(cell, 0) for cells in SHARES.values() for cell in cells)
            for name, cells in SHARES.items():
                metrics[key][name] = round(sum(c.get(cell, 0) for cell in cells) / total * 100, 1) if total else None
        years['census'] = int(rows[0]['TIME_PERIOD'])

    for source, apply in (('abs-seifa', seifa), ('abs-erp', erp), ('abs-census-g15', census)):
        try:
            found = dataset(source)
            if found:
                apply()
        except (KeyError, ValueError, IndexError, StopIteration) as error:
            inputs.fail(source, error)
    return metrics, years


METRIC_KEYS = ['seifaIrsdScore', 'seifaIrsdDecile', 'seifaIrsadScore', 'seifaIrsadDecile', 'seifaIerScore', 'seifaIerDecile', 'seifaIeoScore',
               'seifaIeoDecile', 'population', 'age0to4', 'age5to9', 'age10to14', 'age15to19', 'age5to19Change', 'areaSqKm']


def build_lgas(inputs, schools):
    _, path = inputs.files('lga-boundaries')[-1]
    data = json.loads(path.read_text())
    features = data['features']
    assert len(features) >= 79, f'only {len(features)} LGA boundaries; is the download complete?'
    lookup = Areas([(f['properties']['lga_code'], f['geometry']) for f in features])
    for school in schools:
        if school['position']:
            school['lgaCode'] = lookup.locate(*school['position'])
    abs_codes = [f['properties'].get('abs_lga_code') for f in features]
    metrics, years = area_metrics(inputs, 'lga', {f['properties']['lga_code']: (f['properties'].get('abs_lga_code'), f['properties']['lga_name']) for f in features})
    shared = {c for c in abs_codes if abs_codes.count(c) > 1}
    groups = defaultdict(lambda: defaultdict(list))
    for school in schools:
        if school['lgaCode']:
            groups[school['lgaCode']][school['sector']].append(school)
    for feature in features:
        p = feature['properties']
        code, abs_code = p['lga_code'], p.get('abs_lga_code') or None
        m = metrics[code]
        if abs_code in shared:
            # Unincorporated areas share one ABS code, so ABS figures would repeat for each of them.
            m = {k: None for k in m}
        m['areaSqKm'] = area_sq_km(feature['geometry'])
        sectors = [{'sector': sector, 'enrolment': round(sum(s['enrolment'] or 0 for s in groups[code][sector]), 1), 'schools': len(groups[code][sector])}
                   for sector in SECTORS if groups[code][sector]]
        feature['properties'] = {'code': code, 'absCode': abs_code, 'name': title(p['lga_name']), 'officialName': p['lga_official_name'],
                                 'sectors': sectors, 'metrics': m}
    write('lgas.json', {'type': 'FeatureCollection', 'features': features})
    return years


def build_sa2(inputs, schools):
    files = inputs.files('abs-sa2-boundaries')
    if not files:
        write('sa2.json', {'type': 'FeatureCollection', 'features': []})
        return {}
    data = json.loads(files[-1][1].read_text())
    features = [f for f in data['features'] if f.get('geometry')]
    assert len(features) >= 500, f'only {len(features)} SA2 boundaries'
    lookup = Areas([(f['properties']['sa2_code_2021'], f['geometry']) for f in features])
    for school in schools:
        if school['position']:
            school['sa2'] = lookup.locate(*school['position'])
    metrics, years = area_metrics(inputs, 'sa2', {f['properties']['sa2_code_2021']: (f['properties']['sa2_code_2021'], f['properties']['sa2_name_2021']) for f in features})
    output = []
    for feature in sorted(features, key=lambda f: f['properties']['sa2_code_2021']):
        p = feature['properties']
        m = metrics[p['sa2_code_2021']]
        m['areaSqKm'] = round(p['area_albers_sqkm'], 1) if p.get('area_albers_sqkm') is not None else None
        # About 30 m of tolerance keeps the statewide layer near 2 MB.
        output.append({'type': 'Feature', 'properties': {'code': p['sa2_code_2021'], 'name': p['sa2_name_2021'], 'metrics': m},
                       'geometry': simplify_geometry(feature['geometry'], 0.0003, 5)})
    write('sa2.json', {'type': 'FeatureCollection', 'features': output})
    return years


def build_stops(inputs, schools):
    files = inputs.files('pt-stops')
    if not files:
        write('stops.json', {'modes': [], 'stops': []})
        return
    groups = defaultdict(list)
    for feature in json.loads(files[-1][1].read_text())['features']:
        p, g = feature['properties'], feature.get('geometry')
        if g and g['type'] == 'Point':
            groups[p['MODE'].strip(), p['STOP_NAME'].strip()].append((str(p['STOP_ID']), g['coordinates'][0], g['coordinates'][1]))
    # Platforms and both sides of a road appear as separate stops. One name and mode within 150 m is one stop.
    stops = []
    for (mode, name), members in groups.items():
        clusters = []
        for _, x, y in sorted(members, key=lambda m: (len(m[0]), m[0])):
            for cluster in clusters:
                if metres(cluster[0][0], cluster[0][1], x, y) <= 150:
                    cluster.append((x, y))
                    break
            else:
                clusters.append([(x, y)])
        for cluster in clusters:
            stops.append((round(sum(c[0] for c in cluster) / len(cluster), 6), round(sum(c[1] for c in cluster) / len(cluster), 6), mode, name))
    assert len(stops) >= 10000, f'only {len(stops)} stops after merging'
    modes = sorted({title(mode) for _, _, mode, _ in stops})
    rows = sorted(([x, y, modes.index(title(mode)), name] for x, y, mode, name in stops), key=lambda r: (r[2], r[3], r[0], r[1]))
    write('stops.json', {'modes': modes, 'stops': rows})
    grid = defaultdict(list)
    for x, y, _, _ in rows:
        grid[int(x // 0.01), int(y // 0.01)].append((x, y))

    def within(x, y, reach):
        cx, cy = int(x // 0.01), int(y // 0.01)
        return [metres(x, y, sx, sy) for dx in range(-reach, reach + 1) for dy in range(-reach, reach + 1) for sx, sy in grid.get((cx + dx, cy + dy), [])]

    for school in schools:
        if not school['position']:
            continue
        x, y = school['position']
        near = within(x, y, 1)
        nearest = None
        # Widen the search until the closest stop found is nearer than the searched square's edge
        # (a 0.01 degree cell is at least 860 m wide in Victoria).
        for reach in (1, 4, 16, 64):
            found = near if reach == 1 else within(x, y, reach)
            if found and min(found) <= reach * 860:
                nearest = round(min(found))
                break
        school['transit'] = {'stops400': sum(d <= 400 for d in near), 'stops800': sum(d <= 800 for d in near), 'nearestStop': nearest}


def build_australia(inputs):
    _, path = inputs.files('natural-earth')[-1]
    feature = next(f for f in json.loads(path.read_text())['features'] if f['properties'].get('ADM0_A3') == 'AUS')
    write('australia.geojson', {'type': 'FeatureCollection', 'features': [
        {'type': 'Feature', 'properties': {'name': 'Australia'}, 'geometry': {'type': feature['geometry']['type'], 'coordinates': rounded(feature['geometry']['coordinates'], 6)}}]})


def optional(inputs, source, build, default):
    try:
        return build()
    except (AssertionError, KeyError, ValueError, IndexError, StopIteration, zipfile.BadZipFile) as error:
        inputs.fail(source, error)
        return default


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--exclude', nargs='+', metavar='ID', default=[], help='leave these sources out of the build, even when fetched')
    inputs = Inputs(parser.parse_args().exclude)
    missing = [source for source in REQUIRED if not inputs.files(source)]
    if missing:
        sys.exit(f'Required inputs missing from data/sources: {", ".join(missing)}. Run npm run data:fetch, or see data/SOURCES.md for manual downloads.')
    OUT.mkdir(parents=True, exist_ok=True)
    # Files the earlier importer wrote straight into public/data.
    for stale in ['workbook-raw.json', *[p.name for p in OUT.glob('*.json') if re.match(r'(Primary|Secondary|Standalone)_', p.name)]]:
        (OUT / stale).unlink(missing_ok=True)

    location_year, schools = load_schools(inputs)
    latest, history_years, enrolments_unmatched = add_enrolments(inputs, schools)
    zone_years, zone_features, zones_matched, zones_unmatched = optional(inputs, 'school-zones', lambda: add_zones(inputs, schools), ([], 0, 0, {}))
    acara_year, acara_matched, acara_method = optional(inputs, 'acara-profile', lambda: add_acara(inputs, schools), (None, 0, 'none'))
    fire_period, fire_matched, fire_unmatched = optional(inputs, 'fire-risk', lambda: add_fire_risk(inputs, schools), (None, 0, []))
    lga_years = build_lgas(inputs, schools)
    sa2_years = optional(inputs, 'abs-sa2-boundaries', lambda: build_sa2(inputs, schools), {})
    optional(inputs, 'pt-stops', lambda: build_stops(inputs, schools), None)
    build_australia(inputs)
    area_years = {**lga_years, **sa2_years}

    for school in schools:
        del school['_line1']
    schools.sort(key=lambda s: (s['name'], s['id']))
    write('schools.json', schools)
    fire_entry = inputs.manifest.get('fire-risk') or {}
    report = {
        'generatedAt': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'years': {'locations': location_year, 'enrolments': latest, 'enrolmentHistory': history_years, 'zones': zone_years, 'acara': acara_year,
                  'erp': area_years.get('erp'), 'erpBase': area_years.get('erpBase'), 'seifa': area_years.get('seifa'), 'census': area_years.get('census'),
                  'fireRisk': (fire_entry.get('period') or fire_period) if fire_matched else None},
        'sources': inputs.report(),
        'matching': {
            'schools': len(schools), 'located': sum(s['position'] is not None for s in schools),
            'withEnrolments': sum(s['enrolment'] is not None for s in schools), 'enrolmentsUnmatched': enrolments_unmatched,
            'zoneFeatures': zone_features, 'zonesMatched': zones_matched, 'zonesUnmatched': zones_unmatched,
            'acaraMatched': acara_matched, 'acaraMethod': acara_method, 'fireRiskMatched': fire_matched, 'fireRiskUnmatched': fire_unmatched,
            'lgaAssigned': sum(s['lgaCode'] is not None for s in schools), 'sa2Assigned': sum(s['sa2'] is not None for s in schools)}}
    write('report.json', report)
    print(json.dumps({**report, 'sources': [f'{s["id"]}: {s["status"]}' for s in report['sources']]}, indent=2))


if __name__ == '__main__':
    main()
