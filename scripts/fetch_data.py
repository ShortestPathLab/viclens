"""Download the raw inputs for the schools map into data/sources/. Python standard library only.

    python3 scripts/fetch_data.py                      # fetch whatever has changed
    python3 scripts/fetch_data.py --only enrolments    # limit the run to some sources
    python3 scripts/fetch_data.py --refresh            # skip the change checks
    python3 scripts/fetch_data.py --skip acara-profile # leave sources out of the run
    python3 scripts/fetch_data.py --strict             # fail when any source has no usable copy

Each source is looked up through its publisher's API or download page, so a new yearly edition is
picked up without editing this file. data/sources/manifest.json records where every file came from.
A failed download never replaces a good copy, and a file put in data/sources/ by hand is used as is.
"""
import argparse
import csv
import hashlib
import html.parser
import http.client
import http.cookiejar
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/sources'
MANIFEST = DATA / 'manifest.json'
UA = 'where-are-the-schools-data-fetch/1.0 (+https://github.com/ShortestPathLab/viclens)'
DATAVIC = 'https://discover.data.vic.gov.au'
DTP = 'https://opendata.transport.vic.gov.au'
ABS_API = 'https://data.api.abs.gov.au/rest'
LGA_LAYER = 'https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/ArcGIS/rest/services/Vicmap_Admin/FeatureServer/9'
SA2_LAYER = 'https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SA2/FeatureServer/1'
NATURAL_EARTH = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson'
ACARA_PAGE = 'https://www.acara.edu.au/contact-us/acara-data-access'
ASL_HOME = 'https://asl.acara.edu.au/'
ASL_SEARCH = 'https://asl.acara.edu.au/School-Search?state=VIC'
DAY = 86400


class FetchError(Exception):
    pass


def now(moment=None):
    moment = datetime.fromtimestamp(moment, timezone.utc) if moment else datetime.now(timezone.utc)
    return moment.replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def age(stamp):
    return (datetime.now(timezone.utc) - datetime.fromisoformat(stamp.replace('Z', '+00:00'))).total_seconds()


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def get(url, data=None, headers=None, timeout=90, opener=None, method=None):
    """Return (body, headers, final url). Retries twice on network errors, 429 and 5xx."""
    request = urllib.request.Request(url, data=data, headers={'User-Agent': UA, **(headers or {})}, method=method)
    host = urllib.parse.urlsplit(url).netloc
    for attempt in range(3):
        try:
            with (opener.open if opener else urllib.request.urlopen)(request, timeout=timeout) as response:
                return response.read(), response.headers, response.geturl()
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise FetchError(f'HTTP {error.code} from {host}') from None
        except (OSError, http.client.HTTPException) as error:
            if attempt == 2:
                reason = getattr(error, 'reason', None) or error
                raise FetchError(f'{host}: {str(reason) or type(error).__name__}'[:160]) from None
        time.sleep(1 + attempt * 2)


def get_json(url, **params):
    return json.loads(get(f'{url}?{urllib.parse.urlencode(params)}' if params else url)[0])


# Downloads are tried in order until one passes its check.

def direct(url, timeout=180):
    def attempt():
        body, _, final = get(url, timeout=timeout)
        return body, final, None
    return attempt


def archived(url):
    # www.education.vic.gov.au/Documents/ was dropping every connection in October 2026, so fall back
    # to the newest good Internet Archive capture of the same URL.
    def attempt():
        query = urllib.parse.urlencode({'url': re.sub(r'^https?://', '', url), 'output': 'json', 'filter': 'statuscode:200', 'limit': '-1'})
        rows = json.loads(get(f'https://web.archive.org/cdx/search/cdx?{query}', timeout=60)[0].strip() or b'[]')
        if len(rows) < 2:
            raise FetchError('no Internet Archive capture')
        stamp, original = rows[-1][1], rows[-1][2]
        time.sleep(1)
        capture = f'https://web.archive.org/web/{stamp}id_/{original}'
        body = get(capture, timeout=180)[0]
        return body, capture, f'publisher host unreachable; Internet Archive capture of {stamp[:4]}-{stamp[4:6]}-{stamp[6:8]}'
    return attempt


