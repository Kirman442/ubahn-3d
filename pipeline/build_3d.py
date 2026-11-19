# 3D-сеть: глубина станций + z по трассе для участков приложения (с датами открытия/закрытия).
# Запуск из ubahn-data:  python scripts/build_3d.py
# Вход: stations/stations.json, app/berlinmetro/public/data/{stations,sections}.geojson,
#       osm/osm_{stations,stops,track_segments}.geojson, depth/depths_seed_v2.csv, depth/surface_dgm1.csv, depth/dgm1_cache.json
# Выход: depth/network3d.json (для three.js), depth/stations3d.csv (проверка), depth/lines3d_v2.geojson (z в координатах)
import json, math, csv, collections, re
L = lambda p: json.load(open(p, encoding='utf-8'))
DS = {s['id']: s for s in L('stations/stations.json')['stations']}
AST = L('app/berlinmetro/public/data/stations.geojson')['features']
ASE = L('app/berlinmetro/public/data/sections.geojson')['features']
OST = L('osm/osm_stations.geojson')['features']
OSP = L('osm/osm_stops.geojson')['features']
OTR = [f for f in L('osm/osm_track_segments.geojson')['features'] if f['properties']['_status'] == 'active']
SEEDROW = {(r['line'], r['name']): r for r in csv.DictReader(open('depth/depths_seed_v2.csv', encoding='utf-8-sig'), delimiter=';') if r['depth_m']}
SEED = {k: float(r['depth_m']) for k, r in SEEDROW.items()}
SURF = {r['id']: float(r['ground_dgm1_m']) for r in csv.DictReader(open('depth/surface_dgm1.csv', encoding='utf-8-sig'), delimiter=';') if r['ground_dgm1_m']}
# DGM1 je Stützpunkt (scripts/fetch_dgm1.mjs → depth/dgm1_cache.json); ohne Cache: linear zwischen den Bahnhöfen
try: DGM = json.load(open('depth/dgm1_cache.json', encoding='utf-8'))
except FileNotFoundError: DGM = {}
dgm = lambda c: DGM.get(f'{c[0]:.5f},{c[1]:.5f}')
MAX_GRADE = 0.040      # 40 ‰ – Höchstneigung Berliner U-Bahn (Rampen); stärkere Sprünge sind Datenfehler
STATION_FLAT = 45.0    # m: Bahnsteighälfte, Gleis dort waagerecht auf Bahnhofshöhe

def d(a, b): return math.hypot((a[0] - b[0]) * 67800, (a[1] - b[1]) * 111200)
def lvl(v):
    try: return min(float(x) for x in str(v).split(';'))
    except (TypeError, ValueError): return None
M_PER_LEVEL = 5.0
LEVEL_M = {-1: -5.0, -2: -8.0, -3: -12.0, -4: -14.0, -5: -16.0}   # калибровка по depths_seed_v2 (медианы)
# Gleisdreieck: U1/U3 auf der oberen Ebene; Kurfürstenstraße → Gleisdreieck 19 m Höhenunterschied (dewiki)
MANUAL = {('U1', 'Gleisdreieck'): (12.0, 'abgeleitet (Wikipedia)'), ('U3', 'Gleisdreieck'): (12.0, 'abgeleitet (Wikipedia)')}
MANUAL_NOTE = 'aus dem Höhenunterschied Kurfürstenstraße → Gleisdreieck (19 m, dewiki) abgeleitet'

# Herkunft und Genauigkeit je Wert (Paket 2): z bleibt unverändert, zusätzlich werden Art, Genauigkeit,
# Bezugsangabe und Quelle exportiert. Keine erfundene Fehlerspanne: nur was die Quelle selbst angibt.
#   kind: quelle (Zahl aus Quelle) | abgeleitet (aus Quellenzahlen berechnet) | modell (Schätzung des Modells)
#   prec: punkt | ca | rund | spanne   (nur bei quelle);  rng: [a, b] in m mit Vorzeichen wie z
def provenance(line, name, z, src):
    if src.startswith('gemessen'):
        r = SEEDROW[(line, name)]; p = (r['precision'] or '').strip()
        m = re.match(r'^(\d+(?:[.,]\d+)?)\s*[–-]\s*(\d+(?:[.,]\d+)?)', p)
        out = {'kind': 'quelle', 'ref': r['reference'], 'quelle': r['source']}
        if m:
            sg = -1 if z < 0 else 1
            # angabe: Originalschreibweise der Quelle (z. B. «4–5 m»), rng in Quellreihenfolge; die UI ordnet für die Anzeige
            out.update(prec='spanne', rng=[sg * float(m.group(1).replace(',', '.')), sg * float(m.group(2).replace(',', '.'))], angabe=p)
        elif p in ('ca.', 'rund'): out['prec'] = 'ca' if p == 'ca.' else 'rund'
        else: out['prec'] = 'punkt'
        return out
    if src.startswith('abgeleitet'): return {'kind': 'abgeleitet', 'quelle': MANUAL_NOTE}
    method = {'Lage': 'Bauart (Lage)', 'Standard': 'Standardwert'}.get(src)
    if method is None: method = 'OSM-Bahnsteigebene' + (f', relativ zur Quellenangabe {src.split("rel. ")[1]}' if 'rel.' in src else '')
    return {'kind': 'modell', 'methode': method}
