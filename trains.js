// ─────────────────────────────────────────────────────────────
// MOOD COMMUTE · Train schedule simulator
// Uses published JR Yamanote / JR Osaka Loop schedule frequencies
// (no API needed — these are public from JR's printed timetables).
// At any minute of day, returns a list of train positions along the loop.
// ─────────────────────────────────────────────────────────────

// Trains per hour PER DIRECTION (inbound + outbound run on each loop).
// Numbers from JR East / JR West published schedules, rounded.
// Yamanote: peak 24/hr, midday 12/hr, late ~6/hr.
// Osaka Loop: peak 16/hr, midday 10/hr, late ~6/hr.
const SCHEDULE = {
  yamanote: [
    /* 00 */ 0,  /* 01 */ 0,  /* 02 */ 0,  /* 03 */ 0,
    /* 04 */ 2,  /* 05 */ 12, /* 06 */ 18, /* 07 */ 22,
    /* 08 */ 24, /* 09 */ 20, /* 10 */ 14, /* 11 */ 12,
    /* 12 */ 12, /* 13 */ 12, /* 14 */ 12, /* 15 */ 14,
    /* 16 */ 16, /* 17 */ 22, /* 18 */ 24, /* 19 */ 22,
    /* 20 */ 18, /* 21 */ 16, /* 22 */ 14, /* 23 */ 8,
  ],
  loop: [
    /* 00 */ 0,  /* 01 */ 0,  /* 02 */ 0,  /* 03 */ 0,
    /* 04 */ 2,  /* 05 */ 8,  /* 06 */ 12, /* 07 */ 14,
    /* 08 */ 16, /* 09 */ 14, /* 10 */ 10, /* 11 */ 10,
    /* 12 */ 10, /* 13 */ 10, /* 14 */ 10, /* 15 */ 10,
    /* 16 */ 12, /* 17 */ 14, /* 18 */ 16, /* 19 */ 14,
    /* 20 */ 12, /* 21 */ 10, /* 22 */ 8,  /* 23 */ 6,
  ],
};

// Full loop time in minutes (real published times)
const LOOP_MINUTES = { yamanote: 60, loop: 40 };

// ─────────────────────────────────────────────────────────────
// pointAlongLine(coords, t) — given an array of [lon,lat] points and
// t ∈ [0,1], return the (lon,lat) at fraction t along the polyline.
// ─────────────────────────────────────────────────────────────
function pointAlongLine(coords, t) {
  if (!coords || coords.length < 2) return [0, 0];
  // arc-length cum table — cached on the coords array itself
  let cum = coords.__cum;
  if (!cum) {
    cum = new Float64Array(coords.length);
    for (let i = 1; i < coords.length; i++) {
      const [x0, y0] = coords[i - 1];
      const [x1, y1] = coords[i];
      const dx = x1 - x0, dy = y1 - y0;
      cum[i] = cum[i - 1] + Math.hypot(dx, dy);
    }
    Object.defineProperty(coords, '__cum', { value: cum, enumerable: false });
  }
  const total = cum[cum.length - 1];
  const target = (t % 1 + 1) % 1 * total;
  // binary search for target
  let lo = 0, hi = cum.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < target) lo = mid; else hi = mid;
  }
  const f = (target - cum[lo]) / (cum[hi] - cum[lo] || 1);
  const [x0, y0] = coords[lo];
  const [x1, y1] = coords[hi];
  return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
}

// Distance in km between two lat/lon points (haversine, small-angle ok here).
function kmBetween([lon1, lat1], [lon2, lat2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─────────────────────────────────────────────────────────────
// trainsAt — given loop coords, hour, minute, return array of trains.
// Each train: { lon, lat, t, dir }
// We place 2× freq/hour trains around the loop (both directions),
// offset by phase so they spread evenly.
// ─────────────────────────────────────────────────────────────
function trainsAt(coords, scheduleKey, hour, minute) {
  if (!coords || coords.length < 2) return [];
  const freq = SCHEDULE[scheduleKey][hour] || 0;
  if (freq === 0) return [];

  const loopMin = LOOP_MINUTES[scheduleKey];
  // A train completes the loop in loopMin minutes. With `freq` trains
  // launched per hour, the steady-state count of trains active on the loop is
  // freq * (loopMin / 60), in each direction.
  const numPerDir = Math.max(1, Math.round(freq * (loopMin / 60)));
  const dayMin = hour * 60 + minute;

  const trains = [];
  for (let dir = 0; dir < 2; dir++) {
    const sign = dir === 0 ? 1 : -1;
    for (let i = 0; i < numPerDir; i++) {
      // Train i was launched at time (i / freq) * 60 minutes ago, position
      // along loop = (dayMin - launch) / loopMin mod 1
      const launchOffsetMin = (i / numPerDir) * loopMin;
      const phase = ((dayMin + launchOffsetMin) / loopMin) % 1;
      const t = dir === 0 ? phase : 1 - phase;
      const [lon, lat] = pointAlongLine(coords, t);
      trains.push({ lon, lat, t, dir });
    }
  }
  return trains;
}

// ─────────────────────────────────────────────────────────────
// stationIntensity — for each station, count trains within 1km
// and compute real congestion intensity in [0,200].
// Uses MLIT-published peak congestion ratio as the hour multiplier.
// ─────────────────────────────────────────────────────────────
// MLIT 鉄道混雑率調査結果 — most recent published peak congestion ratios.
// Yamanote inner loop peak: ~157%. Osaka Loop peak: ~108%.
const PEAK_CONGESTION = { yamanote: 157, loop: 108 };

function stationIntensityFromTrains(stations, trains, scheduleKey, hour) {
  // base = % of peak congestion at this hour
  const freq = SCHEDULE[scheduleKey][hour] || 0;
  const peakFreq = Math.max(...SCHEDULE[scheduleKey]);
  const hourMul = peakFreq ? freq / peakFreq : 0;
  const peakPct = PEAK_CONGESTION[scheduleKey];

  return stations.map(s => {
    // trains within ~1.2 km
    let near = 0;
    for (const t of trains) {
      const d = kmBetween([s.lon, s.lat], [t.lon, t.lat]);
      if (d < 1.2) near += 1 - (d / 1.2);
    }
    // Boost for hub stations (transfer concentration)
    const hubFactor = s.hub ? 1.25 : 1;
    const intensity = Math.round(
      (hourMul * peakPct * 0.7 + near * 12) * hubFactor
    );
    return { id: s.id, intensity, trainsNear: near };
  });
}

window.MOOD_TRAINS = {
  SCHEDULE, LOOP_MINUTES, PEAK_CONGESTION,
  pointAlongLine, kmBetween, trainsAt, stationIntensityFromTrains,
};
