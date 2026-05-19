// ─────────────────────────────────────────────────────────────
// MOOD COMMUTE · RailPanel
// Right-column container: filters, drill-down, voices, compare, nudge
// ─────────────────────────────────────────────────────────────

function RailPanel({ hour, minute, filter, setFilter, picked, pickedCity, setPicked, setPickedCity, punched, setPunched }) {
  const { nav, density } = useTweak();

  // resolve picked station
  const pickedSt = pickedCity === "osaka"
    ? OSAKA_STATIONS.find(s => s.id === picked)
    : TOKYO_STATIONS.find(s => s.id === picked);

  return (
    <div className="neon-frame crt-scanlines" style={{
      flex: "0 0 360px", maxWidth: 360,
      display: "flex", flexDirection: "column",
      overflow: "hidden", position: "relative",
    }}>
      {/* HEADER */}
      <div style={{
        padding: "16px 16px 12px",
        borderBottom: "1px solid var(--neon-pink)",
        background: "linear-gradient(180deg, rgba(255,44,212,.16) 0%, transparent 100%)",
        position: "relative", zIndex: 2,
      }}>
        <BiTitle jp="駅単位ドリル" en="DRILL-DOWN" kicker="MOOD COMMUTE · INSPECT · 観察" size={26} chroma={false} />
      </div>

      <VHSCorner top={true} left={false} label="INSPECT" time={`${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`} color="var(--neon-pink)" />

      {/* SCROLLABLE BODY */}
      <div className="no-scrollbar" style={{
        flex: 1, overflowY: "auto", padding: "14px 14px 12px",
        display: "flex", flexDirection: "column", gap: 16,
        position: "relative", zIndex: 1,
      }}>

        {/* EMOTION FILTER CHIPS */}
        <section>
          <SectionLabel jp="感情フィルター" en="FILTER · 8 EMOTIONS" />
          <div style={{ marginTop: 8 }}>
            <EmotionFilterGrid filter={filter} setFilter={setFilter} />
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between",
            fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--ink-mute)" }}>
            <span>{filter.size ? `${filter.size}/8 ON` : "ALL 8 ON · 全表示"}</span>
            {filter.size > 0 && (
              <button onClick={() => setFilter(new Set())} style={{
                background: "transparent", border: "1px solid var(--ink-mute)",
                color: "var(--ink)", fontFamily: "var(--f-display)",
                fontSize: 10, padding: "1px 8px", letterSpacing: ".15em",
                cursor: "pointer",
              }}>CLEAR</button>
            )}
          </div>
        </section>

        {/* PICKED STATION */}
        {pickedSt && (
          <PickedStation station={pickedSt} hour={hour} minute={minute} city={pickedCity} />
        )}

        {/* TOKYO vs OSAKA comparison */}
        <CityCompare hour={hour} minute={minute} />

        {/* VOICES */}
        <Voices city={pickedCity} hour={hour} minute={minute} />

        {/* REBEL NUDGE */}
        <RebelNudge nav={nav}
          pickedStation={pickedSt} pickedCity={pickedCity}
          punched={punched} setPunched={setPunched} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Emotion filter grid — 8 cells, kanji + color
// ─────────────────────────────────────────────────────────────
function EmotionFilterGrid({ filter, setFilter }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5,
    }}>
      {EMOTIONS.map(e => {
        const on = !filter.size || filter.has(e.id);
        return (
          <button key={e.id}
            onClick={() => setFilter(prev => {
              const next = new Set(prev);
              if (next.has(e.id)) next.delete(e.id); else next.add(e.id);
              if (next.size === EMOTIONS.length) return new Set();
              return next;
            })}
            style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 2,
              padding: "6px 4px",
              background: on ? e.color : "transparent",
              color: on ? "rgba(0,0,0,.85)" : e.color,
              border: `1px solid ${e.color}`,
              cursor: "pointer", fontFamily: "var(--f-display)",
              boxShadow: on ? `0 0 8px ${e.color}` : "none",
              transition: "all .14s",
            }}>
            <div style={{ fontFamily: "var(--f-jp)", fontSize: 16, fontWeight: 700, lineHeight: 1 }}>
              {e.glyph}
            </div>
            <div style={{ fontSize: 8.5, letterSpacing: ".1em", lineHeight: 1 }}>
              {e.en.toUpperCase()}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PickedStation — the drill-down card
// ─────────────────────────────────────────────────────────────
function PickedStation({ station, hour, minute, city }) {
  const p = station.moodAt(hour, minute);
  const ranked = EMOTIONS.map(e => ({ ...e, v: p[e.id] }))
    .sort((a, b) => b.v - a.v);
  const top = ranked[0];

  // Real intensity from train schedule + MLIT congestion
  const realIntensity = React.useMemo(() => {
    if (!window.MOOD_TRAINS) return 0;
    const key = station.ring === "loop" ? "loop" : "yamanote";
    const freq = window.MOOD_TRAINS.SCHEDULE[key][hour] || 0;
    const peakFreq = Math.max(...window.MOOD_TRAINS.SCHEDULE[key]);
    const peakPct = window.MOOD_TRAINS.PEAK_CONGESTION[key];
    const hourMul = peakFreq ? freq / peakFreq : 0;
    const hubFactor = station.hub ? 1.18 : 0.92;
    return Math.max(0, Math.round(hourMul * peakPct * hubFactor));
  }, [station, hour]);

  return (
    <section>
      <SectionLabel jp="選択駅 · ピン" en="PICKED" color={top.color} />
      <div style={{ marginTop: 10, position: "relative" }}>

        {/* big readout */}
        <div style={{
          padding: "10px 12px",
          background: "rgba(255,255,255,.02)",
          border: `1px solid ${top.color}`,
          boxShadow: `0 0 14px ${top.color}40, inset 0 0 14px ${top.color}10`,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <EmotionChip emotion={top.id} size={42} glow />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--f-display)", fontSize: 9.5,
                letterSpacing: ".25em", color: "var(--ink-mute)" }}>
                {city.toUpperCase()} / {city === "osaka" ? "OSAKA LOOP" : "YAMANOTE"}
              </div>
              <div className="chroma-soft" style={{
                fontFamily: "var(--f-jp)", fontSize: 26, fontWeight: 700,
                color: "var(--ink)", lineHeight: 1, marginTop: 2,
              }}>
                {station.jp}駅
              </div>
              <div style={{ fontFamily: "var(--f-display)", fontSize: 13,
                letterSpacing: ".15em", color: top.color, marginTop: 2,
                textShadow: `0 0 6px ${top.color}` }}>
                {station.en.toUpperCase()}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--f-display)", fontSize: 9,
                letterSpacing: ".25em", color: "var(--ink-mute)" }}>INTENSITY</div>
              <div style={{ fontFamily: "var(--f-mono)", fontSize: 26, color: top.color,
                lineHeight: 1, textShadow: `1px 0 0 var(--neon-pink), -1px 0 0 var(--neon-cyan)` }}>
                {realIntensity}%
              </div>
            </div>
          </div>

          {/* ranked emotions */}
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            {ranked.slice(0, 4).map(e => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--f-jp)", fontSize: 13, color: e.color,
                  width: 14, fontWeight: 700 }}>{e.glyph}</span>
                <div style={{ flex: 1, height: 5, background: "var(--bg-2)",
                  border: "1px solid var(--chrome)", position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, width: `${e.v}%`,
                    background: e.color, boxShadow: `0 0 6px ${e.color}` }} />
                </div>
                <span style={{ fontFamily: "var(--f-mono)", fontSize: 13, width: 36,
                  textAlign: "right", color: "var(--ink-soft)" }}>{e.v.toFixed(0)}%</span>
              </div>
            ))}
          </div>

          {/* 24h sparkline */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--chrome)" }}>
            <div style={{ fontFamily: "var(--f-display)", fontSize: 9,
              letterSpacing: ".2em", color: "var(--ink-mute)", marginBottom: 4 }}>
              24H · 一日の鼓動
            </div>
            <DaySparkline station={station} highlightHour={hour} highlightMinute={minute} color={top.color} />
          </div>
        </div>

        {/* one quote */}
        <div style={{ marginTop: 10, padding: "8px 10px",
          background: "var(--bg-2)", borderLeft: `3px solid ${top.color}` }}>
          <PickedQuote station={station} top={top} hour={hour} />
        </div>
      </div>
    </section>
  );
}

