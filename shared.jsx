// ─────────────────────────────────────────────────────────────
// MOOD COMMUTE · shared helpers
// Top-down lat/lon map · emotion glyphs · CRT chrome
// ─────────────────────────────────────────────────────────────

const { EMOTIONS, TOKYO_STATIONS, OSAKA_STATIONS, SHINJUKU_VOICES, REBEL_NUDGES, dominant, dominantLive, bbox } = window.MOOD_DATA;

// Tweaks context
const TweakCtx = React.createContext({
  nav: "diegetic", type: "mixed", density: "maximal",
  scanlines: true, vhsTint: true, glow: true,
});
const useTweak = () => React.useContext(TweakCtx);

// ─────────────────────────────────────────────────────────────
// Projection — equirectangular (good enough for ~10 km wide regions)
// Returns a function (lon, lat) → {x, y} in viewport pixels.
// `pad` adds margin inside the viewBox.
// ─────────────────────────────────────────────────────────────
function makeProjection({ minLon, maxLon, minLat, maxLat, vbW, vbH, pad = 30, aspectFix = true }) {
  // expand range so we never get a degenerate axis
  const dLon = Math.max(maxLon - minLon, 0.001);
  const dLat = Math.max(maxLat - minLat, 0.001);

  // longitude scale needs cos(lat) compensation at this latitude
  const meanLat = (minLat + maxLat) / 2;
  const lonScale = aspectFix ? Math.cos(meanLat * Math.PI / 180) : 1;
  const dLonAdj = dLon * lonScale;

  const usableW = vbW - pad * 2;
  const usableH = vbH - pad * 2;
  const scale = Math.min(usableW / dLonAdj, usableH / dLat);
  const w = dLonAdj * scale, h = dLat * scale;
  const ox = pad + (usableW - w) / 2;
  const oy = pad + (usableH - h) / 2;

  return (lon, lat) => ({
    x: ox + (lon - minLon) * lonScale * scale,
    y: oy + (maxLat - lat) * scale, // flip — lat increases northward, y decreases northward
  });
}

// ─────────────────────────────────────────────────────────────
// Catmull-Rom spline → SVG path (closed loop)
// Smooths a polyline so the rail track curves between stations
// instead of zigzagging in straight segments.
// ─────────────────────────────────────────────────────────────
function smoothClosedPath(points) {
  const n = points.length;
  if (n < 3) return points.map((p, i) => (i === 0 ? "M" : "L") + ` ${p.x} ${p.y}`).join(" ");
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d + " Z";
}

// ─────────────────────────────────────────────────────────────
// useGeoJSON — fetches an optional GeoJSON file from the project.
// If the file exists, returns its LineString coordinates; else null.
// Drop your own at geo/yamanote.geojson / geo/osaka-loop.geojson
// and the map will use it instead of the station-to-station polyline.
// ─────────────────────────────────────────────────────────────
function useGeoJSON(path) {
  const [coords, setCoords] = React.useState(null);
  React.useEffect(() => {
    let off = false;
    fetch(path)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (off || !j) return;
        // Try to extract a single LineString or first LineString of MultiLineString
        const tryExtract = (geom) => {
          if (!geom) return null;
          if (geom.type === "LineString") return geom.coordinates;
          if (geom.type === "MultiLineString") return geom.coordinates.flat();
          return null;
        };
        let pts = null;
        if (j.type === "FeatureCollection") {
          for (const f of (j.features || [])) {
            pts = tryExtract(f.geometry);
            if (pts) break;
          }
        } else if (j.type === "Feature") pts = tryExtract(j.geometry);
        else pts = tryExtract(j);
        if (pts && pts.length > 2) setCoords(pts);
      })
      .catch(() => {});
    return () => { off = true; };
  }, [path]);
  return coords;
}

// ─────────────────────────────────────────────────────────────
// useWaterGeoJSON — fetches coast/river polylines and polygons.
// Returns array of { kind, name, lines:[[[lon,lat]...]] }.
// ─────────────────────────────────────────────────────────────
function useWaterGeoJSON(path) {
  const [data, setData] = React.useState([]);
  React.useEffect(() => {
    let off = false;
    fetch(path)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (off || !j || j.type !== "FeatureCollection") return;
        const out = [];
        for (const f of (j.features || [])) {
          if (!f.geometry) continue;
          const lines = [];
          const polys = [];
          if (f.geometry.type === "LineString") lines.push(f.geometry.coordinates);
          else if (f.geometry.type === "MultiLineString") lines.push(...f.geometry.coordinates);
          else if (f.geometry.type === "Polygon") polys.push(f.geometry.coordinates[0]);
          else if (f.geometry.type === "MultiPolygon")
            for (const p of f.geometry.coordinates) polys.push(p[0]);
          else continue;
          const p = f.properties || {};
          out.push({
            id: String(out.length),
            kind: p.kind || (p.natural === "coastline" ? "coast" : "river"),
            name: p.name || "",
            lines, polys,
          });
        }
        if (!off) setData(out);
      })
      .catch(() => {});
    return () => { off = true; };
  }, [path]);
  return data;
}