LAGE_M = {'Viadukt': 6.5, 'Damm': 3.0, 'Plan': 0.0, 'Einschnitt': -4.0, 'Tunnel': -6.0}

# --- уровни платформ OSM по станции (через wikidata станции OSM, иначе по расстоянию)
osm_by_wd = {f['properties']['wikidata']: f for f in OST if f['properties'].get('wikidata')}
plats = [f for f in OSP if f['geometry'] and f['properties'].get('_role', '').startswith(('platform', 'stop'))]
def osm_level(s, coord):
    st = osm_by_wd.get(s.get('wikidata'))
    c0 = st['geometry']['coordinates'] if st else coord
    near = [f for f in plats if f['properties'].get('_line') == s['line'] and d(f['geometry']['coordinates'], c0) < 350]
    lv = [x for x in (lvl(f['properties'].get('level')) for f in near) if x is not None]
    return (collections.Counter(lv).most_common(1)[0][0] if lv else None), bool(st)

# --- z станций
rows, Z, G = [], {}, {}
for f in AST:
    p = f['properties']; s = DS.get(p['id'], p); c = f['geometry']['coordinates']
    lage = (s.get('situation') or '').split()[0] if s.get('situation') else None
    level, by_wd = osm_level(s, c)
    if (s['line'], s['name']) in SEED: z, src = SEED[(s['line'], s['name'])], 'gemessen (Wikipedia)'
    elif (s['line'], s['name']) in MANUAL: z, src = MANUAL[(s['line'], s['name'])]
    elif lage in ('Viadukt', 'Damm', 'Plan'): z, src = LAGE_M[lage], 'Lage'
    elif level is not None and level < 0:
        z, src = LEVEL_M.get(int(level), -18.0), 'OSM level'
        if lage == 'Einschnitt': z = max(z, -4.0)
    elif lage in LAGE_M: z, src = LAGE_M[lage], 'Lage'
    else: z, src = -6.0, 'Standard'
    Z[p['id']] = z; G[p['id']] = SURF.get(p['id'])
    rows.append(dict(id=p['id'], line=s['line'], name=s['name'], lage=lage, level=level, osm_wikidata=by_wd, z=z, src=src, coord=c))

# пересадочные узлы: глубины по уровню считаем относительно измеренной линии того же узла
node = collections.defaultdict(list)
for r in rows: node[DS.get(r['id'], {}).get('wikidata') or r['name']].append(r)
for grp in node.values():
    ref = [r for r in grp if r['src'].startswith('gemessen') and r['level'] is not None]
    if not ref: continue
    rf = ref[0]
    for r in grp:
        if r['src'] == 'OSM level' and r['level'] is not None:
            zr = round(rf['z'] + (r['level'] - rf['level']) * M_PER_LEVEL, 1)
            if zr <= -3 and abs(zr - r['z']) < 4:   # только если не противоречит грубой оценке по уровню
                r['z'] = Z[r['id']] = zr
                r['src'] = f"OSM level rel. {rf['line']}"

# --- категории путей OSM (с поправкой на короткие «мосты» над улицами/каналами)
segs = []
for f in OTR:
    p = f['properties']; cs = f['geometry']['coordinates']
    ln = sum(d(a, b) for a, b in zip(cs, cs[1:]))
    if p.get('bridge'):
        Lv = lvl(p.get('level')) or lvl(p.get('layer'))
        k = ('bridge', 6.0 * (Lv if Lv and Lv > 1 else 1))
        if p.get('bridge') == 'yes' and ln < 60: k = ('ground', 0.0)   # короткий мост на уровне земли
    elif p.get('embankment') == 'yes': k = ('embankment', 3.0)
    elif p.get('cutting') == 'yes': k = ('cutting', -4.0)
    elif p.get('tunnel') in ('yes', 'building_passage'): k = ('tunnel', None)
    else: k = ('ground', 0.0)
    segs.append((k, p.get('_lines') or [], cs, ln))