def ckan_attempts(base, resource):
    attempts = [direct(f'{base}/datastore/dump/{resource["id"]}')] if resource.get('datastore_active') else []
    return attempts + [direct(resource['url']), archived(resource['url'])]


def ckan(action, base=DATAVIC, **params):
    result = get_json(f'{base}/api/3/action/{action}', **params)
    if not result.get('success'):
        raise FetchError(f'CKAN {action} failed')
    return result['result']


def ckan_series(prefix):
    """Datasets whose slug starts with prefix, keyed by the year in the slug."""
    series = {}
    for package in ckan('package_search', fq=f'name:{prefix}*', rows=200)['results']:
        match = re.search(r'(?<!\d)(20\d\d)(?!\d)', package['name'])
        if match and package['resources']:
            series[int(match.group(1))] = package
    if not series:
        raise FetchError(f'no DataVic datasets named {prefix}*')
    return series


def ckan_signal(resource):
    return '|'.join(str(resource.get(key) or '') for key in ('id', 'url', 'hash', 'filesize', 'size', 'last_modified', 'metadata_modified'))


def dataset_page(package, base=DATAVIC):
    return f'{base}/dataset/{package["name"]}'


# Checks run on the downloaded bytes before anything is written.

def text(data):
    try:
        return data.decode('utf-8-sig')
    except UnicodeDecodeError:
        return data.decode('cp1252')


def csv_check(columns, minimum):
    def check(data):
        rows = list(csv.reader(io.StringIO(text(data))))
        header = {cell.strip().strip('"').strip().lower() for cell in rows[0]} if rows else set()
        missing = {c for c in columns if c.lower() not in header}
        if missing or len(rows) - 1 < minimum:
            raise ValueError(f'unexpected CSV (missing {sorted(missing)}, {len(rows) - 1} rows)')
    return check


def zip_check(data):
    try:
        names = zipfile.ZipFile(io.BytesIO(data)).namelist()
    except zipfile.BadZipFile:
        raise ValueError('not a ZIP file') from None
    if not any(name.lower().endswith('.geojson') for name in names):
        raise ValueError('ZIP has no GeoJSON layers')


def xlsx_check(data):
    try:
        zipfile.ZipFile(io.BytesIO(data)).getinfo('xl/workbook.xml')
    except (zipfile.BadZipFile, KeyError):
        raise ValueError('not an XLSX workbook') from None


def features_check(minimum, test=None):
    def check(data):
        try:
            features = json.loads(data)['features']
        except (ValueError, KeyError, TypeError):
            raise ValueError('not a GeoJSON FeatureCollection') from None
        if len(features) < minimum or (test and not test(features)):
            raise ValueError(f'unexpected GeoJSON ({len(features)} features)')
    return check


def asl_check(data):
    try:
        rows = json.loads(text(data))
    except ValueError:
        raise ValueError('ASL export is not JSON') from None
    if not isinstance(rows, list) or len(rows) < 1500 or 'StateProvinceId' not in rows[0]:
        raise ValueError('unexpected ASL export')