function DaySparkline({ station, highlightHour, highlightMinute, color }) {
  // Real per-hour mood + intensity chart for THIS station.
  // Stacked-area of 8 emotions across 24 hours (12-min samples) plus
  // an overlaid total-intensity line driven by the train schedule.
  const W = 320, H = 56;
  const SAMPLES = 96; // every 15 minutes

  const data = React.useMemo(() => {
    const out = [];
    for (let i = 0; i < SAMPLES; i++) {
      const totalMin = i * (24 * 60 / SAMPLES);
      const h = Math.floor(totalMin / 60);
      const m = Math.floor(totalMin % 60);
      const mood = station.moodAt(h, m);
      // total "schedule intensity" — trains/hour at this hour × peak congestion
      const key = station.ring === "loop" ? "loop" : "yamanote";
      const freq = (window.MOOD_TRAINS && window.MOOD_TRAINS.SCHEDULE[key][h]) || 0;
      const peakFreq = window.MOOD_TRAINS ? Math.max(...window.MOOD_TRAINS.SCHEDULE[key]) : 24;
      const intensity = peakFreq ? freq / peakFreq : 0;
      out.push({ h, m, mood, intensity });
    }
    return out;
  }, [station]);

  const layers = ["stress", "anger", "fatigue", "loneliness", "boredom", "awe", "joy", "calm"];

  // Build cumulative stack tops per sample.
  const stacks = data.map(d => {
    let acc = 0;
    const out = {};
    for (const l of layers) { acc += d.mood[l]; out[l] = acc; }
    return { ...d, stacks: out };
  });

  const xAt = (i) => (i / (SAMPLES - 1)) * W;
  const yStack = (v) => H - (v / 100) * H * 0.9; // leave room above

  // highlight position
  const highlightX = ((highlightHour * 60 + (highlightMinute || 0)) / (24 * 60)) * W;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ width: "100%", height: H, display: "block" }}>
      {/* stacked emotion areas */}
      {layers.map((l, li) => {
        const fillColor = window.MOOD_DATA.EMOTIONS.find(e => e.id === l).color;
        const lower = li === 0 ? null : layers[li - 1];
        let top = "", bot = "";
        for (let i = 0; i < stacks.length; i++) {
          top += `${xAt(i).toFixed(1)},${yStack(stacks[i].stacks[l]).toFixed(1)} `;
        }
        for (let i = stacks.length - 1; i >= 0; i--) {
          const v = lower ? stacks[i].stacks[lower] : 0;
          bot += `${xAt(i).toFixed(1)},${yStack(v).toFixed(1)} `;
        }
        return (
          <polygon key={l} points={top + bot}
            fill={fillColor} opacity="0.55" />
        );
      })}

      {/* total intensity (train schedule) overlay */}
      <polyline
        points={stacks.map((s, i) =>
          `${xAt(i).toFixed(1)},${(H - s.intensity * H * 0.85).toFixed(1)}`
        ).join(" ")}
        fill="none" stroke="rgba(232,239,255,0.9)" strokeWidth="0.8"
        vectorEffect="non-scaling-stroke"
        style={{ filter: "drop-shadow(0 0 2px rgba(232,239,255,0.7))" }} />

      {/* highlight line */}
      <line x1={highlightX} y1={0} x2={highlightX} y2={H}
        stroke="var(--neon-pink)" strokeWidth="1"
        strokeDasharray="3 2"
        vectorEffect="non-scaling-stroke" />

      {/* hour ticks */}
      {[0, 6, 12, 18].map(h => (
        <text key={h} x={(h / 24) * W} y={H - 1}
          fontFamily="var(--f-mono)" fontSize="7"
          fill="rgba(180,200,235,0.5)" textAnchor="middle">{String(h).padStart(2, "0")}</text>
      ))}
    </svg>
  );
}