grid = collections.defaultdict(list)
for i, (k, lines, cs, _ln) in enumerate(segs):
    for c in cs: grid[(int(c[0] * 1500), int(c[1] * 2500))].append((c, i))
def cat_at(c, line):
    # только пути своей линии (или без привязки к линии): иначе тоннель под чужим виадуком «прыгает» вверх
    best = None
    gx, gy = int(c[0] * 1500), int(c[1] * 2500)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for q, i in grid.get((gx + dx, gy + dy), []):
                ls = segs[i][1]
                if ls and line not in ls: continue
                dd = d(q, c) + (15 if not ls else 0)
                if best is None or dd < best[0]: best = (dd, i)
    return (segs[best[1]][0], segs[best[1]][3]) if best and best[0] < 30 else None

# --- z вдоль участков
by_name = collections.defaultdict(list)
for r in rows: by_name[(r['line'], r['name'])].append(r)
for r in rows:
    for n in DS.get(r['id'], {}).get('names') or []: by_name[(r['line'], n['name'])].append(r)
def st_for(line, name, c):
    cand = by_name.get((line, name)) or []
    return min(cand, key=lambda r: d(r['coord'], c)) if cand else None
def smooth_ground(cs, cum, ga, gb):
    T = cum[-1] or 1
    raw = [dgm(c) for c in cs]
    if ga is None or gb is None or any(v is None for v in raw):
        ga = ga if ga is not None else (gb if gb is not None else 35.0); gb = gb if gb is not None else ga
        raw = [v if v is not None else ga + (gb - ga) * cum[i] / T for i, v in enumerate(raw)]
    # Median ±150 m: Straßenniveau statt Böschungen, Einschnitte, Brückenrampen im DGM
    out = []
    for i in range(len(cs)):
        w = sorted(raw[j] for j in range(len(cs)) if abs(cum[j] - cum[i]) <= 150)
        out.append(w[len(w) // 2])
    return out

def grade_limit(h, cum, fixed, s=MAX_GRADE, it=4000):
    # Ausreißer über die zulässige Neigung zum Mittel der Nachbarn ziehen; Bahnhofsbereiche bleiben fest
    h = h[:]
    for _ in range(it):
        moved = 0
        for i in range(1, len(h) - 1):
            if fixed[i]: continue
            d1, d2 = cum[i] - cum[i - 1] or 0.1, cum[i + 1] - cum[i] or 0.1
            if abs(h[i] - h[i - 1]) / d1 > s or abs(h[i + 1] - h[i]) / d2 > s:
                target = (h[i - 1] * d2 + h[i + 1] * d1) / (d1 + d2)
                h[i] += 0.5 * (target - h[i]); moved += 1
        if not moved: break
    return h

# Geländehöhe je Bahnhof: Median DGM1 aller Stützpunkte der eigenen Linie im Umkreis 250 m (Bahngräben, Kanäle am Bahnhof) (für alle anschließenden Abschnitte gleich)
def station_ground(r):
    v = sorted(x for f in ASE if f['properties']['line'] == r['line'] for c in f['geometry']['coordinates']
               if d(c, r['coord']) <= 250 and (x := dgm(c)) is not None)
    return v[len(v) // 2] if v else G.get(r['id'])
if DGM:
    for r in rows: G[r['id']] = station_ground(r)

lines_out = []
for f in ASE:
    p = f['properties']; cs = f['geometry']['coordinates']
    a, b = st_for(p['line'], p['from'], cs[0]), st_for(p['line'], p['to'], cs[-1])
    za, zb = (a['z'] if a else -6.0), (b['z'] if b else -6.0)
    cum = [0.0]
    for u, v in zip(cs, cs[1:]): cum.append(cum[-1] + d(u, v))
    T = cum[-1] or 1
    ga = G.get(a['id']) if a else None; gb = G.get(b['id']) if b else None
    g = smooth_ground(cs, cum, ga, gb)
    A = (ga if ga is not None else g[0]) + za; B = (gb if gb is not None else g[-1]) + zb          # absolute Höhen der Bahnhöfe (m ü. NHN)
    h = []
    for i, c in enumerate(cs):
        t = cum[i] / T; lin_rel = za + (zb - za) * t; lin_abs = A + (B - A) * t
        hit = cat_at(c, p['line']) if p.get('source') != 'historisch' else None
        k, seg_len = hit if hit else (None, 0)
        # kurze Brücken/Dämme zwischen zwei Tunnelbahnhöfen: Tunnel (Kreuzungen, Kanäle, Datenfehler)
        if k and k[0] in ('bridge', 'embankment') and za < 0 and zb < 0 and seg_len < 200: k = ('tunnel', None)
        if k is None:
            h.append(lin_abs)                                   # ohne OSM-Gleis: gleichmäßige Neigung
        elif k[0] == 'tunnel':
            h.append(min(lin_abs, g[i] - 3.0))                  # Tunnel: gleichmäßig, mind. 3 m unter Gelände
        elif k[0] == 'bridge' or (za >= 5 and zb >= 5):
            # zwischen zwei Hochbahnhöfen bleibt das Gleis oben (Oberbaumbrücke, kurze Dammstücke im OSM)
            h.append(g[i] + (lin_rel if za > 0 and zb > 0 else LAGE_M['Viadukt']))
        else:
            h.append(g[i] + k[1])                               # Damm +3, Einschnitt −4, Plan 0
    # gleitendes Mittel 60 m, Bahnhofsbereiche waagerecht, dann Neigungsbegrenzung
    hs = [sum(w) / len(w) for w in ([h[j] for j in range(len(cs)) if abs(cum[j] - cum[i]) <= 60] for i in range(len(cs)))]
    fixed = [False] * len(cs)
    for i in range(len(cs)):
        if cum[i] <= min(STATION_FLAT, T / 3): hs[i], fixed[i] = A, True
        elif T - cum[i] <= min(STATION_FLAT, T / 3): hs[i], fixed[i] = B, True
    fixed[0] = fixed[-1] = True
    hs = grade_limit(hs, cum, fixed)
    # zweite Glättung 120 m gegen Knicke (Gelände-Sprünge über Tunneln), danach erneut begrenzen
    hs = [hs[i] if fixed[i] else sum(w) / len(w)
          for i, w in enumerate([hs[j] for j in range(len(cs)) if abs(cum[j] - cum[i]) <= 120] for i in range(len(cs)))]
    hs = grade_limit(hs, cum, fixed)
    # Bezugsfläche für z: linear zwischen den Bahnhofs-Geländehöhen. So bleibt z im flachen 3D-Modell ruhig
    # (Hügel, Brückenrampen, Bahngräben im DGM erzeugen keine Buckel), an den Enden gilt genau z = Bahnhofs-z.
    # Das DGM-Gelände (g_dgm) wird nur für die Physik (Tunnel unter Gelände, Viadukt über Gelände) und die Profile verwendet.
    gA, gB = A - za, B - zb
    gref = [gA + (gB - gA) * cum[i] / T for i in range(len(cs))]
    zs = [hh - gg for hh, gg in zip(hs, gref)]
    lines_out.append({'type': 'Feature', 'geometry': {'type': 'LineString', 'coordinates': [[c[0], c[1], round(zz, 1)] for c, zz in zip(cs, zs)]},
                      'properties': {**p, 'ground_m': [round(x, 2) for x in gref], 'ground_dgm_m': [round(x, 1) for x in g]}})

json.dump({'type': 'FeatureCollection', 'features': lines_out}, open('depth/lines3d_v2.geojson', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
net = {'stations': [{'id': r['id'], 'line': r['line'], 'name': r['name'], 'lon': r['coord'][0], 'lat': r['coord'][1], 'z': r['z'],
                     'ground': G.get(r['id']), 'src': r['src'], **provenance(r['line'], r['name'], r['z'], r['src'])} for r in rows],
       'sections': [{**{k: f['properties'][k] for k in ('line', 'from', 'to', 'opened') if k in f['properties']},
                     'closed': f['properties'].get('closed'), 'xyz': f['geometry']['coordinates'], 'g': f['properties']['ground_m'], 'g_dgm': f['properties']['ground_dgm_m']} for f in lines_out]}
json.dump(net, open('depth/network3d.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
with open('depth/stations3d.csv', 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.writer(fh, delimiter=';'); w.writerow(['id', 'line', 'name', 'lage', 'osm_level', 'osm_by_wikidata', 'z_m', 'source', 'ground_m'])
    for r in rows: w.writerow([r['id'], r['line'], r['name'], r['lage'], r['level'], r['osm_wikidata'], r['z'], r['src'], G.get(r['id'])])
print(collections.Counter(r['src'].split(' rel.')[0] for r in rows), len(lines_out), 'sections;',
      sum(r['osm_wikidata'] for r in rows), 'stations matched to OSM by wikidata')