class Run:
    def __init__(self, old, refresh):
        self.old_files = {f['path']: f for f in (old or {}).get('files', [])}
        self.refresh = refresh
        self.done = {}

    def obtain(self, *args, **kwargs):
        record = self.resolve(*args, **kwargs)
        self.done[record['path']] = record
        return record

    def resolve(self, rel, period, signal, attempts, check, max_age=None, published=None):
        """Return the manifest record for one file, downloading it only when needed."""
        path = DATA / rel
        old = self.old_files.get(rel)
        base = {'path': rel, 'period': period}
        if path.exists():
            data = path.read_bytes()
            digest = sha256(data)
            if old is None or old.get('origin') == 'manual' or old.get('sha256') != digest:
                # Placed or replaced by hand: use it as is and never overwrite it.
                try:
                    check(data)
                except ValueError as error:
                    warn(f'{rel} was added by hand but {error}; leaving it in place')
                    return {**base, 'url': published, 'status': 'missing', 'note': f'manual file failed its check: {error}'}
                known = old if old and old.get('origin') == 'manual' and old.get('sha256') == digest else None
                if known and known['signal'] != signal:
                    warn(f'{rel} was added by hand and the published file has changed since; replace it if needed')
                return {**base, 'url': published, 'signal': known['signal'] if known else signal, 'origin': 'manual',
                        'fetchedAt': known['fetchedAt'] if known else now(path.stat().st_mtime), 'sha256': digest, 'bytes': len(data),
                        'status': 'cached', 'note': 'manual drop-in'}
            if not self.refresh and old.get('signal') == signal:
                # Unchanged since the last download, so the copy is current.
                if max_age is None:
                    kept = {**old, **base, 'status': 'fresh', 'checkedAt': now()}
                    if kept.get('note', '').startswith(('download failed', 'no change check')):
                        del kept['note']
                    return kept
                if age(old['fetchedAt']) < max_age:
                    return {**old, **base, 'status': 'cached', 'note': f'no change check available; reusing the copy fetched {old["fetchedAt"][:10]}'}
        errors = []
        for attempt in attempts:
            try:
                data, url, note = attempt()
                check(data)
            except (FetchError, ValueError) as error:
                errors.append(str(error))
                continue
            path.parent.mkdir(parents=True, exist_ok=True)
            part = path.with_name(path.name + '.part')
            part.write_bytes(data)
            part.replace(path)
            record = {**base, 'url': url, 'signal': signal, 'origin': 'download', 'fetchedAt': now(), 'checkedAt': now(), 'sha256': sha256(data),
                      'bytes': len(data), 'status': 'fresh'}
            return {**record, 'note': note} if note else record
        reason = '; '.join(dict.fromkeys(errors)) or 'no download route'
        if path.exists():
            warn(f'{rel}: download failed ({reason}); keeping the copy from {old["fetchedAt"][:10]}')
            return {**old, **base, 'status': 'cached', 'note': f'download failed ({reason}); kept copy fetched {old["fetchedAt"][:10]}'}
        warn(f'{rel}: download failed ({reason})')
        return {**base, 'url': published, 'status': 'missing', 'note': f'download failed ({reason})'}


def warn(message):
    print(f'  warning: {message}', file=sys.stderr)


def newest_edition(record, old):
    """Fall back to the previous edition when the newest one has no copy yet."""
    if record['status'] != 'missing':
        return [record]
    previous = [f for f in (old or {}).get('files', []) if f.get('status') != 'missing' and (DATA / f['path']).exists()]
    if not previous:
        return [record]
    keep = max(previous, key=lambda f: f['period'])
    note = f'newest edition ({record["period"]}) has no copy yet; using {keep["period"]}'
    warn(note)
    return [{**keep, 'status': 'cached', 'note': note}]


# Sources. Each returns the parts of its manifest entry that vary from run to run.

def school_locations(run, old):
    series = ckan_series('school-locations-2')
    year = max(series)
    resource = next(r for r in series[year]['resources'] if (r.get('format') or '').upper() == 'CSV')
    record = run.obtain(f'school-locations/{year}.csv', str(year), ckan_signal(resource), ckan_attempts(DATAVIC, resource),
                        csv_check(['Education_Sector', 'School_No', 'School_Name', 'X', 'Y'], 1500), published=resource['url'])
    return {'page': dataset_page(series[year]), 'files': newest_edition(record, old)}


def enrolments(run, old):
    series = ckan_series('all-schools-fte-enrolments-')
    files = []
    for year in sorted(series):
        resource = series[year]['resources'][0]
        files.append(run.obtain(f'enrolments/{year}.csv', str(year), ckan_signal(resource), ckan_attempts(DATAVIC, resource),
                                csv_check(['School_No', 'Grand Total'], 1500), published=resource['url']))
    latest = max(series)
    missing = [f['period'] for f in files if f['status'] == 'missing']
    archive = [f['period'] for f in files if 'Internet Archive' in (f.get('note') or '')]
    manual = [f['period'] for f in files if f.get('origin') == 'manual']
    kept = [f['period'] for f in files if f['status'] == 'cached' and f.get('origin') != 'manual']
    notes = []
    if archive:
        notes.append(f'{span(archive)} from Internet Archive captures (publisher host unreachable)')
    if manual:
        notes.append(f'manual drop-in: {span(manual)}')
    if kept:
        notes.append(f'kept earlier copies after a failed download: {span(kept)}')
    if missing:
        notes.append(f'not fetched: {span(missing)}')
    # Per-year notes are summarised above rather than listed one by one.
    return {'page': dataset_page(series[latest]), 'files': files, 'note': '; '.join(notes) or None, 'fileNotes': False,
            'ok': files[-1]['status'] != 'missing'}


