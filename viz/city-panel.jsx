// ─────────────────────────────────────────────────────────────
// MOOD COMMUTE · CityPanel
// One container per city — header, isometric map, mood bar
// ─────────────────────────────────────────────────────────────

function CityPanel({ city, hour, minute, subMinute = 0, filter, picked, setPicked, punched, accentColor, lineColor }) {
  const { density, glow } = useTweak();
  const stations = city === "osaka" ? OSAKA_STATIONS : TOKYO_STATIONS;
  const cityJP = city === "osaka" ? "大阪" : "東京";
  const cityEN = city === "osaka" ? "OSAKA" : "TOKYO";
  const lineJP = city === "osaka" ? "大阪環状線" : "山手線";
  const lineEN = city === "osaka" ? "OSAKA LOOP" : "YAMANOTE";

  // city-wide mood now — sample each station at exact (hour, minute) so
  // the city mix shifts smoothly between minutes, not in once-an-hour steps.
  const cityMood = React.useMemo(() => {
    const sums = {};
    EMOTIONS.forEach(e => sums[e.id] = 0);
    stations.forEach(s => {
      const p = s.moodAt(hour, minute);
      EMOTIONS.forEach(e => sums[e.id] += p[e.id]);
    });
    return EMOTIONS.map(e => ({ ...e, v: sums[e.id] / stations.length }))
      .sort((a, b) => b.v - a.v);
  }, [stations, hour, minute]);

  // REAL intensity from train schedule + MLIT congestion ratios
  const realIntensity = React.useMemo(() => {
    if (!window.MOOD_TRAINS) return {};
    const key = city === "osaka" ? "loop" : "yamanote";
    // freq alone (no per-train spatial calc here — we just want per-station
    // hour-of-day intensity for ranking pills)
    const freq = window.MOOD_TRAINS.SCHEDULE[key][hour] || 0;
    const peak = Math.max(...window.MOOD_TRAINS.SCHEDULE[key]);
    const peakPct = window.MOOD_TRAINS.PEAK_CONGESTION[key];
    const hourMul = peak ? freq / peak : 0;
    const base = Math.round(hourMul * peakPct);
    const out = {};
    stations.forEach(s => {
      const hubFactor = s.hub ? 1.18 : 0.92;
      // Per-station character: hubs busier, smaller stations quieter
      out[s.id] = Math.max(0, Math.round(base * hubFactor));
    });
    return out;
  }, [city, hour, stations]);

  const loudest = React.useMemo(() => {
    let best = null, bv = -1;
    stations.forEach(s => {
      const v = realIntensity[s.id] ?? 0;
      if (v > bv) { bv = v; best = s; }
    });
    return { s: best, v: bv };
  }, [stations, realIntensity]);

  const calmest = React.useMemo(() => {
    let best = null, bv = 999;
    stations.forEach(s => {
      const v = realIntensity[s.id] ?? 999;
      if (v < bv) { bv = v; best = s; }
    });
    return { s: best, v: bv };
  }, [stations, realIntensity]);

  return (
    <div className="neon-frame crt-scanlines crt-vignette" style={{
      flex: 1, minWidth: 0,
      display: "flex", flexDirection: "column",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* HEADER */}
      <div style={{
        padding: "16px 18px 12px",
        borderBottom: `1px solid ${accentColor}`,
        background: `linear-gradient(180deg, ${accentColor}22 0%, transparent 100%)`,
        display: "flex", alignItems: "flex-end", gap: 14, position: "relative", zIndex: 2,
      }}>
        <BiTitle jp={cityJP} en={cityEN} kicker={`MOOD COMMUTE · ${lineEN}`} size={48} chroma />
        <div style={{ flex: 1 }} />
        <div style={{
          fontFamily: "var(--f-display)", fontSize: 12, letterSpacing: ".24em",
          color: lineColor, textShadow: `0 0 8px ${lineColor}`,
          textAlign: "right", lineHeight: 1.4,
        }}>
          <div style={{ fontSize: 18 }}>{lineJP}</div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", textShadow: "none" }}>
            {stations.length} STATIONS · LIVE
          </div>
        </div>
      </div>

      {/* huge city kanji in the back — very subtle, doesn't compete with the map */}
      <div style={{
        position: "absolute", left: 0, right: 0, top: 70, bottom: 90,
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none", zIndex: 0,
        overflow: "hidden",
      }}>
        <div style={{
          fontFamily: "var(--f-jp)", fontSize: 260,
          color: "rgba(0,234,255,0.025)",
          fontWeight: 700, lineHeight: 0.8, letterSpacing: "-0.05em",
        }}>{cityJP}</div>
      </div>

      <VHSCorner top={true} left={false}
        label={`▶ ${cityEN}`}
        time={`${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`}
        color={accentColor} />

      {/* MAP — fills remaining space */}
      <div style={{ flex: 1, position: "relative", zIndex: 1, minHeight: 0 }}>
        <TopMap city={city} stations={stations} hour={hour} minute={minute} subMinute={subMinute}
          filter={filter} picked={picked} onPick={setPicked}
          punched={punched}
          ringColor={accentColor}
          glow={glow}
          hubOnly={density === "minimal"} />
        <CornerCrosshair color={accentColor} />
      </div>

      {/* FOOTER — mood mix */}
      <div style={{
        padding: "10px 16px 14px",
        borderTop: `1px solid var(--chrome)`,
        position: "relative", zIndex: 2,
        background: "rgba(7,5,13,.65)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          fontFamily: "var(--f-display)", fontSize: 10, letterSpacing: ".25em",
          color: "var(--ink-mute)", marginBottom: 6 }}>
          <span>CITY MOOD · 全体気分</span>
          <span>SAMPLE · {(stations.length * 480).toLocaleString()}</span>
        </div>
        <MoodMixBar cityMood={cityMood} />
        <div style={{ display: "flex", gap: 12, marginTop: 8,
          fontFamily: "var(--f-display)", fontSize: 10, letterSpacing: ".15em",
          color: "var(--ink-mute)" }}>
          <StatPill label="LOUDEST" jp={loudest.s.jp} en={loudest.s.en} val={`${loudest.v}%`}
            color="var(--neon-pink)" pickedHook={() => setPicked(loudest.s.id)} active={picked === loudest.s.id} />
          <StatPill label="CALMEST" jp={calmest.s.jp} en={calmest.s.en} val={`${calmest.v}%`}
            color="var(--neon-green)" pickedHook={() => setPicked(calmest.s.id)} active={picked === calmest.s.id} />
        </div>
      </div>
    </div>
  );
}

function CornerCrosshair({ color }) {
  const corners = [
    { top: 6, left: 6, rot: 0 },
    { top: 6, right: 6, rot: 90 },
    { bottom: 6, left: 6, rot: -90 },
    { bottom: 6, right: 6, rot: 180 },
  ];
  return (
    <>
      {corners.map((c, i) => (
        <svg key={i} viewBox="0 0 14 14"
          style={{ position: "absolute", width: 14, height: 14, ...c, opacity: 0.65,
            transform: `rotate(${c.rot}deg)` }}>
          <path d="M0 0 L8 0 M0 0 L0 8" stroke={color} strokeWidth="1.5" fill="none" />
        </svg>
      ))}
    </>
  );
}

function MoodMixBar({ cityMood }) {
  const total = cityMood.reduce((a, b) => a + b.v, 0);
  return (
    <div style={{ display: "flex", height: 26, border: "1px solid var(--chrome)" }}>
      {cityMood.map(e => {
        const pct = (e.v / total) * 100;
        return (
          <div key={e.id} title={`${e.en} ${e.v.toFixed(1)}%`} style={{
            width: `${pct}%`, background: e.color,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(0,0,0,.85)", fontFamily: "var(--f-jp)", fontSize: 12, fontWeight: 700,
            boxShadow: `inset 0 -2px 0 rgba(0,0,0,.25)`,
            borderRight: "1px solid rgba(0,0,0,.25)",
          }}>{pct > 6 ? e.glyph : ""}</div>
        );
      })}
    </div>
  );
}

function StatPill({ label, jp, en, val, color, pickedHook, active }) {
  return (
    <button onClick={pickedHook} style={{
      flex: 1, display: "flex", alignItems: "center", gap: 8,
      padding: "6px 10px",
      border: `1px solid ${active ? color : "var(--chrome)"}`,
      background: active ? `${color}22` : "transparent",
      color: "var(--ink)",
      cursor: "pointer",
      fontFamily: "inherit",
      textAlign: "left",
      transition: "background .15s, border .15s",
    }}>
      <div style={{ fontFamily: "var(--f-display)", fontSize: 9, letterSpacing: ".2em",
        color, textShadow: `0 0 5px ${color}` }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--f-jp)", fontSize: 13, color: "var(--ink)",
          fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {jp}
        </div>
        <div style={{ fontFamily: "var(--f-display)", fontSize: 10, letterSpacing: ".12em",
          color: "var(--ink-mute)", lineHeight: 1, marginTop: 2 }}>{en.toUpperCase()}</div>
      </div>
      <div style={{ fontFamily: "var(--f-mono)", fontSize: 18, color, lineHeight: 1 }}>
        {val}
      </div>
    </button>
  );
}

Object.assign(window, { CityPanel });
