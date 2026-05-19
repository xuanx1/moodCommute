// ─────────────────────────────────────────────────────────────
// MOOD COMMUTE · data
// REAL station coordinates (WGS84 lat/lon) for JR Yamanote loop
// and JR Osaka Loop. Coast outlines + major rivers also embedded.
//
// Mood profiles are SYNTHETIC — there is no real emotional surveillance
// data. Numbers are shaped by realistic rush-hour patterns + per-station
// character traits, then jittered with a deterministic seed.
// ─────────────────────────────────────────────────────────────

(function () {

const EMOTIONS = [
  { id: "stress",      jp: "緊張", en: "Stress",      glyph: "緊", color: "var(--e-stress)" },
  { id: "joy",         jp: "喜び", en: "Joy",         glyph: "喜", color: "var(--e-joy)" },
  { id: "fatigue",     jp: "疲労", en: "Fatigue",     glyph: "疲", color: "var(--e-fatigue)" },
  { id: "loneliness",  jp: "孤独", en: "Loneliness",  glyph: "孤", color: "var(--e-loneliness)" },
  { id: "anger",       jp: "怒り", en: "Anger",       glyph: "怒", color: "var(--e-anger)" },
  { id: "awe",         jp: "畏怖", en: "Awe",         glyph: "畏", color: "var(--e-awe)" },
  { id: "boredom",     jp: "退屈", en: "Boredom",     glyph: "退", color: "var(--e-boredom)" },
  { id: "calm",        jp: "平静", en: "Calm",        glyph: "平", color: "var(--e-calm)" },
];

// ─────────────────────────────────────────────────────────────
// JR YAMANOTE LINE — 30 stations, real lat/lon (WGS84)
// Source: Wikipedia / OpenStreetMap node coordinates
// Listed clockwise from Tokyo Stn (the conventional start)
// ─────────────────────────────────────────────────────────────
const TOKYO_STATIONS = [
  { id: "tokyo",        jp: "東京",      en: "Tōkyō",         lat: 35.6812, lon: 139.7671, ring: "yamanote", hub: true  },
  { id: "kanda",        jp: "神田",      en: "Kanda",         lat: 35.6918, lon: 139.7707, ring: "yamanote" },
  { id: "akihabara",    jp: "秋葉原",    en: "Akihabara",     lat: 35.6984, lon: 139.7731, ring: "yamanote", hub: true  },
  { id: "okachimachi",  jp: "御徒町",    en: "Okachimachi",   lat: 35.7076, lon: 139.7745, ring: "yamanote" },
  { id: "ueno",         jp: "上野",      en: "Ueno",          lat: 35.7141, lon: 139.7774, ring: "yamanote", hub: true  },
  { id: "uguisudani",   jp: "鶯谷",      en: "Uguisudani",    lat: 35.7203, lon: 139.7783, ring: "yamanote" },
  { id: "nippori",      jp: "日暮里",    en: "Nippori",       lat: 35.7281, lon: 139.7706, ring: "yamanote" },
  { id: "nishi-nippori",jp: "西日暮里",  en: "Nishi-Nippori", lat: 35.7321, lon: 139.7669, ring: "yamanote" },
  { id: "tabata",       jp: "田端",      en: "Tabata",        lat: 35.7378, lon: 139.7609, ring: "yamanote" },
  { id: "komagome",     jp: "駒込",      en: "Komagome",      lat: 35.7367, lon: 139.7480, ring: "yamanote" },
  { id: "sugamo",       jp: "巣鴨",      en: "Sugamo",        lat: 35.7335, lon: 139.7397, ring: "yamanote" },
  { id: "otsuka",       jp: "大塚",      en: "Ōtsuka",        lat: 35.7316, lon: 139.7283, ring: "yamanote" },
  { id: "ikebukuro",    jp: "池袋",      en: "Ikebukuro",     lat: 35.7295, lon: 139.7110, ring: "yamanote", hub: true  },
  { id: "mejiro",       jp: "目白",      en: "Mejiro",        lat: 35.7211, lon: 139.7064, ring: "yamanote" },
  { id: "takadanobaba", jp: "高田馬場",  en: "Takadanobaba",  lat: 35.7128, lon: 139.7036, ring: "yamanote" },
  { id: "shin-okubo",   jp: "新大久保",  en: "Shin-Ōkubo",    lat: 35.7011, lon: 139.7000, ring: "yamanote" },
  { id: "shinjuku",     jp: "新宿",      en: "Shinjuku",      lat: 35.6896, lon: 139.7006, ring: "yamanote", hub: true  },
  { id: "yoyogi",       jp: "代々木",    en: "Yoyogi",        lat: 35.6830, lon: 139.7022, ring: "yamanote" },
  { id: "harajuku",     jp: "原宿",      en: "Harajuku",      lat: 35.6702, lon: 139.7027, ring: "yamanote" },
  { id: "shibuya",      jp: "渋谷",      en: "Shibuya",       lat: 35.6580, lon: 139.7016, ring: "yamanote", hub: true  },
  { id: "ebisu",        jp: "恵比寿",    en: "Ebisu",         lat: 35.6464, lon: 139.7100, ring: "yamanote" },
  { id: "meguro",       jp: "目黒",      en: "Meguro",        lat: 35.6336, lon: 139.7156, ring: "yamanote" },
  { id: "gotanda",      jp: "五反田",    en: "Gotanda",       lat: 35.6258, lon: 139.7234, ring: "yamanote" },
  { id: "osaki",        jp: "大崎",      en: "Ōsaki",         lat: 35.6196, lon: 139.7286, ring: "yamanote" },
  { id: "shinagawa",    jp: "品川",      en: "Shinagawa",     lat: 35.6285, lon: 139.7387, ring: "yamanote", hub: true  },
  { id: "tamachi",      jp: "田町",      en: "Tamachi",       lat: 35.6457, lon: 139.7475, ring: "yamanote" },
  { id: "hamamatsucho", jp: "浜松町",    en: "Hamamatsuchō",  lat: 35.6557, lon: 139.7567, ring: "yamanote" },
  { id: "shimbashi",    jp: "新橋",      en: "Shimbashi",     lat: 35.6661, lon: 139.7587, ring: "yamanote" },
  { id: "yurakucho",    jp: "有楽町",    en: "Yūrakuchō",     lat: 35.6748, lon: 139.7634, ring: "yamanote" },
];

// ─────────────────────────────────────────────────────────────
// JR OSAKA LOOP LINE — 19 stations, real lat/lon
// Listed clockwise from Ōsaka Stn
// ─────────────────────────────────────────────────────────────
const OSAKA_STATIONS = [
  { id: "osaka",        jp: "大阪",      en: "Ōsaka",         lat: 34.7024, lon: 135.4959, ring: "loop", hub: true  },
  { id: "tenma",        jp: "天満",      en: "Temma",         lat: 34.7060, lon: 135.5106, ring: "loop" },
  { id: "kyobashi",     jp: "京橋",      en: "Kyōbashi",      lat: 34.6968, lon: 135.5341, ring: "loop", hub: true  },
  { id: "osakajokoen",  jp: "大阪城公園", en: "Ōsakajōkōen",  lat: 34.6892, lon: 135.5384, ring: "loop" },
  { id: "morinomiya",   jp: "森ノ宮",    en: "Morinomiya",    lat: 34.6786, lon: 135.5354, ring: "loop" },
  { id: "tamatsukuri",  jp: "玉造",      en: "Tamatsukuri",   lat: 34.6738, lon: 135.5320, ring: "loop" },
  { id: "tsuruhashi",   jp: "鶴橋",      en: "Tsuruhashi",    lat: 34.6657, lon: 135.5306, ring: "loop", hub: true  },
  { id: "momodani",     jp: "桃谷",      en: "Momodani",      lat: 34.6579, lon: 135.5283, ring: "loop" },
  { id: "teradacho",    jp: "寺田町",    en: "Teradachō",     lat: 34.6500, lon: 135.5215, ring: "loop" },
  { id: "tennoji",      jp: "天王寺",    en: "Tennōji",       lat: 34.6462, lon: 135.5141, ring: "loop", hub: true  },
  { id: "shin-imamiya", jp: "新今宮",    en: "Shin-Imamiya",  lat: 34.6500, lon: 135.5026, ring: "loop" },
  { id: "imamiya",      jp: "今宮",      en: "Imamiya",       lat: 34.6570, lon: 135.4970, ring: "loop" },
  { id: "ashiharabashi",jp: "芦原橋",    en: "Ashiharabashi", lat: 34.6647, lon: 135.4900, ring: "loop" },
  { id: "taisho",       jp: "大正",      en: "Taishō",        lat: 34.6716, lon: 135.4859, ring: "loop" },
  { id: "bentencho",    jp: "弁天町",    en: "Bentenchō",     lat: 34.6815, lon: 135.4624, ring: "loop" },
  { id: "nishikujo",    jp: "西九条",    en: "Nishikujō",     lat: 34.6884, lon: 135.4663, ring: "loop" },
  { id: "noda",         jp: "野田",      en: "Noda",          lat: 34.6936, lon: 135.4778, ring: "loop" },
  { id: "fukushima",    jp: "福島",      en: "Fukushima",     lat: 34.6975, lon: 135.4895, ring: "loop" },
  // closing back to Osaka via Umeda
];

// ─────────────────────────────────────────────────────────────
// Mood profile generator (SYNTHETIC — clearly labeled in UI)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Mood profile generator — REAL DATA + per-station variation
// Base hourly curve comes from WRIME (46k real Japanese tweets w/
// reader-averaged Plutchik emotion scores). Each station then gets
// its own phase shift, smooth noise, and sparse events on top so
// no two stations are synced — the emotion wave propagates rather
// than flips all at once.
// ─────────────────────────────────────────────────────────────

// WRIME hourly data is loaded async; until it arrives we fall back to a
// neutral baseline. The map re-renders when this populates.
let WRIME_HOURLY = null;   // [24] of {joy, sadness, anticipation, surprise, anger, fear, disgust, trust} or null
let WRIME_VOICES = null;   // { joy:[…], sadness:[…], … } each entry { text, hour, score }

if (typeof fetch === "function") {
  // notify the app when async real-data fetches complete so it can re-render
  const notify = () => {
    try { window.dispatchEvent(new CustomEvent("mood-data-loaded")); } catch {}
  };
  fetch("data/wrime-hourly.json").then(r => r.ok ? r.json() : null).then(j => {
    if (j) { WRIME_HOURLY = j; notify(); }
  }).catch(() => {});
  fetch("data/wrime-voices.json").then(r => r.ok ? r.json() : null).then(j => {
    if (j) { WRIME_VOICES = j; notify(); }
  }).catch(() => {});
}

// Map Plutchik (WRIME) → our 8 emotions. Plutchik scores ~0..3, average
// per hour. Output is the unnormalized magnitude per emotion; moodAt
// normalizes to percentages at the end.
function plutchikToMood(w) {
  const j = w.joy, s = w.sadness, a = w.anticipation, sp = w.surprise;
  const an = w.anger, f = w.fear, d = w.disgust, t = w.trust;
  return {
    joy:         j * 1.0 + a * 0.2,
    stress:      f * 1.2 + an * 0.2,
    fatigue:     s * 0.45 + d * 0.30 + Math.max(0, 0.6 - j) * 0.40,
    loneliness:  s * 0.75 + Math.max(0, 0.4 - t) * 0.20,
    anger:       an * 1.0 + d * 0.20,
    awe:         sp * 0.85 + a * 0.40,
    boredom:     d * 0.55 + Math.max(0, 0.4 - (j + sp) / 2) * 0.45,
    calm:        t * 1.5 + Math.max(0, 0.4 - (f + an + s) / 3) * 0.35,
  };
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s & 0xfffffff) / 0x10000000;
  };
}