// ─────────────────────────────────────────────────────────────
// useWardsGeoJSON — fetches a FeatureCollection of admin polygons.
// Returns array of { name, name_en, polygons:[[[lon,lat]...]] }.
// Handles Polygon + MultiPolygon; outer rings only (drops holes).
// ─────────────────────────────────────────────────────────────
function useWardsGeoJSON(path) {
  const [data, setData] = React.useState([]);
  React.useEffect(() => {
    let off = false;
    fetch(path)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (off || !j || j.type !== "FeatureCollection") return;
        const out = [];
        for (const f of (j.features || [])) {
          if (!f.geometry) continue;
          const polys = [];
          if (f.geometry.type === "Polygon") polys.push(f.geometry.coordinates[0]);
          else if (f.geometry.type === "MultiPolygon")
            for (const p of f.geometry.coordinates) polys.push(p[0]);
          else continue;
          const p = f.properties || {};
          out.push({
            id: p["@id"] || p.name || String(out.length),
            name: p.name || p["name:ja"] || "",
            name_en: p["name:en"] || p.name || "",
            polygons: polys,
          });
        }
        if (!off) setData(out);
      })
      .catch(() => {});
    return () => { off = true; };
  }, [path]);
  return data;
}

// ─────────────────────────────────────────────────────────────
// useLinesGeoJSON — fetches a FeatureCollection of subway lines.
// Returns an array of { name, name_en, color, lines:[[lon,lat]...] }.
// Each route relation in OSM may have a MultiLineString geometry made up
// of disjoint segments; we keep them as separate sub-paths so the renderer
// doesn't bridge gaps.
// ─────────────────────────────────────────────────────────────
function useLinesGeoJSON(path) {
  const [data, setData] = React.useState([]);
  React.useEffect(() => {
    let off = false;
    fetch(path)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (off || !j || j.type !== "FeatureCollection") return;
        const out = [];
        for (const f of (j.features || [])) {
          if (!f.geometry) continue;
          const sub = [];
          if (f.geometry.type === "LineString") sub.push(f.geometry.coordinates);
          else if (f.geometry.type === "MultiLineString") sub.push(...f.geometry.coordinates);
          else continue;
          // Drop very short stubs (junctions) and dedupe close-to-identical
          const lines = sub.filter(s => s && s.length >= 4);
          if (!lines.length) continue;
          const p = f.properties || {};
          out.push({
            id: p["@id"] || p.name || String(out.length),
            name: p.name || p["name:ja"] || "",
            name_en: p["name:en"] || p.ref || p.name || "",
            color: p.colour || p.color || "#888",
            lines,
          });
        }
        if (!off) setData(out);
      })
      .catch(() => {});
    return () => { off = true; };
  }, [path]);
  return data;
}