def school_zones(run, old):
    series = ckan_series('victorian-government-school-zones-')
    files = []
    # The newest two zone years: the current school year and the next one.
    for year in sorted(series)[-2:]:
        resource = series[year]['resources'][0]
        files.append(run.obtain(f'school-zones/{year}.zip', str(year), ckan_signal(resource), ckan_attempts(DATAVIC, resource), zip_check,
                                published=resource['url']))
    missing = [f['period'] for f in files if f['status'] == 'missing']
    note = ' '.join(f'Save the {year} ZIP from DataVic as data/sources/school-zones/{year}.zip.' for year in missing) or None
    return {'page': dataset_page(series[max(series)]), 'files': files, 'note': note}


def arcgis(layer, params):
    """Page through an ArcGIS FeatureServer query and return one GeoJSON FeatureCollection."""
    def attempt():
        features, offset = [], 0
        while True:
            page = json.loads(get(f'{layer}/query?{urllib.parse.urlencode({**params, "resultOffset": offset, "resultRecordCount": 1000})}', timeout=180)[0])
            if 'error' in page:
                raise FetchError(f'ArcGIS error: {page["error"].get("message")}')
            features += page['features']
            if not (page.get('exceededTransferLimit') or page.get('properties', {}).get('exceededTransferLimit')):
                break
            offset += len(page['features'])
            time.sleep(0.5)
        collection = {'type': 'FeatureCollection', 'features': features}
        return json.dumps(collection, separators=(',', ':')).encode(), f'{layer}/query?{urllib.parse.urlencode(params)}', None
    return attempt


def lga_boundaries(run, old):
    edited = (get_json(LGA_LAYER, f='json').get('editingInfo') or {}).get('dataLastEditDate')
    period = datetime.fromtimestamp(edited / 1000, timezone.utc).date().isoformat() if edited else 'current'
    params = {'where': '1=1', 'outFields': 'lga_code,lga_name,lga_official_name,abs_lga_code', 'outSR': 4326,
              'maxAllowableOffset': 0.00015, 'geometryPrecision': 6, 'orderByFields': 'OBJECTID', 'f': 'geojson'}
    signal = f'{edited}|{urllib.parse.urlencode(params)}'
    return {'files': [run.obtain('lga-boundaries/lga.geojson', period, signal, [arcgis(LGA_LAYER, params)], features_check(79))]}


def sa2_boundaries(run, old):
    params = {'where': "state_code_2021='2'", 'outFields': 'sa2_code_2021,sa2_name_2021,area_albers_sqkm', 'outSR': 4326,
              'geometryPrecision': 5, 'orderByFields': 'objectid', 'f': 'geojson'}
    # ASGS 2021 boundaries are frozen, so the query itself is the change signal.
    signal = urllib.parse.urlencode(params)
    return {'files': [run.obtain('abs-sa2-boundaries/sa2-2021.geojson', '2021', signal, [arcgis(SA2_LAYER, params)], features_check(500))]}


def natural_earth(run, old):
    check = features_check(100, lambda features: any(f['properties'].get('ADM0_A3') == 'AUS' for f in features))
    return {'files': [run.obtain('natural-earth/ne_50m_admin_0_countries.geojson', 'v5.1.2', NATURAL_EARTH, [direct(NATURAL_EARTH)], check)]}


