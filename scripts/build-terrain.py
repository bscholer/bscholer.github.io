#!/usr/bin/env python3
"""Fetch Smith Rock elevation, imagery, and river data into public/terrain.

Sources: USGS 3DEP (elevation, NAVD88), USGS NAIP (imagery), USGS NHD (river).
All grids are NAD83 / UTM 10N. Needs PROJ (cct) with network grids on, plus numpy and Pillow.
"""
import io
import json
import os
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'public' / 'terrain'
EPSG = 26910
GEO_TO_UTM = '+proj=pipeline +step +proj=unitconvert +xy_in=deg +xy_out=rad +step +proj=utm +zone=10 +ellps=GRS80'
UTM_TO_GEO = '+proj=pipeline +step +inv +proj=utm +zone=10 +ellps=GRS80 +step +proj=unitconvert +xy_in=rad +xy_out=deg'
# NAVD88 orthometric height to NAD83(2011) ellipsoidal height: h = H + N.
GEOID_N = ('+proj=pipeline +step +proj=unitconvert +xy_in=deg +xy_out=rad '
           '+step +proj=vgridshift +grids=us_noaa_g2018u0.tif +multiplier=1 '
           '+step +proj=unitconvert +xy_in=rad +xy_out=deg')
CENTER_LONLAT = (-121.1416, 44.3688)
EXTENT_M = 3600
GRID = 1025
ORTHO_PX = 2048

LANDMARKS = [
    ('Monkey Face', -121.1441, 44.3707, 'peak'),
    ('Misery Ridge', -121.1394, 44.3683, 'peak'),
    ('Smith Rock', -121.14704, 44.36312, 'peak'),
]


def cct(pipeline, points):
    text = ''.join(' '.join(str(v) for v in (*p, 0, 0)[:4]) + '\n' for p in points)
    out = subprocess.run(
        ['cct', '-d', '8', *pipeline.split()],
        input=text, capture_output=True, text=True, check=True,
        env={**os.environ, 'PROJ_NETWORK': 'ON'},
    ).stdout
    return [tuple(map(float, line.split()[:3])) for line in out.strip().splitlines()]


def to_utm(points):
    return [(x, y) for x, y, _ in cct(GEO_TO_UTM, points)]


def to_geo(points):
    return [(x, y) for x, y, _ in cct(UTM_TO_GEO, points)]


def fetch(url, params, tries=4):
    full = f'{url}?{urllib.parse.urlencode(params)}'
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(full, timeout=180) as r:
                return r.read()
        except urllib.error.HTTPError as err:
            # The USGS image servers return 504 under load. A retry usually works.
            if err.code < 500 or attempt == tries - 1:
                raise
            time.sleep(5 * (attempt + 1))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (cx, cy), = to_utm([CENTER_LONLAT])
    half = EXTENT_M / 2
    # 3DEP samples at pixel centres, so pad by half a cell to put grid nodes on the edges.
    cell = EXTENT_M / (GRID - 1)
    bbox = (cx - half - cell / 2, cy - half - cell / 2, cx + half + cell / 2, cy + half + cell / 2)

    tif = fetch('https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage', {
        'bbox': ','.join(map(str, bbox)), 'bboxSR': EPSG, 'imageSR': EPSG,
        'size': f'{GRID},{GRID}', 'format': 'tiff', 'pixelType': 'F32',
        'interpolation': 'RSP_BilinearInterpolation', 'f': 'image',
    })
    tmp = OUT / '_dem.tif'
    tmp.write_bytes(tif)
    dem = np.array(Image.open(tmp), dtype=np.float32)
    tmp.unlink()
    assert dem.shape == (GRID, GRID), dem.shape
    (OUT / 'smith-rock.u16').write_bytes(np.round(dem * 10).astype('<u2').tobytes())

    img = fetch('https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage', {
        'bbox': f'{cx - half},{cy - half},{cx + half},{cy + half}', 'bboxSR': EPSG, 'imageSR': EPSG,
        'size': f'{ORTHO_PX},{ORTHO_PX}', 'format': 'jpg', 'f': 'image',
    })
    Image.open(io.BytesIO(img)).convert('RGB').save(OUT / 'ortho.jpg', quality=84, optimize=True, progressive=True)

    lon_min, lat_min, lon_max, lat_max = -121.2, 44.33, -121.08, 44.41
    nhd = json.loads(fetch('https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6/query', {
        'geometry': f'{lon_min},{lat_min},{lon_max},{lat_max}', 'geometryType': 'esriGeometryEnvelope',
        'inSR': 4269, 'outSR': EPSG, 'spatialRel': 'esriSpatialRelIntersects',
        'where': "gnis_name = 'Crooked River'", 'outFields': 'gnis_name', 'f': 'json',
    }))
    river = []
    for feature in nhd['features']:
        for path in feature['geometry']['paths']:
            river.append([[round(x - cx, 1), round(cy - y, 1)] for x, y in path])

    def local(lon, lat):
        (x, y), = to_utm([(lon, lat)])
        return x - cx, cy - y

    def elev_at(x, z):
        i = int(round((x + half) / cell))
        j = int(round((z + half) / cell))
        return float(dem[min(max(j, 0), GRID - 1), min(max(i, 0), GRID - 1)])

    labels = []
    for name, lon, lat, kind in LANDMARKS:
        x, z = local(lon, lat)
        # Snap summits to the highest cell within 40 m, since the published points are approximate.
        r = int(40 / cell)
        i0, j0 = int(round((x + half) / cell)), int(round((z + half) / cell))
        win = dem[j0 - r:j0 + r + 1, i0 - r:i0 + r + 1]
        dj, di = np.unravel_index(np.argmax(win), win.shape)
        x = (i0 - r + di) * cell - half
        z = (j0 - r + dj) * cell - half
        labels.append({'name': name, 'x': round(x, 1), 'z': round(z, 1), 'elev': round(elev_at(x, z), 1), 'kind': kind})

    # Grid north and true north differ by about 1.3 degrees here, so keep all four corners.
    corners = to_geo([(cx - half, cy + half), (cx + half, cy + half), (cx - half, cy - half), (cx + half, cy - half)])
    geoid = [round(h, 3) for _, _, h in cct(GEOID_N, [(lon, lat, 0) for lon, lat in corners])]
    meta = {
        'source': 'USGS 3DEP, NAIP, NHD',
        'epsg': EPSG,
        'center': [round(cx, 2), round(cy, 2)],
        'extent': EXTENT_M,
        'grid': GRID,
        'minElev': round(float(dem.min()), 1),
        'maxElev': round(float(dem.max()), 1),
        'crs': 'NAD83 / UTM zone 10N',
        'verticalDatum': 'NAVD88',
        'corners': [[round(lon, 7), round(lat, 7)] for lon, lat in corners],
        'geoidN': geoid,
        'river': river,
        'labels': labels,
    }
    (OUT / 'meta.json').write_text(json.dumps(meta, separators=(',', ':')))
    print(json.dumps({k: v for k, v in meta.items() if k != 'river'}, indent=1), f'river paths: {len(river)}')


if __name__ == '__main__':
    main()