function PickedQuote({ station, top, hour }) {
  // Try real WRIME voice first (real Japanese tweet with that emotion),
  // matched by hour-of-day proximity. Fall back to scripted line.
  const wrime = window.MOOD_DATA.getWrimeVoices && window.MOOD_DATA.getWrimeVoices();
  const ourToPlutchik = {
    joy: "joy", stress: "fear", fatigue: "sadness", loneliness: "sadness",
    anger: "anger", awe: "surprise", boredom: "disgust", calm: "trust",
  };

  const real = React.useMemo(() => {
    if (!wrime) return null;
    const key = ourToPlutchik[top.id] || "joy";
    const pool = wrime[key] || [];
    if (!pool.length) return null;
    // Pick deterministically based on station id + emotion so the same
    // station shows a stable quote at a given moment
    const seed = (station.id + key + hour).split("")
      .reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
    return pool[Math.abs(seed) % pool.length];
  }, [wrime, station.id, top.id, hour]);

  // Fallback scripted lines (used only if WRIME hasn't loaded)
  const FALLBACK_BY_EMOTION = {
    stress:      { jp: "ドアに押されて、息ができない。", en: "Pressed to the door. Can't breathe." },
    joy:         { jp: "あの子の笑顔だけが、今日の理由。", en: "Her smile is the only reason I came." },
    fatigue:     { jp: "知らない肩で、少し眠った。",       en: "I slept a bit on a stranger's shoulder." },
    loneliness:  { jp: "誰も私を見ていない。心地いい。",   en: "Nobody sees me. It's a relief." },
    anger:       { jp: "また遅延。もう何も言いたくない。", en: "Delayed again. Nothing left to say." },
    awe:         { jp: "改札の先、空が広く見えた。",       en: "Past the gate, the sky felt enormous." },
    boredom:     { jp: "毎日、改札、ホーム、改札。",       en: "Every day. Gate. Platform. Gate." },
    calm:        { jp: "電車のリズムだけが、僕の今。",     en: "Just the rhythm of the train. That's now." },
  };
  const fallback = FALLBACK_BY_EMOTION[top.id] || FALLBACK_BY_EMOTION.calm;
  const jp = real ? real.text : fallback.jp;
  const src = real ? "WRIME · 実ツイート" : "ANON · DEMO LINE";
  const hourTag = real ? ` · ${String(real.hour).padStart(2,"0")}:00` : "";

  return (
    <div>
      <div style={{ fontFamily: "var(--f-jp)", fontSize: 13.5, fontWeight: 500,
        color: "var(--ink)", lineHeight: 1.4 }}>
        「{jp}」
      </div>
      <div style={{ marginTop: 5, display: "flex", justifyContent: "space-between",
        fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-dim)" }}>
        <span>{src}{hourTag}</span>
        <span style={{ color: top.color }}>{top.jp}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CityCompare — Tokyo vs Osaka top-3 emotion deltas
// ─────────────────────────────────────────────────────────────
function CityCompare({ hour, minute }) {
  const data = React.useMemo(() => {
    const tokyo = {}, osaka = {};
    EMOTIONS.forEach(e => { tokyo[e.id] = 0; osaka[e.id] = 0; });
    TOKYO_STATIONS.forEach(s => {
      const p = s.moodAt(hour, minute);
      EMOTIONS.forEach(e => tokyo[e.id] += p[e.id]);
    });
    OSAKA_STATIONS.forEach(s => {
      const p = s.moodAt(hour, minute);
      EMOTIONS.forEach(e => osaka[e.id] += p[e.id]);
    });
    return EMOTIONS.map(e => ({
      ...e,
      t: tokyo[e.id] / TOKYO_STATIONS.length,
      o: osaka[e.id] / OSAKA_STATIONS.length,
    })).map(e => ({ ...e, delta: e.t - e.o }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [hour, minute]);

  return (
    <section>
      <SectionLabel jp="東京 vs 大阪" en="DIFF · 二都市比較" color="var(--neon-violet)" />
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        {data.slice(0, 5).map(e => {
          const tokyoMore = e.delta > 0;
          const magnitude = Math.min(Math.abs(e.delta) * 4, 100);
          return (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 6,
              fontFamily: "var(--f-mono)", fontSize: 12 }}>
              <span style={{ fontFamily: "var(--f-jp)", fontSize: 14, color: e.color,
                width: 16, fontWeight: 700 }}>{e.glyph}</span>
              <div style={{ flex: 1, display: "flex", height: 6, position: "relative",
                background: "var(--bg-2)", border: "1px solid var(--chrome)" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  {!tokyoMore && (
                    <div style={{ position: "absolute", right: 0, top: 0, bottom: 0,
                      width: `${magnitude}%`, background: e.color, boxShadow: `0 0 6px ${e.color}` }} />
                  )}
                </div>
                <div style={{ width: 1, background: "var(--ink-mute)" }} />
                <div style={{ flex: 1, position: "relative" }}>
                  {tokyoMore && (
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${magnitude}%`, background: e.color, boxShadow: `0 0 6px ${e.color}` }} />
                  )}
                </div>
              </div>
              <span style={{ width: 56, textAlign: "right", color: e.color }}>
                {tokyoMore ? "▲ TYO" : "▲ OSK"} {Math.abs(e.delta).toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between",
        fontFamily: "var(--f-display)", fontSize: 9, letterSpacing: ".2em",
        color: "var(--ink-mute)" }}>
        <span>← OSAKA more</span><span>TOKYO more →</span>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Voices — real WRIME tweets sampled to match the current city mood
// ─────────────────────────────────────────────────────────────
function Voices({ city, hour, minute }) {
  // Compute the city's current emotion mix to weight which WRIME tweets we sample
  const cityMix = React.useMemo(() => {
    const stations = city === "osaka" ? OSAKA_STATIONS : TOKYO_STATIONS;
    const sums = {};
    EMOTIONS.forEach(e => sums[e.id] = 0);
    stations.forEach(s => {
      const p = s.moodAt(hour, minute);
      EMOTIONS.forEach(e => sums[e.id] += p[e.id]);
    });
    return EMOTIONS.map(e => ({ ...e, v: sums[e.id] / stations.length }))
      .sort((a, b) => b.v - a.v);
  }, [city, hour, minute]);

  const list = React.useMemo(() => {
    const wrime = window.MOOD_DATA.getWrimeVoices && window.MOOD_DATA.getWrimeVoices();
    if (!wrime) return [];

    // Our emotion → WRIME Plutchik key
    const map = {
      joy: "joy", stress: "fear", fatigue: "sadness", loneliness: "sadness",
      anger: "anger", awe: "surprise", boredom: "disgust", calm: "trust",
    };

    // Pick 1 voice from each of the top-4 emotions in the current city mood
    const seen = new Set();
    const out = [];
    for (const em of cityMix.slice(0, 4)) {
      const pool = (wrime[map[em.id]] || []);
      // Pick a tweet whose hour is closest to current hour
      const sorted = pool.slice().sort((a, b) =>
        Math.abs((a.hour - hour + 12) % 24 - 12) -
        Math.abs((b.hour - hour + 12) % 24 - 12)
      );
      for (const t of sorted) {
        if (seen.has(t.text)) continue;
        seen.add(t.text);
        out.push({ ...t, emotion: em });
        break;
      }
    }
    return out;
  }, [cityMix, hour]);

  return (
    <section>
      <SectionLabel jp="鼓動 · 実ツイート" en={`VOICES · ${city === "osaka" ? "OSAKA" : "TOKYO"}`} color="var(--neon-cyan)" />
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {list.length === 0 && (
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-mute)",
            padding: "8px 9px", border: "1px dashed var(--chrome)" }}>
            Loading WRIME corpus…
          </div>
        )}
        {list.map((v, i) => {
          const e = v.emotion;
          return (
            <div key={i} style={{
              padding: "7px 9px",
              background: "var(--bg-2)",
              borderLeft: `3px solid ${e.color}`,
              borderRight: "1px solid var(--chrome)",
              borderTop: "1px solid var(--chrome)",
              borderBottom: "1px solid var(--chrome)",
            }}>
              <div style={{ fontFamily: "var(--f-jp)", fontSize: 12.5, fontWeight: 500,
                color: "var(--ink)", lineHeight: 1.35 }}>
                「{v.text}」
              </div>
              <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between",
                fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-dim)" }}>
                <span><span style={{ color: e.color }}>{e.glyph}</span> {e.en.toUpperCase()} · WRIME</span>
                <span>posted {String(v.hour).padStart(2,"0")}:00</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// RebelNudge — rotating "do something different" prompt
// ─────────────────────────────────────────────────────────────
function RebelNudge({ nav, pickedStation, pickedCity, punched, setPunched }) {
  const HOLD_MS = 800;

  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    if (punched) return undefined;
    const t = setInterval(() => setIdx(i => (i + 1) % REBEL_NUDGES.length), 4500);
    return () => clearInterval(t);
  }, [punched]);
  const n = punched || REBEL_NUDGES[idx];
  const nEmotion = EMOTIONS.find(e => e.id === n.emotion);

  const navLabel = {
    gestural: "SWIPE TO SKIP", diegetic: "PUNCH NEW TICKET",
    "anti-UI": "TYPE :rebel", glitchy: "HOLD TO COMMIT",
  }[nav] || "ACT";

  // Hold-to-punch: RAF drives holdPct 0→1 over HOLD_MS. Release before
  // 1.0 cancels; reaching 1.0 commits the current nudge as today's punch
  // (persisted upstream in App, which writes to localStorage).
  const [holdPct, setHoldPct] = React.useState(0);
  const rafRef = React.useRef(0);
  const startedRef = React.useRef(0);

  const stopHold = React.useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    startedRef.current = 0;
    setHoldPct(0);
  }, []);

  const startHold = React.useCallback((e) => {
    if (punched || !pickedStation) return;
    e.preventDefault();
    startedRef.current = performance.now();
    const tick = () => {
      const pct = Math.min(1, (performance.now() - startedRef.current) / HOLD_MS);
      setHoldPct(pct);
      if (pct >= 1) {
        const d = new Date();
        const at = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
        setPunched({
          stationId: pickedStation.id, city: pickedCity,
          emotion: n.emotion, jp: n.jp, en: n.en, at,
        });
        stopHold();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [punched, n, pickedStation, pickedCity, setPunched, stopHold]);

  React.useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const undoPunch = () => setPunched(null);

  return (
    <section>
      <SectionLabel jp="反抗 · 一駅だけ違う" en="REBEL NUDGE" color="var(--neon-pink)" />
      <div style={{
        marginTop: 10,
        padding: "10px 12px",
        background: "linear-gradient(120deg, rgba(255,44,212,.12), rgba(0,234,255,.06))",
        border: "1px solid var(--neon-pink)",
        position: "relative",
        boxShadow: "0 0 16px rgba(255,44,212,.25)",
      }}>
        <div style={{ fontFamily: "var(--f-display)", fontSize: 10, letterSpacing: ".25em",
          color: "var(--neon-pink)", marginBottom: 6,
          textShadow: "0 0 6px var(--neon-pink)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span>
            {punched
              ? `✓ TICKET PUNCHED ${punched.at} · 約束済`
              : "▷ TODAY'S DISOBEDIENCE · 今日の小さな反抗"}
          </span>
          {nEmotion && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontFamily: "var(--f-display)", fontSize: 9, letterSpacing: ".2em",
              color: nEmotion.color, textShadow: `0 0 5px ${nEmotion.color}`,
            }}>
              <span style={{ fontFamily: "var(--f-jp)", fontSize: 13, fontWeight: 700 }}>
                {nEmotion.glyph}
              </span>
              {nEmotion.en.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ fontFamily: "var(--f-jp)", fontSize: 16, fontWeight: 500,
          color: "var(--ink)", lineHeight: 1.4 }}>
          {n.jp}
        </div>
        <div style={{ fontFamily: "var(--f-body)", fontStyle: "italic",
          fontSize: 12, color: "var(--ink-soft)", marginTop: 4, lineHeight: 1.4 }}>
          {n.en}
        </div>
        {punched && (() => {
          const list = punched.city === "osaka" ? OSAKA_STATIONS : TOKYO_STATIONS;
          const st = list.find(s => s.id === punched.stationId);
          const jp = st ? st.jp : punched.stationId;
          const en = (st ? st.en : punched.stationId).toUpperCase();
          return (
            <div style={{ marginTop: 6 }}>
              <div style={{
                fontFamily: "var(--f-jp)", fontSize: 13, fontWeight: 500,
                color: "var(--ink-soft)", lineHeight: 1.4,
              }}>
                <span style={{ color: "var(--ink-mute)" }}>オーラ点灯</span>
                <span style={{ margin: "0 6px", color: "var(--ink-dim)" }}>·</span>
                <span style={{
                  color: nEmotion ? nEmotion.color : "var(--ink)", fontWeight: 700, fontSize: 15,
                  textShadow: nEmotion ? `0 0 6px ${nEmotion.color}` : "none",
                }}>{jp}駅</span>
              </div>
              <div style={{
                fontFamily: "var(--f-display)", fontSize: 10, letterSpacing: ".2em",
                color: "var(--ink-mute)", marginTop: 2,
              }}>
                AURA UP · {en}
              </div>
            </div>
          );
        })()}

        {punched && (
          <div style={{
            position: "absolute", top: 10, right: 10,
            transform: "rotate(-8deg)",
            border: "2px solid var(--neon-pink)",
            padding: "2px 7px",
            fontFamily: "var(--f-display)", fontSize: 10, fontWeight: 700,
            letterSpacing: ".22em", color: "var(--neon-pink)",
            textShadow: "0 0 6px var(--neon-pink)",
            boxShadow: "0 0 10px rgba(255,44,212,.4)",
            opacity: 0.9, pointerEvents: "none",
          }}>
            PUNCHED
          </div>
        )}

        {punched ? (
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={undoPunch} style={{
              background: "transparent", border: "none", padding: "4px 6px",
              fontFamily: "var(--f-display)", fontSize: 10, letterSpacing: ".2em",
              color: "var(--ink-mute)", cursor: "pointer",
            }}>↺ UNDO · 取消</button>
          </div>
        ) : (
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <button
              onPointerDown={startHold}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              style={{
                flex: 1, padding: "7px 10px",
                background: "var(--neon-pink)", color: "var(--bg-0)",
                border: "none", fontFamily: "var(--f-display)", fontSize: 11,
                letterSpacing: ".18em", cursor: "pointer", fontWeight: 700,
                boxShadow: "0 0 12px var(--neon-pink)",
                position: "relative", overflow: "hidden",
                userSelect: "none", touchAction: "none",
              }}>
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${holdPct * 100}%`,
                background: "rgba(255,255,255,0.38)",
                transition: holdPct === 0 ? "width 0.18s ease-out" : "none",
                pointerEvents: "none",
              }} />
              <span style={{ position: "relative", zIndex: 1 }}>
                {holdPct > 0 ? "HOLD · 押し続けて" : `${navLabel} · やる`}
              </span>
            </button>
            <button onClick={() => setIdx(i => (i + 1) % REBEL_NUDGES.length)} style={{
              padding: "7px 12px",
              background: "transparent", color: "var(--ink)",
              border: "1px solid var(--ink-mute)",
              fontFamily: "var(--f-display)", fontSize: 11,
              letterSpacing: ".18em", cursor: "pointer",
            }}>SKIP ▷</button>
          </div>
        )}
      </div>
    </section>
  );
}

Object.assign(window, { RailPanel });