class Links(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs, self.fields, self.buttons = [], [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a' and attrs.get('href'):
            self.hrefs.append(attrs['href'])
        if tag == 'input' and attrs.get('name'):
            kind = (attrs.get('type') or 'text').lower()
            if kind in ('submit', 'button', 'image'):
                self.buttons.append((attrs['name'], attrs.get('value') or ''))
            elif kind not in ('checkbox', 'radio') or 'checked' in attrs:
                self.fields.append((attrs['name'], attrs.get('value') or ''))


def parse(page):
    links = Links()
    links.feed(text(page))
    return links


def acara_profile(run, old):
    # The single-year file only. The multi-year history file is about 30 MB.
    editions = {}
    for href in parse(get(ACARA_PAGE)[0]).hrefs:
        match = re.search(r'/School Profile (\d{4})\.xlsx$', urllib.parse.unquote(href))
        if match:
            editions[int(match.group(1))] = urllib.parse.urljoin(ACARA_PAGE, href)
    if not editions:
        raise FetchError('no School Profile link on the ACARA data access page')
    year = max(editions)
    url = editions[year]
    try:
        headers = get(url, method='HEAD', timeout=60)[1]
        signal = '|'.join(headers.get(key) or '' for key in ('ETag', 'Last-Modified', 'Content-Length'))
    except FetchError:
        signal = url
    record = run.obtain(f'acara-profile/{year}.xlsx', str(year), f'{url}|{signal}', [direct(url)], xlsx_check)
    return {'files': newest_edition(record, old)}


def asl_export():
    # The JSON download is an ASP.NET postback: load the form, then submit it with the JSON button.
    def attempt():
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        form = parse(get(ASL_SEARCH, opener=opener)[0])
        button = next((b for b in form.buttons if b[0].endswith('btnClickJSON')), None)
        if not button:
            raise FetchError('ASL search page has no JSON download button')
        time.sleep(1)
        body, headers, _ = get(ASL_SEARCH, data=urllib.parse.urlencode(form.fields + [button]).encode(), opener=opener, timeout=180,
                               headers={'Content-Type': 'application/x-www-form-urlencoded', 'Referer': ASL_SEARCH})
        if 'json' not in (headers.get('Content-Type') or ''):
            raise FetchError('ASL postback did not return JSON')
        return body, ASL_SEARCH, None
    return attempt


def acara_asl(run, old):
    page = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', text(get(ASL_HOME)[0])))
    match = re.search(r'last updated on (\d{1,2} \w+ \d{4})', page)
    if match:
        period = datetime.strptime(match.group(1), '%d %B %Y').date().isoformat()
        record = run.obtain('acara-asl/asl-vic.json', period, f'updated {period}', [asl_export()], asl_check)
    else:
        record = run.obtain('acara-asl/asl-vic.json', 'current', 'unknown', [asl_export()], asl_check, max_age=7 * DAY)
    return {'files': [record]}


def fire_risk(run, old):
    files, pages = [], []
    for key, query, pattern in [('barr', 'bushfire at-risk register', 'bushfire-at-risk-register'), ('grassfire', 'grassfire category 4', 'grassfire')]:
        packages = [p for p in ckan('package_search', q=query, rows=50)['results'] if pattern in p['name'] and p['resources']]
        if not packages:
            raise FetchError(f'no DataVic dataset matching {pattern}')
        package = max(packages, key=lambda p: (re.findall(r'20\d\d', p['title'])[-1:], p['metadata_created']))
        resource = package['resources'][0]
        years = re.search(r'(20\d\d)-(20\d\d)', package['title'])
        period = f'{years.group(1)}-{years.group(2)[2:]}' if years else package['metadata_created'][:4]
        # The datastore copy is CSV. Without one, the publisher's XLSX is the only route.
        if resource.get('datastore_active'):
            files.append(run.obtain(f'fire-risk/{key}.csv', period, ckan_signal(resource), [direct(f'{DATAVIC}/datastore/dump/{resource["id"]}')],
                                    csv_check(['Facility name', 'Education sector', 'Town/Suburb'], 100)))
        else:
            files.append(run.obtain(f'fire-risk/{key}.xlsx', period, ckan_signal(resource), [direct(resource['url']), archived(resource['url'])], xlsx_check))
        pages.append(dataset_page(package))
    return {'page': pages[0], 'files': files}


def abs_flows():
    flows = json.loads(get(f'{ABS_API}/dataflow/ABS?detail=allstubs', headers={'Accept': 'application/vnd.sdmx.structure+json'})[0])
    return {f['id'] for f in flows['data']['dataflows']}


def abs_newer(flows, pattern, pinned):
    # SA2 tables stay on ASGS 2021 to match the SA2 2021 boundaries. Moving editions is a manual change.
    newer = sorted(f for f in flows if re.fullmatch(pattern, f) and f > pinned)
    if newer:
        print(f'  note: ABS has published {", ".join(newer)}; this pipeline still uses {pinned}')


def abs_query(flow, key, labels=False, **params):
    # LGA tables come with names, because LGA codes change between editions (Moreland became Merri-bek).
    return f'{ABS_API}/data/ABS,{flow},1.0.0/{key}?{urllib.parse.urlencode({**params, "format": "csvfilewithlabels" if labels else "csvfile"})}'


ABS_CHECK = csv_check(['OBS_VALUE', 'TIME_PERIOD'], 100)


def abs_seifa(run, old):
    abs_newer(abs_flows(), r'ABS_SEIFA\d{4}_SA2', 'ABS_SEIFA2021_SA2')
    files = []
    for area, flow in [('sa2', 'ABS_SEIFA2021_SA2'), ('lga', 'ABS_SEIFA2021_LGA')]:
        url = abs_query(flow, '.IRSD+IRSAD+IER+IEO.SCORE+RWSD', labels=area == 'lga')
        files.append(run.obtain(f'abs-seifa/{area}.csv', '2021', url, [direct(url)], ABS_CHECK))
    return {'files': files}


def abs_erp(run, old):
    flows = abs_flows()
    abs_newer(flows, r'ERP_ASGS\d{4}', 'ERP_ASGS2021')
    # LGA tables are republished on each year's LGA edition, so take the newest one.
    lga_flow = max(f for f in flows if re.fullmatch(r'ABS_ANNUAL_ERP_LGA\d{4}', f))
    ages = 'TOT+A04+A59+A10+A15'
    files = []
    for area, flow, key in [('sa2', 'ERP_ASGS2021', f'ERP.3.{ages}.SA2..A'), ('lga', lga_flow, f'ERP.3.{ages}..{lga_flow[-7:]}.A')]:
        # The latest year and the five before it, so the build can compare with five years earlier.
        url = abs_query(flow, key, labels=area == 'lga', lastNObservations=6)
        # The newest year held for Victoria as a whole is a cheap check for a new release.
        state = key.replace(f'.{ages}.SA2..', '.TOT.STE.2.').replace(f'.{ages}..{lga_flow[-7:]}.', '.TOT.2.STE.')
        check = get(abs_query(flow, state, lastNObservations=1), timeout=60)[0]
        latest = max(row['TIME_PERIOD'] for row in csv.DictReader(io.StringIO(text(check))))
        record = run.obtain(f'abs-erp/{area}.csv', 'latest', f'{url}|{latest}', [direct(url)], ABS_CHECK)
        if record['status'] != 'missing':
            years = sorted({row['TIME_PERIOD'] for row in csv.DictReader(io.StringIO(text((DATA / record['path']).read_bytes())))})
            record['period'] = f'{years[0]}-{years[-1]}'
        files.append(record)
    return {'files': files}


def abs_census(run, old):
    abs_newer(abs_flows(), r'C\d\d_G15_SA2', 'C21_G15_SA2')
    files = []
    types = '2+21+22+23+3+31+32+33'
    for area, flow, key in [('sa2', 'C21_G15_SA2', f'{types}.3..SA2.2'), ('lga', 'C21_G15_LGA', f'{types}.3...2')]:
        url = abs_query(flow, key, labels=area == 'lga')
        files.append(run.obtain(f'abs-census-g15/{area}.csv', '2021', url, [direct(url)], ABS_CHECK))
    return {'files': files}


def pt_stops(run, old):
    package = ckan('package_show', base=DTP, id='public-transport-lines-and-stops')
    resource = next(r for r in package['resources'] if 'stop' in (r.get('name') or '').lower() and (r.get('format') or '').lower() == 'geojson')
    check = features_check(1000, lambda features: {'STOP_ID', 'STOP_NAME', 'MODE'} <= set(features[0]['properties']))
    record = run.obtain('pt-stops/stops.geojson', (resource.get('last_modified') or resource.get('metadata_modified') or '')[:10] or 'current',
                        ckan_signal(resource), [direct(resource['url'])], check)
    return {'page': dataset_page(package, DTP), 'files': [record]}


def span(years):
    """Collapse ['2015', '2016', '2017', '2023'] into '2015-2017, 2023'."""
    numbers = sorted(int(y) for y in years)
    runs = []
    for n in numbers:
        if runs and n == runs[-1][1] + 1:
            runs[-1][1] = n
        else:
            runs.append([n, n])
    return ', '.join(str(a) if a == b else f'{a}-{b}' for a, b in runs)


DEPT = 'State of Victoria (Department of Education)'
DTP_NAME = 'State of Victoria (Department of Transport and Planning)'
ABS_NAME = 'Australian Bureau of Statistics'
ACARA = 'Australian Curriculum, Assessment and Reporting Authority (ACARA)'
CC_BY = 'CC BY 4.0'
SOURCE_LIST = [
    dict(id='school-locations', title='School Locations', publisher=DEPT, licence=CC_BY, required=True, fetch=school_locations,
         page=f'{DATAVIC}/dataset/school-locations-2026'),
    dict(id='enrolments', title='All Schools FTE Enrolments (February census)', publisher=DEPT, licence=CC_BY, required=True, fetch=enrolments,
         page=f'{DATAVIC}/dataset/all-schools-fte-enrolments-february-2026-victoria'),
    dict(id='school-zones', title='Victorian Government School Zones', publisher=DEPT, licence=CC_BY, fetch=school_zones,
         page=f'{DATAVIC}/dataset/victorian-government-school-zones-2027'),
    dict(id='lga-boundaries', title='Vicmap Admin LGA boundaries (LGA_POLYGON)', publisher=DTP_NAME, licence=CC_BY, required=True, fetch=lga_boundaries,
         page=f'{DATAVIC}/dataset/vicmap-admin-rest-api'),
    dict(id='natural-earth', title='Natural Earth 1:50m Admin 0 countries', publisher='Natural Earth', licence='Public domain', required=True,
         fetch=natural_earth, page='https://www.naturalearthdata.com/downloads/50m-cultural-vectors/'),
    dict(id='acara-profile', title='ACARA School Profile', publisher=ACARA, licence='My School terms of use (local use only, pending ACARA permission)',
         fetch=acara_profile, page=ACARA_PAGE),
    dict(id='acara-asl', title='Australian Schools List (Victoria)', publisher=ACARA, licence=CC_BY, fetch=acara_asl, page=ASL_SEARCH),
    dict(id='fire-risk', title='Bushfire At-Risk Register and grassfire Category 4 list', publisher=DEPT, licence=CC_BY, fetch=fire_risk,
         page=f'{DATAVIC}/dataset/de-2025-2026-bushfire-at-risk-register-february-2026'),
    dict(id='abs-seifa', title='SEIFA 2021 by SA2 and LGA', publisher=ABS_NAME, licence=CC_BY, fetch=abs_seifa,
         page='https://www.abs.gov.au/statistics/people/people-and-communities/socio-economic-indexes-areas-seifa-australia/latest-release'),
    dict(id='abs-erp', title='Estimated Resident Population by age, SA2 and LGA', publisher=ABS_NAME, licence=CC_BY, fetch=abs_erp,
         page='https://www.abs.gov.au/statistics/people/population/regional-population-age-and-sex/latest-release'),
    dict(id='abs-census-g15', title='Census 2021 G15 Type of educational institution attending, SA2 and LGA', publisher=ABS_NAME, licence=CC_BY,
         fetch=abs_census, page='https://www.abs.gov.au/census/find-census-data/datapacks'),
    dict(id='abs-sa2-boundaries', title='ASGS Edition 3 SA2 boundaries (generalised)', publisher=ABS_NAME, licence=CC_BY, fetch=sa2_boundaries,
         page='https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SA2/FeatureServer'),
    dict(id='pt-stops', title='Public Transport Lines and Stops (stops)', publisher=DTP_NAME, licence=CC_BY, fetch=pt_stops,
         page=f'{DTP}/dataset/public-transport-lines-and-stops'),
]


def summarise(spec, result):
    files = result['files']
    usable = [f for f in files if f['status'] != 'missing']
    # Fresh means downloaded or confirmed unchanged on this run. Cached means an older or hand-placed copy.
    status = 'missing' if not usable else 'cached' if any(f['status'] == 'cached' for f in usable) else 'fresh'
    primary = max(usable, key=lambda f: f['period']) if usable else None
    periods = sorted({f['period'] for f in usable})
    if len(periods) > 1 and all(p.isdigit() for p in periods):
        period = span(periods)
    else:
        period = ', '.join(periods) or None
    if len(usable) == 1:
        digest = usable[0]['sha256']
    elif usable:
        # Several files: hash the sorted list of per-file hashes.
        digest = sha256(''.join(f'{f["sha256"]}  {f["path"]}\n' for f in sorted(usable, key=lambda f: f['path'])).encode())
    else:
        digest = None
    labels = [f['period'] for f in files]
    labels = labels if len(set(labels)) == len(labels) else [f['path'] for f in files]
    notes = [f'{label}: {f["note"]}' if len(files) > 1 else f['note'] for label, f in zip(labels, files) if f.get('note')] if result.get('fileNotes', True) else []
    if result.get('note'):
        notes.append(result['note'])
    entry = {'id': spec['id'], 'title': spec['title'], 'publisher': spec['publisher'], 'licence': spec['licence'],
             'page': result.get('page') or spec['page'], 'url': primary['url'] if primary else None, 'period': period,
             'fetchedAt': max(f['fetchedAt'] for f in usable) if usable else None, 'checkedAt': now(), 'sha256': digest, 'status': status,
             'required': spec.get('required', False), 'ok': result.get('ok', bool(usable)), 'files': files}
    if notes:
        entry['note'] = '; '.join(dict.fromkeys(notes))
    return entry


def fallback(spec, old, run, error):
    """When discovery fails, keep this run's downloads and whatever copies the last run left behind."""
    kept = {f['path']: {**f, 'status': 'cached'} for f in (old or {}).get('files', []) if f.get('status') != 'missing' and (DATA / f['path']).exists()}
    files = [f for f in {**kept, **run.done}.values() if f['status'] != 'missing']
    warn(f'{spec["id"]}: {error}; {"keeping cached copies" if files else "no cached copy"}')
    return {'files': files, 'note': f'could not check for updates ({error})', 'page': (old or {}).get('page')}


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--only', nargs='+', metavar='ID', choices=[s['id'] for s in SOURCE_LIST], help='fetch only these sources')
    parser.add_argument('--refresh', action='store_true', help='download again even when nothing seems to have changed')
    parser.add_argument('--skip', nargs='+', metavar='ID', default=[], choices=[s['id'] for s in SOURCE_LIST], help='leave these sources out of the run')
    parser.add_argument('--strict', action='store_true', help='fail when any source in the run has no usable copy, not only a required one')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {'sources': {}}
    previous = manifest.get('sources', {})
    entries = dict(previous)
    ran = []
    for spec in SOURCE_LIST:
        if (args.only and spec['id'] not in args.only) or spec['id'] in args.skip:
            continue
        print(f'{spec["id"]} ...', flush=True)
        old = previous.get(spec['id'])
        run = Run(old, args.refresh)
        try:
            result = spec['fetch'](run, old)
        except (FetchError, ValueError, KeyError, IndexError, TypeError, StopIteration) as error:
            result = fallback(spec, old, run, error)
        entries[spec['id']] = summarise(spec, result)
        ran.append(spec['id'])
        order = [s['id'] for s in SOURCE_LIST]
        manifest = {'updatedAt': now(), 'sources': {k: entries[k] for k in sorted(entries, key=lambda k: order.index(k) if k in order else len(order))}}
        DATA.mkdir(parents=True, exist_ok=True)
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')

    print(f'\n{"source":<20}{"status":<9}{"period":<24}{"size":>9}  note')
    for key in ran:
        entry = entries[key]
        size = sum(f.get('bytes') or 0 for f in entry['files'] if f['status'] != 'missing')
        print(f'{key:<20}{entry["status"]:<9}{(entry["period"] or "-")[:23]:<24}{size / 1e6:>7.1f}MB  {entry.get("note") or ""}')
    failed = [key for key in ran if (entries[key]['required'] or args.strict) and not entries[key]['ok']]
    if failed:
        print(f'\n{"Sources" if args.strict else "Required sources"} without a usable copy: {", ".join(failed)}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