function hashId(id, salt = 0) {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function valueNoise(seed, period) {
  const rand = rng(seed);
  const cache = new Map();
  const at = (k) => {
    if (cache.has(k)) return cache.get(k);
    const v = rand() * 2 - 1;
    cache.set(k, v);
    return v;
  };
  return (t) => {
    const x = t / period;
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return at(i) * (1 - u) + at(i + 1) * u;
  };
}

const TOKYO_TRAITS = {
  shinjuku:    { stress: +3, fatigue: +2, loneliness: +1, joy: -1, phase: -8 },
  shibuya:     { joy: +3, awe: +1, stress: +1, phase: +4 },
  harajuku:    { joy: +4, awe: +2, anger: -2, phase: +12 },
  akihabara:   { awe: +3, joy: +2, loneliness: +1, phase: +8 },
  tokyo:       { stress: +2, fatigue: +1, boredom: +1, phase: +14 },
  ikebukuro:   { stress: +2, fatigue: +2, phase: -6 },
  ueno:        { calm: +1, fatigue: +1, awe: +1, phase: +6 },
  shinagawa:   { stress: +2, fatigue: +2, boredom: +1, phase: +18 },
  ebisu:       { calm: +2, joy: +1, phase: +24 },
  yurakucho:   { calm: +1, joy: +1, phase: +28 },
  shimbashi:   { fatigue: +3, boredom: +1, joy: +1, phase: +20 },
  "shin-okubo":{ joy: +2, awe: +1, phase: -4 },
  meguro:      { calm: +2, loneliness: +1, phase: +16 },
  gotanda:     { fatigue: +1, boredom: +1, phase: +22 },
  uguisudani:  { loneliness: +2, calm: +1, phase: +30 },
};

const OSAKA_TRAITS = {
  osaka:       { stress: +2, joy: +2, anger: +1, phase: -4 },
  tennoji:     { joy: +2, anger: +1, awe: +1, phase: +8 },
  tsuruhashi:  { joy: +3, anger: +1, awe: +1, phase: +14 },
  kyobashi:    { joy: +2, fatigue: +1, anger: +1, phase: +2 },
  "shin-imamiya": { loneliness: +2, anger: +1, fatigue: +1, phase: +20 },
  imamiya:     { loneliness: +2, boredom: +1, phase: +18 },
  bentencho:   { calm: +1, joy: +1, phase: +22 },
  fukushima:   { joy: +2, calm: +1, phase: +12 },
};

// Look up WRIME hourly baseline with linear interpolation between hours.
function wrimeBaseline(hour, minute) {
  if (!WRIME_HOURLY) {
    // Fallback shape — used briefly before WRIME loads
    return { joy: 0.5, sadness: 0.35, anticipation: 0.45, surprise: 0.30,
             anger: 0.05, fear: 0.30, disgust: 0.25, trust: 0.05 };
  }
  const f = (minute || 0) / 60;
  const h0 = hour;
  const h1 = (hour + 1) % 24;
  const a = WRIME_HOURLY[h0] || WRIME_HOURLY.find(x => x) || {};
  const b = WRIME_HOURLY[h1] || a;
  const out = {};
  const keys = ['joy','sadness','anticipation','surprise','anger','fear','disgust','trust'];
  for (const k of keys) out[k] = (a[k] || 0) * (1 - f) + (b[k] || 0) * f;
  return out;
}

function buildMoodFn(stationId, cityBias) {
  const traits = (cityBias.city === "tokyo" ? TOKYO_TRAITS : OSAKA_TRAITS)[stationId] || {};
  const phaseShift = (traits.phase || 0) + (hashId(stationId, 7) % 30) - 15;

  const NOISE = {
    stress:     valueNoise(hashId(stationId, 1),  60 + (hashId(stationId, 11) % 40)),
    joy:        valueNoise(hashId(stationId, 2),  90 + (hashId(stationId, 12) % 60)),
    fatigue:    valueNoise(hashId(stationId, 3),  120 + (hashId(stationId, 13) % 60)),
    loneliness: valueNoise(hashId(stationId, 4),  180 + (hashId(stationId, 14) % 60)),
    anger:      valueNoise(hashId(stationId, 5),  45 + (hashId(stationId, 15) % 30)),
    awe:        valueNoise(hashId(stationId, 6),  150 + (hashId(stationId, 16) % 90)),
    boredom:    valueNoise(hashId(stationId, 7),  200 + (hashId(stationId, 17) % 60)),
    calm:       valueNoise(hashId(stationId, 8),  180 + (hashId(stationId, 18) % 90)),
  };

  const evRand = rng(hashId(stationId, 99));
  const eventCount = 4 + Math.floor(evRand() * 7);
  const events = [];
  const emotionKeys = ["stress","joy","fatigue","loneliness","anger","awe","boredom","calm"];
  for (let i = 0; i < eventCount; i++) {
    events.push({
      minute: Math.floor(evRand() * 24 * 60),
      length: 8 + Math.floor(evRand() * 14),
      emotion: emotionKeys[Math.floor(evRand() * 8)],
      strength: 0.4 + evRand() * 0.6,
    });
  }

  return function moodAt(hour, minute = 0) {
    // 1) Real WRIME hourly baseline, interpolated by minute
    const shifted = (hour * 60 + minute + phaseShift + 1440) % 1440;
    const sh = Math.floor(shifted / 60);
    const sm = shifted % 60;
    const wrime = wrimeBaseline(sh, sm);
    const v = plutchikToMood(wrime);

    // 2) Per-station noise (±35% per emotion)
    const t = hour * 60 + minute + phaseShift;
    for (const k of Object.keys(v)) {
      const n = NOISE[k](t);
      v[k] *= 1 + n * 0.35;
      if (traits[k]) v[k] *= 1 + traits[k] * 0.12;
      if (v[k] < 0.05) v[k] = 0.05;
    }

    // 3) City bias
    v.stress *= cityBias.stressMul || 1;
    v.joy    *= cityBias.joyMul || 1;
    v.anger  *= cityBias.angerMul || 1;

    // 4) Events
    for (const ev of events) {
      const dt = t - ev.minute;
      if (dt < 0 || dt > ev.length) continue;
      const env = Math.sin((dt / ev.length) * Math.PI);
      v[ev.emotion] *= 1 + ev.strength * env * 1.4;
    }

    // 5) Normalize to percentages
    const sum = Object.values(v).reduce((a, b) => a + b, 0);
    const out = {};
    for (const k of Object.keys(v)) out[k] = +(v[k] / sum * 100).toFixed(1);
    return out;
  };
}

const TOKYO_BIAS = { city: "tokyo", stressMul: 1.25, joyMul: 0.95, angerMul: 0.9 };
const OSAKA_BIAS = { city: "osaka", stressMul: 0.95, joyMul: 1.35, angerMul: 1.15 };

// Each station carries a moodAt(hour, minute) function. We keep a `profile`
// array for the 24-hour midpoints so old code that reads s.profile[hour]
// still works as a coarse readout.
function attachProfile(s, bias) {
  s.moodAt = buildMoodFn(s.id, bias);
  s.profile = [];
  for (let h = 0; h < 24; h++) {
    const p = s.moodAt(h, 30); // mid-hour sample
    p.intensity = 80; // legacy field — real intensity now comes from trains.js
    s.profile.push(p);
  }
}

TOKYO_STATIONS.forEach(s => attachProfile(s, TOKYO_BIAS));
OSAKA_STATIONS.forEach(s => attachProfile(s, OSAKA_BIAS));

// Live dominant emotion at exact (hour, minute) — uses moodAt, not the
// cached hourly profile, so neighboring stations diverge minute-by-minute.
function dominantLive(station, hour, minute = 0) {
  const p = station.moodAt(hour, minute);
  let best = "calm", bv = 0;
  for (const e of EMOTIONS) {
    if (p[e.id] > bv) { bv = p[e.id]; best = e.id; }
  }
  return { id: best, value: bv };
}

function dominant(profile, hour) {
  // Fallback path that still reads the cached hourly profile — preserved for
  // any code paths that haven't been migrated to dominantLive yet.
  const p = profile[hour];
  let best = "calm", bv = 0;
  for (const e of EMOTIONS) {
    if (p[e.id] > bv) { bv = p[e.id]; best = e.id; }
  }
  return { id: best, value: bv };
}

const SHINJUKU_VOICES = [
  { jp: "電車に押されて、息ができない。",                 en: "Crushed against the door. Can't breathe.",   emotion: "stress",     age: 28, time: "08:47", where: "新宿" },
  { jp: "今日もただ、流される。",                         en: "Just letting the current carry me again.",   emotion: "fatigue",    age: 41, time: "08:46", where: "新宿" },
  { jp: "知らない人の肩に頭を預けて、少し寝た。",         en: "Slept a bit on a stranger's shoulder.",      emotion: "fatigue",    age: 22, time: "08:45", where: "新宿" },
  { jp: "あの子の笑顔だけが、今日の理由。",               en: "Her smile is the only reason I left home.",  emotion: "joy",        age: 34, time: "08:48", where: "渋谷" },
  { jp: "誰も私を見ていない、それが心地いい。",           en: "Nobody sees me. That's the relief.",         emotion: "loneliness", age: 29, time: "08:47", where: "池袋" },
  { jp: "また遅延。もう、何も言いたくない。",             en: "Delayed again. I have nothing left to say.", emotion: "anger",      age: 37, time: "08:50", where: "東京" },
  { jp: "改札を抜けた瞬間、空がやけに広く見えた。",       en: "Stepping out, the sky felt enormous.",       emotion: "awe",        age: 31, time: "08:51", where: "上野" },
  { jp: "毎日同じ。改札、ホーム、改札、ホーム。",         en: "Every day. Gate, platform, gate, platform.", emotion: "boredom",    age: 45, time: "08:43", where: "品川" },
];

const REBEL_NUDGES = [
  { jp: "電車を降りて、一駅歩いてみない？",       en: "Get off. Walk one stop. See what happens.",  emotion: "awe" },
  { jp: "今日は黄色い物を三つ数えてみて。",       en: "Count three yellow things on your way.",     emotion: "joy" },
  { jp: "誰にも言わずに、ひと駅遅刻してみる？",   en: "Quietly. Be one stop late. Tell no one.",    emotion: "calm" },
  { jp: "ホームで一度、深呼吸をひとつ。",         en: "On the platform, one deep breath. Just one.", emotion: "calm" },
  { jp: "知らない人に、目だけで挨拶。",           en: "Greet a stranger with only your eyes.",      emotion: "joy" },
];

// Helpers
function bbox(stations) {
  let minLat = 999, maxLat = -999, minLon = 999, maxLon = -999;
  for (const s of stations) {
    if (s.lat < minLat) minLat = s.lat;
    if (s.lat > maxLat) maxLat = s.lat;
    if (s.lon < minLon) minLon = s.lon;
    if (s.lon > maxLon) maxLon = s.lon;
  }
  return { minLat, maxLat, minLon, maxLon };
}

window.MOOD_DATA = {
  EMOTIONS,
  TOKYO_STATIONS,
  OSAKA_STATIONS,
  SHINJUKU_VOICES,
  REBEL_NUDGES,
  dominant,
  dominantLive,
  bbox,
  // Real-data accessors — populated async, callers should null-check
  getWrimeHourly: () => WRIME_HOURLY,
  getWrimeVoices: () => WRIME_VOICES,
};

})();
