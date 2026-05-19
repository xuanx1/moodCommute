// ─────────────────────────────────────────────────────────────
// MOOD COMMUTE · TimeScrubber (global, controls both cities)
// ─────────────────────────────────────────────────────────────

function TimeScrubber({ hour, setHour, minute, setMinute, live, onGoLive, timelapse, onToggleTimelapse }) {
  const trackRef = React.useRef(null);

  // tick a 'seconds' clock so the readout shows live seconds in LIVE mode
  const [sec, setSec] = React.useState(() => new Date().getSeconds());
  React.useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setSec(new Date().getSeconds()), 1000);
    return () => clearInterval(id);
  }, [live]);

  const handleDrag = (clientX) => {
    const el = trackRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const total = t * 24 * 60;
    setHour(Math.floor(total / 60));
    setMinute(Math.floor(total % 60));
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    handleDrag(e.clientX);
    const onMove = (ev) => handleDrag(ev.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const tH = hour + (minute || 0) / 60;
  const cursorPct = (tH / 24) * 100;

  // sparkline: avg real train-schedule intensity across both cities
  const sparkline = React.useMemo(() => {
    const yamPeak = window.MOOD_TRAINS ? Math.max(...window.MOOD_TRAINS.SCHEDULE.yamanote) : 24;
    const loopPeak = window.MOOD_TRAINS ? Math.max(...window.MOOD_TRAINS.SCHEDULE.loop) : 16;
    const yamPct = window.MOOD_TRAINS ? window.MOOD_TRAINS.PEAK_CONGESTION.yamanote : 157;
    const loopPct = window.MOOD_TRAINS ? window.MOOD_TRAINS.PEAK_CONGESTION.loop : 108;
    const points = [];
    for (let h = 0; h < 24; h++) {
      const fy = window.MOOD_TRAINS ? window.MOOD_TRAINS.SCHEDULE.yamanote[h] : 0;
      const fl = window.MOOD_TRAINS ? window.MOOD_TRAINS.SCHEDULE.loop[h] : 0;
      const yam = yamPeak ? (fy / yamPeak) * yamPct : 0;
      const loop = loopPeak ? (fl / loopPeak) * loopPct : 0;
      points.push((yam + loop) / 2);
    }
    const max = Math.max(...points, 1);
    return points.map((v, i) => `${(i / 23) * 100},${100 - (v / max) * 100}`).join(" ");
  }, []);

  // human readable day label
  const period = hour < 5 ? "深夜 / LATE NIGHT" :
                 hour < 9 ? "朝ラッシュ / MORNING RUSH" :
                 hour < 12 ? "午前 / MID-MORNING" :
                 hour < 14 ? "昼 / NOON" :
                 hour < 17 ? "午後 / AFTERNOON" :
                 hour < 20 ? "夕ラッシュ / EVENING RUSH" :
                 hour < 23 ? "夜 / NIGHT" :
                 "深夜 / LATE NIGHT";

  return (
    <div className="neon-frame" style={{
      borderTop: "1px solid var(--neon-cyan)",
      padding: "10px 22px 14px",
      background: "linear-gradient(180deg, rgba(0,234,255,.07) 0%, rgba(7,5,13,.95) 60%)",
      display: "flex", alignItems: "center", gap: 22, position: "relative",
    }}>
      {/* play/jump controls */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <ScrubBtn primary={live} onClick={onGoLive} title="Return to live JST clock">
          {live ? "●" : "LIVE"}
        </ScrubBtn>
        <ScrubBtn onClick={() => setHour(Math.max(0, hour - 1))} title="−1 hour">‹‹</ScrubBtn>
        <ScrubBtn onClick={onToggleTimelapse} title="Time-lapse playback (not real time)">
          {timelapse ? "❚❚" : "▶"}
        </ScrubBtn>
        <ScrubBtn onClick={() => setHour(Math.min(23, hour + 1))} title="+1 hour">››</ScrubBtn>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between",
          fontFamily: "var(--f-display)", fontSize: 11, letterSpacing: ".22em", color: "var(--ink-mute)",
          marginBottom: 4 }}>
          <span>
            {live ? (
              <span style={{ color: "var(--neon-lime)", textShadow: "0 0 8px var(--neon-lime)" }}>
                ● LIVE · 実時間
              </span>
            ) : "SCRUB · 時間スクラブ"}
          </span>
          <span style={{ color: "var(--neon-cyan)", textShadow: "0 0 6px var(--neon-cyan)" }}>{period}</span>
          <span>{new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })}</span>
        </div>
        <div ref={trackRef} onPointerDown={onPointerDown}
          style={{ position: "relative", height: 52, cursor: "ew-resize", userSelect: "none" }}>
          {/* sparkline (intensity) */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: .55 }}>
            <defs>
              <linearGradient id="sl-grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--neon-cyan)" stopOpacity="0.5" />
                <stop offset="1" stopColor="var(--neon-cyan)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polyline points={`${sparkline} 100,100 0,100`} fill="url(#sl-grad)" />
            <polyline points={sparkline} fill="none" stroke="var(--neon-cyan)" strokeWidth="0.8"
              vectorEffect="non-scaling-stroke"
              style={{ filter: "drop-shadow(0 0 4px var(--neon-cyan))" }} />
          </svg>
          {/* baseline */}
          <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, height: 1,
            background: "var(--chrome)" }} />
          {/* rush bands */}
          <div style={{ position: "absolute", top: 0, bottom: 8,
            left: `${(7/24)*100}%`, width: `${(2.5/24)*100}%`,
            background: "rgba(255,45,79,.12)", borderLeft: "1px dashed rgba(255,45,79,.5)",
            borderRight: "1px dashed rgba(255,45,79,.5)" }} />
          <div style={{ position: "absolute", top: 0, bottom: 8,
            left: `${(17.5/24)*100}%`, width: `${(2.5/24)*100}%`,
            background: "rgba(255,45,79,.12)", borderLeft: "1px dashed rgba(255,45,79,.5)",
            borderRight: "1px dashed rgba(255,45,79,.5)" }} />
          {/* hour ticks */}
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute", left: `${(i / 24) * 100}%`, bottom: 8,
              width: 1, height: i % 6 === 0 ? 12 : i % 3 === 0 ? 7 : 3,
              background: "var(--ink-dim)",
              transform: "translateX(-0.5px)",
            }} />
          ))}
          {/* hour labels */}
          {[0, 6, 12, 18, 24].map(h => (
            <div key={h} style={{
              position: "absolute", bottom: -16, left: `${(h / 24) * 100}%`,
              transform: "translateX(-50%)", fontFamily: "var(--f-mono)",
              fontSize: 11, color: "var(--ink-mute)",
            }}>{String(h).padStart(2,"0")}:00</div>
          ))}
          {/* cursor */}
          <div style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${cursorPct}%`, width: 2,
            background: "var(--neon-pink)",
            transform: "translateX(-1px)",
            boxShadow: "0 0 10px var(--neon-pink)",
          }}>
            <div style={{
              position: "absolute", top: -5, left: -6, width: 14, height: 14,
              background: "var(--neon-pink)", borderRadius: "50%",
              boxShadow: "0 0 10px var(--neon-pink), 0 0 2px var(--bg-0)",
            }} />
          </div>
        </div>
      </div>

      {/* huge digital readout */}
      <div style={{ textAlign: "right" }}>
        <div className="chroma-aberration" style={{
          fontFamily: "var(--f-mono)", fontSize: 56,
          color: live ? "var(--neon-lime)" : "var(--neon-pink)",
          lineHeight: 0.9, letterSpacing: ".04em",
          animation: "flicker 2.4s infinite",
        }}>
          {String(hour).padStart(2, "0")}:{String(minute || 0).padStart(2, "0")}
          {live && (
            <span style={{ fontSize: 22, opacity: .7, marginLeft: 4 }}>
              :{String(sec).padStart(2, "0")}
            </span>
          )}
        </div>
        <div style={{ fontFamily: "var(--f-display)", fontSize: 10,
          letterSpacing: ".25em", color: "var(--ink-mute)" }}>
          {live ? "JST · 日本時間 · LIVE" : "JST · 日本時間"}
        </div>
      </div>
    </div>
  );
}

function ScrubBtn({ children, onClick, primary }) {
  return (
    <button onClick={onClick} style={{
      width: 36, height: 36,
      background: primary ? "var(--neon-pink)" : "transparent",
      color: primary ? "var(--bg-0)" : "var(--neon-cyan)",
      border: `1px solid ${primary ? "var(--neon-pink)" : "var(--chrome)"}`,
      fontFamily: "var(--f-mono)", fontSize: 16,
      cursor: "pointer",
      boxShadow: primary ? "0 0 10px var(--neon-pink)" : "none",
      display: "flex", alignItems: "center", justifyContent: "center",
      lineHeight: 1, padding: 0,
    }}>{children}</button>
  );
}

Object.assign(window, { TimeScrubber });