// ─────────────────────────────────────────────────────────────
// EmotionChip — small chip with kanji glyph + neon glow
// ─────────────────────────────────────────────────────────────
function EmotionChip({ emotion, size = 28, glow = true }) {
  const e = EMOTIONS.find(x => x.id === emotion);
  if (!e) return null;
  return (
    <div style={{
      width: size, height: size,
      background: e.color, color: "#0a0a0a",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--f-jp)", fontSize: size * 0.6, fontWeight: 700,
      lineHeight: 1, flexShrink: 0, borderRadius: 2,
      boxShadow: glow ? `0 0 ${size*0.35}px ${e.color}, 0 0 ${size*0.7}px ${e.color}55` : "none",
    }}>
      {e.glyph}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TopMap — top-down lat/lon map widget
// Props:
//   city: "tokyo" | "osaka"
//   stations[], hour, filter, picked, onPick
//   ringColor, glow, density
// ─────────────────────────────────────────────────────────────
function TopMap({ city, stations, hour, minute = 0, subMinute = 0, filter, picked, onPick, punched, ringColor, glow = true, hubOnly = false, showLandmarks = true }) {
  // If the rebel-nudge is punched and points at a station in this city,
  // that station's dominant emotion is overridden to the punched one — the
  // mood halo, station dot, and label all recolor.
  const punchedId = punched && punched.stationId;
  const punchedEmotion = punched && EMOTIONS.find(e => e.id === punched.emotion);
  // viewBox dims (the SVG drawing area)
  const vbW = 720, vbH = 560;

  // hover tooltip — { station, x, y } in viewport CSS pixels (not SVG units)
  const [hover, setHover] = React.useState(null);
  const svgRef = React.useRef(null);

  // bounding box — fit all stations + a hint of margin
  const box = React.useMemo(() => {
    const b = bbox(stations);
    // tight padding around the loop → ~20% zoom over the original baseline
    const padLat = (b.maxLat - b.minLat) * 0.025;
    const padLon = (b.maxLon - b.minLon) * 0.025;
    return {
      minLat: b.minLat - padLat, maxLat: b.maxLat + padLat,
      minLon: b.minLon - padLon, maxLon: b.maxLon + padLon,
    };
  }, [stations]);

  const project = React.useMemo(() => makeProjection({
    ...box, vbW, vbH, pad: 18, aspectFix: true,
  }), [box]);

  // optional override: real GeoJSON LineString dropped into the project
  const geojsonOverride = useGeoJSON(city === "osaka" ? "geo/osaka-loop.geojson" : "geo/yamanote.geojson");
  const geojsonProjected = React.useMemo(() => {
    if (!geojsonOverride) return null;
    return geojsonOverride.map(([lon, lat]) => project(lon, lat));
  }, [geojsonOverride, project]);

  // live train positions, derived from the real schedule at this hour:minute
  // Trains use fractional minute (minute + subMinute) so they glide smoothly
  // between integer-minute ticks. Mood/halos/labels stay on integer minute.
  const scheduleKey = city === "osaka" ? "loop" : "yamanote";
  const trains = React.useMemo(() => {
    if (!geojsonOverride) return [];
    return window.MOOD_TRAINS.trainsAt(geojsonOverride, scheduleKey, hour, minute + subMinute);
  }, [geojsonOverride, scheduleKey, hour, minute, subMinute]);
  const trainsProjected = React.useMemo(
    () => trains.map(t => ({ ...t, ...project(t.lon, t.lat) })),
    [trains, project]
  );

  // optional: subway / metro network underneath (real OSM data)
  const subwayLines = useLinesGeoJSON(city === "osaka" ? "geo/osaka-subway.geojson" : "geo/tokyo-subway.geojson");
  const subwayProjected = React.useMemo(() => {
    if (!subwayLines || !subwayLines.length) return null;
    return subwayLines.map(line => ({
      ...line,
      projected: line.lines.map(seg => seg.map(([lon, lat]) => project(lon, lat))),
    }));
  }, [subwayLines, project]);

  // optional: real ward polygons (admin boundaries)
  const wardsReal = useWardsGeoJSON(city === "osaka" ? "geo/osaka-wards.geojson" : "geo/tokyo-wards.geojson");
  const wardsProjected = React.useMemo(() => {
    if (!wardsReal || !wardsReal.length) return null;
    return wardsReal.map(w => {
      const polygons = w.polygons.map(ring => ring.map(([lon, lat]) => project(lon, lat)));
      // centroid for label
      let cx = 0, cy = 0, n = 0;
      for (const ring of polygons) for (const p of ring) { cx += p.x; cy += p.y; n++; }
      return { ...w, polygons, cx: cx/n, cy: cy/n };
    });
  }, [wardsReal, project]);

  // real coastlines + rivers
  const coast = useWaterGeoJSON(city === "osaka" ? "geo/osaka-coast.geojson" : "geo/tokyo-coast.geojson");
  const rivers = useWaterGeoJSON(city === "osaka" ? "geo/osaka-rivers.geojson" : "geo/tokyo-rivers.geojson");
  const coastProjected = React.useMemo(() =>
    coast.map(f => ({
      ...f,
      lines: f.lines.map(seg => seg.map(([lon, lat]) => project(lon, lat))),
      polys: f.polys.map(ring => ring.map(([lon, lat]) => project(lon, lat))),
    })), [coast, project]);
  const riversProjected = React.useMemo(() =>
    rivers.map(f => ({
      ...f,
      lines: f.lines.map(seg => seg.map(([lon, lat]) => project(lon, lat))),
      polys: f.polys.map(ring => ring.map(([lon, lat]) => project(lon, lat))),
    })), [rivers, project]);

  // station screen coords
  const pts = React.useMemo(() => stations.map(s => {
    const p = project(s.lon, s.lat);
    return { ...p, raw: s };
  }), [stations, project]);

  // closed smooth path through stations (when no GeoJSON override)
  const stationPath = React.useMemo(() => smoothClosedPath(pts), [pts]);

  // if GeoJSON override is present, build path from its coords
  const linePath = React.useMemo(() => {
    if (geojsonProjected) {
      // GeoJSON polyline — assume already follows track curves accurately, don't re-smooth
      let d = `M ${geojsonProjected[0].x.toFixed(1)} ${geojsonProjected[0].y.toFixed(1)}`;
      for (let i = 1; i < geojsonProjected.length; i++) {
        d += ` L ${geojsonProjected[i].x.toFixed(1)} ${geojsonProjected[i].y.toFixed(1)}`;
      }
      return d;
    }
    return stationPath;
  }, [geojsonProjected, stationPath]);

  // landmarks: REAL geography only — nothing synthetic.
  // Water bodies / rivers / palaces removed (they were fake placeholders).
  // The ward polygons (loaded from real OSM data above) ARE the orientation
  // cues we need; they collectively trace the city boundary.

  return (
    <div style={{ position: "absolute", inset: 0 }}>
    <svg ref={svgRef} viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>

      <defs>
        <pattern id={`grid-${city}`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,234,255,0.06)" strokeWidth="0.6" />
        </pattern>
        <pattern id={`grid-fine-${city}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(255,44,212,0.03)" strokeWidth="0.3" />
        </pattern>
      </defs>

      {/* faint grid background */}
      <rect width={vbW} height={vbH} fill={`url(#grid-fine-${city})`} />
      <rect width={vbW} height={vbH} fill={`url(#grid-${city})`} />

      {/* COASTLINE — real OSM coast polylines */}
      {showLandmarks && coastProjected.length > 0 && (
        <g style={{ pointerEvents: "none" }}>
          {coastProjected.map((f, fi) => (
            <g key={"c-" + fi}>
              {f.lines.map((seg, si) => (
                <polyline key={si}
                  points={seg.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke="rgba(0,234,255,0.55)" strokeWidth="1.5"
                  strokeLinejoin="round" strokeLinecap="round"
                  style={glow ? { filter: "drop-shadow(0 0 3px rgba(0,234,255,0.5))" } : {}} />
              ))}
              {f.polys.map((ring, ri) => (
                <polygon key={"p-" + ri}
                  points={ring.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                  fill="rgba(0,80,140,0.18)"
                  stroke="rgba(0,234,255,0.45)" strokeWidth="1"
                  style={glow ? { filter: "drop-shadow(0 0 3px rgba(0,234,255,0.3))" } : {}} />
              ))}
            </g>
          ))}
        </g>
      )}

      {/* RIVERS — real OSM waterways */}
      {showLandmarks && riversProjected.length > 0 && (
        <g style={{ pointerEvents: "none" }}>
          {riversProjected.map((f, fi) => (
            <g key={"r-" + fi}>
              {/* river polygon (banks) */}
              {f.polys.map((ring, ri) => (
                <polygon key={"rp-" + ri}
                  points={ring.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                  fill="rgba(0,80,140,0.22)"
                  stroke="rgba(0,234,255,0.4)" strokeWidth="0.6" />
              ))}
              {/* river centerline */}
              {f.lines.map((seg, si) => (
                <polyline key={"rl-" + si}
                  points={seg.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke="rgba(0,234,255,0.55)" strokeWidth="1.3"
                  strokeLinejoin="round" strokeLinecap="round"
                  style={glow ? { filter: "drop-shadow(0 0 2px rgba(0,234,255,0.4))" } : {}} />
              ))}
            </g>
          ))}
        </g>
      )}
      {/* WARDS — REAL admin boundary polygons (OSM admin_level=7) */}
      {showLandmarks && wardsProjected && (
        <g style={{ pointerEvents: "none" }}>
          {/* fill pass — very subtle alternating tints */}
          {wardsProjected.map((w, wi) => (
            <g key={"f-" + wi}>
              {w.polygons.map((ring, ri) => (
                <polygon key={ri}
                  points={ring.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                  fill={wi % 2 ? "rgba(74,139,245,0.035)" : "rgba(176,102,255,0.03)"}
                  stroke="none" />
              ))}
            </g>
          ))}
          {/* outline pass */}
          {wardsProjected.map((w, wi) => (
            <g key={"o-" + wi}>
              {w.polygons.map((ring, ri) => (
                <polygon key={ri}
                  points={ring.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke="rgba(180,200,235,0.40)"
                  strokeWidth="0.8"
                  strokeDasharray="3 2" />
              ))}
            </g>
          ))}
          {/* labels */}
          {wardsProjected.map((w, wi) => (
            <g key={"l-" + wi} transform={`translate(${w.cx.toFixed(1)},${w.cy.toFixed(1)})`}>
              <text fontFamily="var(--f-jp)" fontSize="10" fontWeight="500"
                fill="rgba(232,239,255,0.7)" textAnchor="middle"
                style={{ paintOrder: "stroke", stroke: "var(--bg-0)", strokeWidth: 2.5 }}>
                {w.name}
              </text>
              <text y="10" fontFamily="var(--f-display)" fontSize="8"
                fill="rgba(180,200,235,0.5)" letterSpacing=".22em"
                textAnchor="middle"
                style={{ paintOrder: "stroke", stroke: "var(--bg-0)", strokeWidth: 2 }}>
                {(w.name_en || w.name).toUpperCase()}
              </text>
            </g>
          ))}
        </g>
      )}

      {/* SUBWAY / METRO NETWORK underneath the JR loop */}
      {subwayProjected && (
        <g style={{ pointerEvents: "none" }}>
          {/* glow pass */}
          {glow && subwayProjected.map((line, li) => (
            <g key={li + "-g"} style={{ filter: "blur(2.5px)" }}>
              {line.projected.map((seg, i) => (
                <polyline key={i}
                  points={seg.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                  fill="none" stroke={line.color} strokeWidth="3" opacity="0.35"
                  strokeLinejoin="round" strokeLinecap="round" />
              ))}
            </g>
          ))}
          {/* core pass */}
          {subwayProjected.map((line, li) => (
            <g key={li}>
              {line.projected.map((seg, i) => (
                <polyline key={i}
                  points={seg.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                  fill="none" stroke={line.color} strokeWidth="1.2" opacity="0.75"
                  strokeLinejoin="round" strokeLinecap="round" />
              ))}
            </g>
          ))}
        </g>
      )}

      {/* RAIL LINE — smooth curved path, wide glow + narrow core */}
      {glow && (
        <path d={linePath} fill="none" stroke={ringColor} strokeWidth="12"
          opacity="0.22" strokeLinejoin="round" strokeLinecap="round"
          style={{ filter: "blur(4px)" }} />
      )}
      <path d={linePath} fill="none" stroke={ringColor} strokeWidth="5"
        opacity="0.55" strokeLinejoin="round" strokeLinecap="round" />
      <path d={linePath} fill="none" stroke={ringColor} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
      <path d={linePath} fill="none" stroke="#fff" strokeWidth="0.6"
        opacity="0.55" strokeLinejoin="round" strokeLinecap="round" />

      {/* LIVE TRAINS — bright contrasting dots, positions from real schedule.
          No CSS transition: smooth motion comes from the 4 Hz subMinute tick
          (sub-minute is interpolated, so each frame is a tiny step that never
          wraps mid-animation). A transition would (1) chase a moving target
          forever in live mode and (2) interpolate through screen center when
          a train crosses the loop seam. */}
      {trainsProjected.map((t, i) => {
        const dotColor = "#fff";
        return (
          <g key={i} transform={`translate(${t.x.toFixed(1)},${t.y.toFixed(1)})`}
             style={{ pointerEvents: "none" }}>
            {glow && (
              <circle r="9" fill={ringColor} opacity="0.5"
                style={{ filter: "blur(3px)" }} />
            )}
            <circle r="4.5" fill="var(--bg-0)" stroke={ringColor} strokeWidth="1.2" />
            <circle r="2.6" fill={dotColor}
              style={glow ? { filter: `drop-shadow(0 0 4px ${dotColor})` } : {}} />
            <circle cx={t.dir === 0 ? -6 : 6} r="1.2" fill={dotColor} opacity="0.45" />
            <circle cx={t.dir === 0 ? -10 : 10} r="0.8" fill={dotColor} opacity="0.22" />
          </g>
        );
      })}

      {/* tiny dotted attribution */}
      <text x={vbW - 50} y={vbH - 10} fontFamily="var(--f-mono)" fontSize="9"
        fill="rgba(180,200,235,.4)" textAnchor="end">
        {geojsonProjected ? "TRACK · GEOJSON" : "TRACK · INTERPOLATED"}
        {subwayProjected ? ` · ${subwayProjected.length} SUB` : ""}
        {trainsProjected.length ? ` · ${trainsProjected.length} TRAINS` : ""}
      </text>

      {/* MOOD HALOS per station — soft, multiply-blended so metro lines underneath stay visible.
          Intensity now driven by REAL train density (schedule + nearby live trains). */}
      {pts.map(({ x, y, raw }) => {
        const isPunched = punchedId === raw.id && !!punchedEmotion;
        const dom = dominantLive(raw, hour, minute);
        const effectiveId = isPunched ? punchedEmotion.id : dom.id;
        if (filter.size && !filter.has(effectiveId)) return null;
        // real intensity: count trains within ~1.2km
        let near = 0;
        for (const t of trains) {
          const d = window.MOOD_TRAINS.kmBetween([raw.lon, raw.lat], [t.lon, t.lat]);
          if (d < 1.2) near += 1 - (d / 1.2);
        }
        const freq = window.MOOD_TRAINS.SCHEDULE[scheduleKey][hour] || 0;
        const peakFreq = Math.max(...window.MOOD_TRAINS.SCHEDULE[scheduleKey]);
        const hourMul = peakFreq ? freq / peakFreq : 0;
        // Punched station gets a guaranteed-visible halo (the commitment
        // should glow even at off-peak hours) by flooring its intensity.
        const rawIntensity = hourMul * 1.2 + near * 0.18;
        const intensity = Math.min(2, isPunched ? Math.max(rawIntensity, 0.9) : rawIntensity);
        if (intensity < 0.02) return null;
        const color = isPunched
          ? punchedEmotion.color
          : EMOTIONS.find(e => e.id === dom.id).color;
        const baseR = raw.hub ? 22 : 14;
        const r = baseR * (0.45 + intensity * 0.85);
        return (
          <g key={raw.id + "-halo"} transform={`translate(${x},${y})`}
             style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
            {glow && (
              <circle r={r * 2.4} fill={color} opacity={0.045 * intensity}
                style={{ filter: "blur(12px)" }} />
            )}
            <circle r={r * 1.6} fill={color} opacity={0.09 * intensity}
              style={{ filter: glow ? "blur(6px)" : "none" }} />
            <circle r={r} fill={color} opacity={0.16 * intensity}
              style={{ filter: glow ? "blur(2px)" : "none" }} />
          </g>
        );
      })}

      {/* STATIONS + labels */}
      {pts.map(({ x, y, raw }, i) => {
        const isPunched = punchedId === raw.id && !!punchedEmotion;
        const dom = dominantLive(raw, hour, minute);
        const effectiveId = isPunched ? punchedEmotion.id : dom.id;
        const dim = filter.size && !filter.has(effectiveId);
        const c = isPunched
          ? punchedEmotion.color
          : EMOTIONS.find(e => e.id === dom.id).color;
        const isPicked = picked === raw.id;
        // push label outward from loop centroid
        const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
        const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
        const dx = x - cx, dy = y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const offset = (raw.hub ? 14 : 10);
        const lx = (dx / dist) * offset;
        const ly = (dy / dist) * offset;
        const anchor = lx > 4 ? "start" : lx < -4 ? "end" : "middle";

        // hover tooltip — top-3 emotions + intensity, custom styled card on hover
        const mix = raw.moodAt(hour, minute);
        const top3 = EMOTIONS.map(e => ({ id: e.id, jp: e.jp, en: e.en, color: e.color, glyph: e.glyph, v: mix[e.id] }))
          .sort((a, b) => b.v - a.v).slice(0, 3);
        const key = raw.ring === "loop" ? "loop" : "yamanote";
        const intensity = window.MOOD_TRAINS
          ? Math.round((window.MOOD_TRAINS.SCHEDULE[key][hour] / Math.max(...window.MOOD_TRAINS.SCHEDULE[key])) * window.MOOD_TRAINS.PEAK_CONGESTION[key] * (raw.hub ? 1.18 : 0.92))
          : 0;

        const onEnter = (e) => {
          const svg = svgRef.current;
          if (!svg) return;
          const r = svg.getBoundingClientRect();
          // station screen position in viewport (page) coords so the tooltip
          // can be portal'd to <body> and escape any ancestor overflow:hidden
          const sx = r.left + (x / vbW) * r.width;
          const sy = r.top + (y / vbH) * r.height;
          setHover({ id: raw.id, jp: raw.jp, en: raw.en, hub: raw.hub, top3, intensity, sx, sy, ringColor });
        };
        const onLeave = () => setHover(prev => prev && prev.id === raw.id ? null : prev);

        return (
          <g key={raw.id} transform={`translate(${x},${y})`}
             onClick={() => onPick && onPick(raw.id)}
             onMouseEnter={onEnter}
             onMouseLeave={onLeave}
             style={{ cursor: onPick ? "pointer" : "default", opacity: dim ? 0.18 : 1 }}>
            {/* invisible larger hit-target so hover is forgiving */}
            <circle r={raw.hub ? 16 : 12} fill="transparent" />
            {isPicked && (
              <>
                <circle r={raw.hub ? 22 : 16} fill="none" stroke={c} strokeWidth="1.4" strokeDasharray="3 3" />
                <circle r={raw.hub ? 30 : 22} fill="none" stroke={c} strokeWidth="0.8" opacity="0.6" />
              </>
            )}
            <circle r={raw.hub ? 7 : 4.5} fill={c}
              stroke="var(--bg-0)" strokeWidth="1.4"
              style={glow ? { filter: `drop-shadow(0 0 ${raw.hub?6:3}px ${c})` } : {}} />
            <circle r={raw.hub ? 3 : 2} fill="var(--bg-0)" />
            {isPunched && (
              <g style={{ pointerEvents: "none" }}>
                <circle r={raw.hub ? 18 : 13} fill="none" stroke="var(--neon-pink)"
                  strokeWidth="1" opacity="0.85"
                  style={{ animation: "rec-blink 1.6s infinite" }} />
                <g transform={`translate(0, ${raw.hub ? -22 : -16}) rotate(-8)`}>
                  <rect x="-22" y="-7" width="44" height="14" rx="1"
                    fill="rgba(7,5,13,0.92)" stroke="var(--neon-pink)" strokeWidth="1"
                    style={glow ? { filter: "drop-shadow(0 0 4px var(--neon-pink))" } : {}} />
                  <text y="3.5" fontFamily="var(--f-display)" fontSize="8.5"
                    fontWeight="700" letterSpacing=".22em"
                    textAnchor="middle" fill="var(--neon-pink)"
                    style={glow ? { filter: "drop-shadow(0 0 3px var(--neon-pink))" } : {}}>
                    ✦ AURA
                  </text>
                </g>
              </g>
            )}
            {(!hubOnly || raw.hub) && (
              <g transform={`translate(${lx}, ${ly + (ly > 0 ? 6 : -2)})`}>
                <text fontFamily="var(--f-jp)" fontSize={raw.hub ? 13 : 10}
                      fontWeight={raw.hub ? 700 : 500}
                      textAnchor={anchor}
                      fill="var(--ink)"
                      style={{ paintOrder: "stroke", stroke: "var(--bg-0)", strokeWidth: 3.5 }}>
                  {raw.jp}
                </text>
                <text y={raw.hub ? 11 : 9}
                      fontFamily="var(--f-display)"
                      fontSize={raw.hub ? 9 : 7.5}
                      letterSpacing=".12em"
                      textAnchor={anchor}
                      fill={raw.hub ? c : "var(--ink-mute)"}
                      style={{ paintOrder: "stroke", stroke: "var(--bg-0)", strokeWidth: 2.5 }}>
                  {raw.en.toUpperCase()}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* SCALE BAR — bottom-right, 1km */}
      <ScaleBar project={project} box={box} />

      {/* COMPASS — top-right */}
      <Compass />
    </svg>

    {/* HOVER TOOLTIP — portal'd to <body> so it isn't clipped by the city
        panel's overflow:hidden */}
    {hover && ReactDOM.createPortal(
      <div style={{
        position: "fixed",
        left: hover.sx + 14,
        top: Math.max(8, hover.sy - 110),
        zIndex: 9999,
        pointerEvents: "none",
        minWidth: 200,
        maxWidth: 240,
        padding: "9px 11px",
        background: "rgba(7,5,13,0.94)",
        border: `1px solid ${hover.ringColor}`,
        borderRadius: 2,
        boxShadow: `0 0 14px ${hover.ringColor}66, 0 4px 16px rgba(0,0,0,.55)`,
        fontFamily: "var(--f-body)",
        color: "var(--ink)",
        clipPath: "polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))",
      }}>
        <svg viewBox="0 0 10 10" width="10" height="10"
          style={{ position: "absolute", top: 2, left: 2, opacity: 0.9 }}>
          <path d="M0 0 L6 0 M0 0 L0 6" stroke={hover.ringColor} strokeWidth="1.2" fill="none" />
        </svg>

        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          gap: 8, marginBottom: 6, paddingBottom: 5,
          borderBottom: `1px dashed ${hover.ringColor}55`,
        }}>
          <div>
            <div className="chroma-soft" style={{
              fontFamily: "var(--f-jp)", fontSize: 16, fontWeight: 700,
              color: "var(--ink)", lineHeight: 1,
            }}>{hover.jp}駅</div>
            <div style={{
              fontFamily: "var(--f-display)", fontSize: 9.5,
              letterSpacing: ".22em", color: hover.ringColor,
              textShadow: `0 0 5px ${hover.ringColor}`,
              marginTop: 2,
            }}>
              {hover.en.toUpperCase()}
              {hover.hub && (
                <span style={{ marginLeft: 5, opacity: 0.8, color: "var(--neon-yellow)" }}>· HUB</span>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontFamily: "var(--f-display)", fontSize: 8,
              letterSpacing: ".22em", color: "var(--ink-mute)",
            }}>INT.</div>
            <div className="chroma-soft" style={{
              fontFamily: "var(--f-mono)", fontSize: 18, lineHeight: 1,
              color: "var(--neon-pink)",
            }}>{hover.intensity}%</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {hover.top3.map(e => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontFamily: "var(--f-jp)", fontSize: 12, fontWeight: 700,
                width: 14, color: e.color, lineHeight: 1,
              }}>{e.glyph}</span>
              <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.05)",
                border: `1px solid ${e.color}44`, position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, width: `${e.v}%`,
                  background: e.color, boxShadow: `0 0 5px ${e.color}` }} />
              </div>
              <span style={{
                fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-soft)",
                width: 32, textAlign: "right",
              }}>{e.v.toFixed(1)}%</span>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 6, paddingTop: 5,
          borderTop: `1px dashed ${hover.ringColor}55`,
          display: "flex", justifyContent: "space-between",
          fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--ink-dim)",
        }}>
          <span>CLICK · INSPECT →</span>
          <span style={{ color: hover.ringColor }}>MOOD COMMUTE</span>
        </div>
      </div>,
      document.body
    )}
    </div>
  );
}

function ScaleBar({ project, box }) {
  // 1 km ≈ 0.009 degrees lat
  const a = project(box.minLon, box.minLat);
  const b = project(box.minLon + 0.009 / Math.cos(((box.minLat + box.maxLat)/2) * Math.PI / 180),
                    box.minLat);
  const len = b.x - a.x;
  return (
    <g transform={`translate(${a.x + 12}, ${a.y - 18})`}>
      <line x1="0" y1="0" x2={len} y2="0" stroke="rgba(232,239,255,.6)" strokeWidth="2" />
      <line x1="0" y1="-4" x2="0" y2="4" stroke="rgba(232,239,255,.6)" strokeWidth="2" />
      <line x1={len} y1="-4" x2={len} y2="4" stroke="rgba(232,239,255,.6)" strokeWidth="2" />
      <text x={len/2} y="-6" fontFamily="var(--f-mono)" fontSize="10"
        textAnchor="middle" fill="rgba(232,239,255,.7)">1 KM · 一粁</text>
    </g>
  );
}

function Compass() {
  return (
    <g transform="translate(680, 50)">
      <circle r="18" fill="rgba(7,5,13,0.7)" stroke="rgba(0,234,255,.5)" strokeWidth="0.8" />
      <line x1="0" y1="-14" x2="0" y2="14" stroke="rgba(0,234,255,.5)" strokeWidth="0.6" />
      <line x1="-14" y1="0" x2="14" y2="0" stroke="rgba(0,234,255,.5)" strokeWidth="0.6" />
      <polygon points="0,-14 -3,-6 0,-9 3,-6" fill="var(--neon-pink)"
        style={{ filter: "drop-shadow(0 0 3px var(--neon-pink))" }} />
      <text y="-19" fontFamily="var(--f-display)" fontSize="9"
        fill="var(--neon-pink)" textAnchor="middle" letterSpacing=".2em">N · 北</text>
    </g>
  );
}

// ─────────────────────────────────────────────────────────────
// Bilingual title — kanji + Latin stacked
// ─────────────────────────────────────────────────────────────
function BiTitle({ jp, en, kicker, size = 36, color, align = "left", chroma = true }) {
  const { type } = useTweak();
  const kanjiFirst = type !== "latin";
  return (
    <div style={{ textAlign: align, color: color || "var(--ink)", lineHeight: 1 }}>
      {kicker && (
        <div style={{ fontFamily: "var(--f-display)", fontSize: 11, letterSpacing: ".3em",
          marginBottom: 8, color: "var(--ink-mute)" }}>{kicker}</div>
      )}
      {kanjiFirst ? (
        <>
          <div className={chroma ? "chroma-aberration" : ""} style={{
            fontFamily: "var(--f-jp)", fontWeight: 700,
            fontSize: size, letterSpacing: ".02em",
          }}>{jp}</div>
          <div style={{ fontFamily: "var(--f-display)", fontSize: size * 0.42,
            letterSpacing: ".22em", marginTop: 4, color: "var(--neon-cyan)" }}>
            {en.toUpperCase()}
          </div>
        </>
      ) : (
        <>
          <div className={chroma ? "chroma-aberration" : ""} style={{
            fontFamily: "var(--f-display)", fontSize: size, letterSpacing: "-.01em",
          }}>{en.toUpperCase()}</div>
          <div style={{ fontFamily: "var(--f-jp)", fontSize: size * 0.42, marginTop: 4,
            color: "var(--neon-pink)" }}>{jp}</div>
        </>
      )}
    </div>
  );
}

function SectionLabel({ jp, en, color = "var(--neon-cyan)" }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10,
      borderBottom: `1px solid ${color}`, paddingBottom: 4,
      fontFamily: "var(--f-display)", fontSize: 12, letterSpacing: ".24em" }}>
      <span style={{ color, textShadow: `0 0 6px ${color}` }}>{en}</span>
      <span style={{ fontFamily: "var(--f-jp)", fontSize: 11, color: "var(--ink-mute)",
        letterSpacing: 0 }}>· {jp}</span>
    </div>
  );
}

function VHSCorner({ top = true, left = true, label = "REC", time = "08:47:23", color = "var(--neon-red)" }) {
  return (
    <div style={{
      position: "absolute",
      [top ? "top" : "bottom"]: 12,
      [left ? "left" : "right"]: 12,
      fontFamily: "var(--f-mono)", fontSize: 17, lineHeight: 1.05,
      color, letterSpacing: ".08em",
      textShadow: `1px 0 0 var(--neon-pink), -1px 0 0 var(--neon-cyan)`,
      zIndex: 30, pointerEvents: "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%",
          background: color, boxShadow: `0 0 10px ${color}`,
          animation: "rec-blink 1.4s infinite" }} />
        <span>{label}</span>
      </div>
      <div>{time}</div>
    </div>
  );
}

Object.assign(window, {
  TweakCtx, useTweak,
  EmotionChip, TopMap, BiTitle, SectionLabel, VHSCorner,
  makeProjection,
  EMOTIONS, TOKYO_STATIONS, OSAKA_STATIONS, SHINJUKU_VOICES, REBEL_NUDGES, dominant,
});
