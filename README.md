# Mood Commute · 気分通勤

[Urban emotion mapping](https://xuanx1.github.io/moodCommute/) for Tokyo + Osaka commutes — cyberpunk-CRT + 80s VHS-neon. Real OSM geometry, real published JR schedules, real Japanese tweets binned by hour-of-day. Two side-by-side loop maps + a drill-down rail show where stress, joy, fatigue, and six other emotions concentrate along the Yamanote and Osaka Loop lines, minute by minute.

> Live JST clock, real coast + rivers, ~92 real subway/metro lines, 47 real ward polygons, ~40+ trains gliding along the real track at published timetable speed. Hover any station for a neon emotion tooltip; click to inspect.

## What's on screen

Three side-by-side containers:

1. **TOKYO 東京** — JR Yamanote loop drawn from real OSM relation 5376382, all 23 special-ward boundaries, 74 subway/metro lines underneath in their official colors, live train icons spaced by JR's published timetable.
2. **OSAKA 大阪** — JR Osaka Loop, 24 city wards, 18 metro lines, same train treatment.
3. **DRILL-DOWN rail** — emotion filter, picked-station readout (top emotions + 24h stacked-area emotion chart + one real WRIME tweet matching the station's mood), Tokyo-vs-Osaka comparison bars, scrolling real-tweet voices list, rebel-nudge card.

Below: a global JST-locked time scrubber. Runs live by default, synced to your computer's clock translated to JST (UTC+9). Drag to scrub by 1-minute increments; click LIVE to re-engage. The ▶ button enables time-lapse playback (1 minute per ~2.5 real seconds).

## Run it

Everything is local. Open `index.html` directly in any modern browser — no build, no CDN, no internet. You may need to serve from a local HTTP server for `fetch()` of the GeoJSON files to work:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000/
```

Most browsers also work with `file://` if you launch with `--allow-file-access-from-files` (Chrome) or set `security.fileuri.strict_origin_policy = false` (Firefox).

## File layout

```
index.html         entrypoint
tokens.css         CRT/VHS palette, emotion colors, neon/glow tokens
data.js            station coords + WRIME loader + per-station moodAt() generator
trains.js          schedule simulator (frequency table → train positions)
shared.jsx         TopMap widget, projection, GeoJSON loaders, chrome
viz/city-panel.jsx Per-city panel (header + map + footer mood mix)
viz/rail-panel.jsx Drill-down rail (filter, picked station, voices, nudge)
viz/scrubber.jsx   Bottom time scrubber + LIVE/JST controls
app.jsx            App shell

vendor/            React 18.3.1, ReactDOM 18.3.1, Babel 7.29.0 (UMD bundles)
vendor/fonts.css   @font-face for Bebas Neue / Major Mono Display / VT323
vendor/fonts/      8 woff2 files for the latin fonts

geo/               6 GeoJSON layers (loaded via fetch at runtime)
  yamanote.geojson
  osaka-loop.geojson
  tokyo-subway.geojson  / osaka-subway.geojson
  tokyo-wards.geojson   / osaka-wards.geojson
  tokyo-coast.geojson   / osaka-coast.geojson
  tokyo-rivers.geojson  / osaka-rivers.geojson

data/              wrime-hourly.json + wrime-voices.json
```

## Fonts

All five faces are vendored locally in `vendor/fonts/` (375 woff2 files total — most of the bulk is Japanese ideograph subsets) and loaded via `vendor/fonts.css`:

- **Bebas Neue** — display, latin
- **Major Mono Display** — display, latin
- **VT323** — pixel-CRT digit/clock, latin
- **DotGothic16** — pixel-art kana/kanji
- **Shippori Mincho B1** — neon serif kana/kanji (weights 500, 700)

## Data sources

| Layer | Source | Real? |
|---|---|---|
| Yamanote track geometry | OSM relation 5376382 → GeoJSON | ✅ |
| Osaka Loop track geometry | OSM relation 1864758 → GeoJSON | ✅ |
| Tokyo subway/metro lines (74) | Overpass `route=subway` near Tokyo | ✅ |
| Osaka metro lines (18) | Overpass `route=subway` near Osaka | ✅ |
| Tokyo ward polygons (23) | Overpass `admin_level=7 name~区$` | ✅ |
| Osaka ward polygons (24) | Overpass `admin_level=7` inside Osaka City | ✅ |
| Coastlines | Overpass `natural=coastline` | ✅ |
| Major rivers | Overpass `waterway=river` (Sumida, Arakawa, Yodogawa…) | ✅ |
| Station lat/lon | Wikipedia / OSM nodes | ✅ |
| Yamanote/Osaka Loop schedule frequencies | JR East / JR West published timetables | ✅ |
| Peak congestion ratios (157% / 108%) | MLIT 鉄道混雑率調査 | ✅ |
| Commuter emotions per hour | **WRIME** corpus — 35k real Japanese tweets w/ Plutchik labels | ✅ (not commute-specific) |
| Drill-down quotes | WRIME tweets matched to current emotion + hour | ✅ (not Tokyo-specific) |
| Per-station emotion variation | Synthetic — see [Per-station variation](#per-station-variation) | ⚠️ Modeled |
| Live train *positions* | Modeled from published frequencies + loop times | ⚠️ Simulated |

The geographic skeleton is entirely real OSM. The mood data is real Japanese-language emotion at hour resolution; the *attribution of those emotions to specific stations* is modeled, because no public per-station-per-time-of-day commuter sentiment dataset exists. The methodology below spells out exactly what's interpolated and how.

# Methodology

## Coordinate system + projection

- Stations, rail lines, wards, coast, rivers — all in **WGS84** (lon/lat).
- The map is rendered with an **equirectangular projection** tuned for the city's mean latitude: `x` scaled by `cos(meanLat)` so the loop reads as the right shape at ~35°N (Tokyo) and ~34°N (Osaka) without warping. Real coastlines and the JR loops have their actual angular ratios, not just bounding-box stretches.
- A small inner padding (12% on each side of the loop's bbox) prevents station labels from clipping the panel edge.
- A 1 km scale bar and a magnetic-north compass live in the top right of each map.

## Real-data layers

### Rail tracks (Yamanote, Osaka Loop)

Source: [OpenStreetMap relations 5376382 + 1864758](https://www.openstreetmap.org), exported via Overpass:

```
[out:json][timeout:30];
relation["route"="railway"]["name"~"山手線"];
out geom;
```

The relations are MultiLineStrings (one path per direction + per JR sub-segment). For each relation we keep only the longest sub-LineString (918 pts Yamanote, 600 pts Osaka), which traces the full loop in one direction. Saved as `geo/yamanote.geojson` / `geo/osaka-loop.geojson`.

The loader (`useGeoJSON` in `shared.jsx`) flattens MultiLineString into a single coordinate array; the map renderer projects each point and draws an SVG `<path>` with a wide blurred glow stroke + narrow core stroke + white highlight, so the line glows neon against the dark background.

### Subway / metro networks

Overpass query (Tokyo example):

```
[out:json][timeout:60];
area["name:en"="Tokyo"]["admin_level"=4]->.a;
relation["route"="subway"](area.a);
out geom;
```

74 lines for Tokyo, 18 for Osaka. The OSM relations carry their official line colors as the `colour` tag (`#F62E36` Marunouchi, `#FF9500` Ginza, `#B5B5AC` Hibiya, etc.). The renderer draws each line as a glow pass + core pass in its real color, *underneath* the JR loop so the loop sits on top.

### Ward polygons

```
[out:json][timeout:90];
relation["admin_level"="7"]["name"~"区$"]["boundary"="administrative"];
out geom;
```

23 Tokyo special wards + 24 Osaka City wards as Polygon/MultiPolygon. Drawn as dashed cyan outlines with a barely-tinted fill (alternating violet/blue at 3% opacity to disambiguate adjacent wards). Centroid labels in kanji + romaji.

### Coast + rivers

`natural=coastline` for coast, `waterway=river|canal` for rivers, named-filter to keep major waterways only (Sumida, Arakawa, Tama, Kanda in Tokyo; Yodogawa, Yamato, Dotonbori, Ajigawa, Kizugawa in Osaka). Drawn in cyan with a soft drop-shadow glow, behind everything else.

### Stations

Hardcoded WGS84 lat/lon per station from Wikipedia/OSM nodes — see `data.js`. We don't use OSM's station nodes directly because the timetable simulator needs an ordered ring of stations matching the published Yamanote sequence.

## Train schedule simulation

This is the half that's *modeled*, not real-time.

### Frequency table

From JR East / JR West printed timetables, trains per hour per direction:

| Hour | Yamanote | Osaka Loop |
|---:|---:|---:|
| 04 | 2 | 2 |
| 06 | 18 | 12 |
| 08 | 24 (peak) | 16 (peak) |
| 12 | 12 | 10 |
| 18 | 24 (peak) | 16 (peak) |
| 22 | 14 | 8 |
| 23 | 8 | 6 |
| 00–03 | 0 | 0 |

Encoded in `trains.js` as the `SCHEDULE` object — full 24-hour table for both lines.

### Loop time

- Yamanote: ~60 min for a full loop (published)
- Osaka Loop: ~40 min

### Steady-state train count

In each direction, the number of trains active on the loop at any moment is:

```
numPerDir = round(freq_per_hour × loop_minutes / 60)
```

So at 8am on Yamanote: `24 × 60 / 60 = 24` trains per direction × 2 directions = **48 trains** circling the loop. At 11pm: ~8 trains.

### Position along loop

Each train's launch is offset evenly around the cycle:

```
launchOffset_i = (i / numPerDir) × loop_minutes
phase_i = (current_minute + launchOffset_i) / loop_minutes  (mod 1)
position_i = pointAlongLine(coords, phase_i)
```

`pointAlongLine` computes arc-length cumulative distances along the OSM track (cached on the array via a `__cum` Float64Array), binary-searches for the target arc length at fraction `t`, and linearly interpolates the two bracketing vertices. So at any minute we can place every active train at its real position on the real track.

Inbound vs outbound: direction 1 uses `phase`, direction 2 uses `1 - phase`.

### Station intensity from trains

For each station, count trains within ~1.2 km (haversine):

```
near = Σ (1 - d_km / 1.2)  for d_km < 1.2
intensity = round((hour_freq_pct × MLIT_peak_pct × 0.7 + near × 12) × hub_factor)
```

Where `MLIT_peak_pct` is the published peak congestion ratio (Yamanote 157%, Osaka Loop 108% from MLIT's 鉄道混雑率調査). Hub stations (Shinjuku, Ikebukuro, Tokyo, Shibuya, Shinagawa, Ueno, Akihabara, Osaka, Kyobashi, Tennoji, Tsuruhashi) get a 1.25× boost for transfer congestion.

This produces the "loudest / calmest" pills in each city panel and modulates the mood-halo brightness.

## Emotion derivation

### WRIME corpus

[WRIME 1.5/2.0](https://github.com/ids-cv/wrime) (Kajiwara et al., NAACL 2021) is a 46k-tweet Japanese emotion corpus. Each tweet has:

- Full text + posted datetime
- Writer's self-labeled Plutchik 8-emotion scores (0–3)
- 3 readers' inferred scores (0–3) — we use the reader-average

Plutchik 8: **joy, sadness, anticipation, surprise, anger, fear, disgust, trust**.

### Hour-of-day binning

We parsed the `Datetime` field, took its hour (0–23), and averaged the reader-emotion vectors per bucket. Output: `data/wrime-hourly.json` — a 24-element array of `{n, joy, sadness, anticipation, surprise, anger, fear, disgust, trust}`. The bucket counts range from ~500 (deep night) to ~3000 (evening), so each hour has statistically meaningful sample size.

### Plutchik → 8 commute emotions

Our 8 emotions (stress/joy/fatigue/loneliness/anger/awe/boredom/calm) don't map 1:1 to Plutchik's 8. We use a linear mixing function (`plutchikToMood` in `data.js`):

```
joy        = Joy × 1.0 + Anticipation × 0.2
stress     = Fear × 1.2 + Anger × 0.2
fatigue    = Sadness × 0.45 + Disgust × 0.30 + max(0, 0.6 - Joy) × 0.40
loneliness = Sadness × 0.75 + max(0, 0.4 - Trust) × 0.20
anger      = Anger × 1.0 + Disgust × 0.20
awe        = Surprise × 0.85 + Anticipation × 0.40
boredom    = Disgust × 0.55 + max(0, 0.4 - (Joy + Surprise)/2) × 0.45
calm       = Trust × 1.5 + max(0, 0.4 - (Fear + Anger + Sadness)/3) × 0.35
```

The `max(0, threshold - x)` terms create *negative-evidence* signals — fatigue gets a boost when joy is absent, calm gets a boost when negative emotions are weak.

This is the city-wide baseline emotional mix at any hour of day, grounded in real human language.

### Minute-level interpolation

WRIME is binned at hour resolution. To drive the per-minute scrubber, we linearly interpolate between adjacent hours:

```
fraction = minute / 60
baseline = wrime[hour] × (1 - fraction) + wrime[(hour + 1) % 24] × fraction
```

So 8:30 reads as half the 8:00 mix + half the 9:00 mix.

### Per-station variation

The WRIME baseline is **citywide**. To prevent every station from showing the same emotion at the same minute, each station gets:

1. **Phase shift** — a deterministic offset in minutes (e.g. Shinjuku is `-8 min`, Tokyo Station is `+14 min`, Yurakuchō is `+28 min`). This means the morning rush "arrives" at different stations at different moments, creating a wave instead of a synchronous flash. Seed: station ID + hash.
2. **Per-(station, emotion) value noise** — each emotion at each station gets its own smooth random walk with a different period (45–260 min). Implemented as `valueNoise(seed, period)`: random values at integer intervals, smoothstep-interpolated. Multiplies the baseline by `(1 + n × 0.35)`, giving ±35% wobble. No two stations wobble in sync because each has a unique seed and period combo.
3. **Per-station traits** — hand-tuned biases for major stations (e.g. Akihabara: +awe +joy +loneliness; Shimbashi: +fatigue +boredom; Tsuruhashi: +joy +anger). Applied as `× (1 + trait × 0.12)`. About 15 named stations per city; the rest run on noise + baseline only.
4. **City bias** — Tokyo gets `stressMul × 1.25`, Osaka gets `joyMul × 1.35, angerMul × 1.15`. Matches the cliché but supported by WRIME prefecture splits.
5. **Sparse events** — each station has 4–10 deterministic "events" per day: 8–20-min emotion spikes with bell-shape envelopes. So "Akihabara at 14:23 gets a sudden awe spike for 15 min" can show up as a one-off pattern that doesn't recur on a different station.

### Result

The mood mix at `(station, hour, minute)` is:

```
v = plutchikToMood(wrimeBaseline(hour, minute, phaseShift))
for each emotion e:
    v[e] *= (1 + noise[e](t) × 0.35) × (1 + trait[e] × 0.12)
v.stress *= cityBias.stressMul
v.joy    *= cityBias.joyMul
v.anger  *= cityBias.angerMul
for each active event ev:
    v[ev.emotion] *= (1 + ev.strength × bellEnvelope(t, ev))
normalize v to percentages summing to 100
```

Deterministic — same `(station, hour, minute)` always produces the same numbers. So the maps animate smoothly as you scrub, but reloading shows the same patterns.

## Voices

The drill-down quote and the rail's voices list pull from `data/wrime-voices.json`. During the WRIME parse, we collected tweets where any single Plutchik emotion scored ≥ 2.5 (strongly dominant) and the tweet length was 8–90 chars (filter out URL-only and over-long entries). Up to 80 exemplars per emotion. Each one has `{text, hour, score}`.

**Picking which to display**: for the picked station's current dominant emotion, we map our emotion → Plutchik (e.g. `stress → fear`, `awe → surprise`), grab the pool of tweets in that bucket, sort by hour-of-day proximity to the current scrubber time, and pick deterministically using a seed combining station ID + emotion + hour. So Shinjuku at 8:47 with stress shows the same quote every time you land on that combo.

The voices list at the bottom shows one tweet per top-4 city emotion at the current moment, refreshing as you scrub through the day.

## Time

On mount, the app reads `Date.now()` from the user's clock, subtracts the local timezone offset, adds 9 hours → Japan Standard Time. A `setInterval(1000)` keeps it ticking by the second.

Dragging the scrubber drops out of live mode (clock turns from neon-lime to neon-pink, no seconds shown). Clicking the green LIVE button re-syncs to JST.

A separate **time-lapse** mode advances 1 min per 240ms tick, for watching the rush hours bloom.

# Customizing

**Swap geography** — drop replacement GeoJSON at any of the `geo/*.geojson` paths listed in [File layout](#file-layout). Each loader auto-detects `LineString` / `MultiLineString` / `Polygon` / `MultiPolygon` and uses the `colour`, `name`, `name:en` properties when present. The Overpass queries that produced the bundled files are in [Real-data layers](#real-data-layers).

**Swap emotions** — drop a different `data/wrime-hourly.json` (shape: 24-element array of `{n, joy, sadness, anticipation, surprise, anger, fear, disgust, trust}`) and `data/wrime-voices.json` (shape: `{<plutchik-emotion>: [{text, hour, score}, ...]}`).
