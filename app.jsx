// ─────────────────────────────────────────────────────────────
// MOOD COMMUTE · main app
// Single full-bleed viz: header + (Tokyo | Osaka | Rail) + scrubber
// ─────────────────────────────────────────────────────────────

const TWEAK_DEFAULTS = {
  nav: "diegetic",
  type: "mixed",
  density: "maximal",
  scanlines: true,
  vhsTint: true,
  glow: true,
  playSpeed: 1,
};

function App() {
  const t = TWEAK_DEFAULTS;

  // tick when async data files finish loading so dependent renders refresh
  const [, setDataRev] = React.useState(0);
  React.useEffect(() => {
    const onLoad = () => setDataRev(x => x + 1);
    window.addEventListener("mood-data-loaded", onLoad);
    return () => window.removeEventListener("mood-data-loaded", onLoad);
  }, []);

  const ctxValue = React.useMemo(() => ({
    nav: t.nav, type: t.type, density: t.density,
    scanlines: t.scanlines, vhsTint: t.vhsTint, glow: t.glow,
  }), [t.nav, t.type, t.density, t.scanlines, t.vhsTint, t.glow]);

  // Resolve current Japan Standard Time from the user's wall clock.
  // Browsers can't always pin to JST directly, but the offset is fixed +09:00.
  function jstNow() {
    const d = new Date();
    const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
    const jst = new Date(utcMs + 9 * 3600 * 1000);
    return { h: jst.getHours(), m: jst.getMinutes(), s: jst.getSeconds() };
  }

  // Time state. `live` = true means follow real JST on a 1-second tick.
  // Any scrub interaction sets live=false; the LIVE button re-engages it.
  const initial = jstNow();
  const [hour, setHour] = React.useState(initial.h);
  const [minute, setMinute] = React.useState(initial.m);
  // Sub-minute fraction (0..1) — used to interpolate train positions so
  // trains glide smoothly along the track rather than jumping each minute.
  // Mood/halos/labels still tick on the integer minute to avoid jitter.
  const [subMinute, setSubMinute] = React.useState(0);
  const [live, setLive] = React.useState(true);
  const [timelapse, setTimelapse] = React.useState(false); // alt mode for exploration

  // Wrapped setters that drop out of live mode when a user manually scrubs.
  const userSetHour = React.useCallback((v) => { setLive(false); setTimelapse(false); setHour(v); }, []);
  const userSetMinute = React.useCallback((v) => { setLive(false); setTimelapse(false); setMinute(v); }, []);

  // emotion filter (empty = show all)
  const [filter, setFilter] = React.useState(new Set());

  // picked station — track which city is active
  const [picked, setPicked] = React.useState("shinjuku");
  const [pickedCity, setPickedCity] = React.useState("tokyo");

  const pickInCity = (city) => (id) => { setPicked(id); setPickedCity(city); };

  // Punched rebel-nudge — one commitment per local day. Record:
  //   { stationId, city, emotion, jp, en, at }
  // The matching station gets its emotion overridden in the map.
  const todayKey = React.useMemo(() => {
    const d = new Date();
    return `mood-commute.nudge.${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }, []);
  const [punched, setPunchedState] = React.useState(() => {
    try { const raw = localStorage.getItem(todayKey); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  });
  const setPunched = React.useCallback((record) => {
    setPunchedState(record);
    try {
      if (record === null) localStorage.removeItem(todayKey);
      else localStorage.setItem(todayKey, JSON.stringify(record));
    } catch (e) {}
  }, [todayKey]);

  // LIVE tick: sync to real JST every second. Train sub-minute animates
  // smoothly across the second between minute ticks.
  React.useEffect(() => {
    if (!live) return;
    const tick = () => {
      const d = new Date();
      const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
      const jst = new Date(utcMs + 9 * 3600 * 1000);
      setHour(jst.getHours());
      setMinute(jst.getMinutes());
      setSubMinute((jst.getSeconds() * 1000 + jst.getMilliseconds()) / 60000);
    };
    tick();
    const id = setInterval(tick, 250); // 4 Hz — smooth train glide
    return () => clearInterval(id);
  }, [live]);

  // Time-lapse tick — slow, smooth scrub forward. Sub-minute fraction
  // climbs continuously so trains glide; integer minute advances once
  // per `playSpeed` of those animation ticks.
  React.useEffect(() => {
    if (!timelapse) return;
    const id = setInterval(() => {
      setSubMinute(prev => {
        const next = prev + 0.1; // 0.1 min per 250ms = 6 sec wall = 1 min sim
        if (next >= 1) {
          setMinute(m => {
            let nm = m + 1;
            if (nm >= 60) { setHour(h => (h + 1) % 24); nm = 0; }
            return nm;
          });
          return next - 1;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [timelapse]);

  // CRT classes
  React.useEffect(() => {
    document.documentElement.classList.toggle("no-scan", !t.scanlines);
    document.documentElement.classList.toggle("vhs-tint", !!t.vhsTint);
  }, [t.scanlines, t.vhsTint]);

  const goLive = () => { setLive(true); setTimelapse(false); };
  const toggleTimelapse = () => {
    if (timelapse) { setTimelapse(false); }
    else { setLive(false); setTimelapse(true); }
  };

  return (
    <TweakCtx.Provider value={ctxValue}>
      <div style={{
        position: "fixed", inset: 0,
        background: "var(--bg-0)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* GLOBAL TOP BAR */}
        <TopBar />

        {/* MAIN — three side-by-side containers */}
        <div style={{ flex: 1, display: "flex", gap: 10, padding: 10, minHeight: 0 }}>
          <CityPanel city="tokyo" hour={hour} minute={minute} subMinute={subMinute} filter={filter}
            picked={pickedCity === "tokyo" ? picked : null}
            setPicked={pickInCity("tokyo")}
            punched={punched && punched.city === "tokyo" ? punched : null}
            accentColor="#ffffff"
            lineColor="var(--neon-lime)" />
          <CityPanel city="osaka" hour={hour} minute={minute} subMinute={subMinute} filter={filter}
            picked={pickedCity === "osaka" ? picked : null}
            setPicked={pickInCity("osaka")}
            punched={punched && punched.city === "osaka" ? punched : null}
            accentColor="#ffffff"
            lineColor="var(--neon-yellow)" />
          <RailPanel hour={hour} minute={minute}
            filter={filter} setFilter={setFilter}
            picked={picked} pickedCity={pickedCity}
            setPicked={setPicked} setPickedCity={setPickedCity}
            punched={punched} setPunched={setPunched} />
        </div>

        {/* FOOTER SCRUBBER */}
        <TimeScrubber hour={hour} setHour={userSetHour}
          minute={minute} setMinute={userSetMinute}
          live={live} onGoLive={goLive}
          timelapse={timelapse} onToggleTimelapse={toggleTimelapse} />
      </div>
    </TweakCtx.Provider>
  );
}

function TopBar() {
  return (
    <div style={{
      flex: "0 0 auto",
      padding: "10px 22px 8px",
      borderBottom: "1px solid var(--chrome)",
      display: "flex", alignItems: "center", gap: 22,
      background: "linear-gradient(180deg, rgba(28,22,56,.65) 0%, rgba(7,5,13,.95) 100%)",
      position: "relative", zIndex: 10,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <div className="chroma-aberration" style={{
          fontFamily: "var(--f-display)", fontSize: 30, letterSpacing: ".18em",
          color: "var(--neon-pink)", lineHeight: 1,
        }}>
          MOOD COMMUTE
        </div>
        <div style={{ fontFamily: "var(--f-jp)", fontSize: 22, fontWeight: 700,
          color: "var(--neon-cyan)", letterSpacing: ".02em",
          textShadow: "0 0 8px var(--neon-cyan)" }}>
          気分通勤
        </div>
      </div>

      <div style={{ width: 1, height: 26, background: "var(--chrome)" }} />

      <div style={{ fontFamily: "var(--f-display)", fontSize: 11,
        letterSpacing: ".22em", color: "var(--ink-mute)", lineHeight: 1.4 }}>
        <div>URBAN EMOTION FEED · 都市感情中継</div>
        <div style={{ color: "var(--neon-lime)", textShadow: "0 0 6px var(--neon-lime)" }}>
          GEO · OSM/ODbL · MOOD · WRIME 46k REAL TWEETS
        </div>
      </div>

      <Marquee />

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <SignalBars />
        <div style={{ fontFamily: "var(--f-mono)", fontSize: 13, color: "var(--ink)",
          textAlign: "right", lineHeight: 1.25 }}>
          <div style={{ color: "var(--neon-red)",
            textShadow: "0 0 6px var(--neon-red)",
            display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--neon-red)",
              animation: "rec-blink 1.4s infinite" }} />
            REC
          </div>
          <div style={{ color: "var(--ink-mute)" }}>FEED 0x4A21</div>
        </div>
      </div>
    </div>
  );
}

function Marquee() {
  const items = [
    "▲ SHINJUKU 緊張 +24%",
    "▼ TENNOJI 喜び -8%",
    "● HARAJUKU 喜び 92%",
    "▲ TOKYO 疲労 +12%",
    "● OSAKA 怒り SPIKE",
    "▼ AKIHABARA 畏怖 -4%",
    "▲ TSURUHASHI 喜び SPIKE",
    "● UENO 平静 89%",
  ];
  return (
    <div style={{
      flex: 1, minWidth: 0, height: 28, overflow: "hidden", position: "relative",
      border: "1px solid var(--chrome)", padding: "0",
      background: "var(--bg-1)",
    }}>
      <div style={{
        display: "flex", gap: 28, whiteSpace: "nowrap",
        animation: "marquee 36s linear infinite",
        position: "absolute", left: 0, top: 0, height: "100%", alignItems: "center", padding: "0 14px",
      }}>
        {[...items, ...items].map((it, i) => (
          <span key={i} style={{ fontFamily: "var(--f-mono)", fontSize: 14,
            letterSpacing: ".05em",
            color: it.startsWith("▲") ? "var(--neon-pink)" :
                   it.startsWith("▼") ? "var(--neon-cyan)" : "var(--neon-lime)" }}>
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function SignalBars() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 18 }}>
      {[6, 10, 14, 18].map((h, i) => (
        <div key={i} style={{
          width: 4, height: h,
          background: i < 3 ? "var(--neon-lime)" : "var(--ink-dim)",
          boxShadow: i < 3 ? `0 0 4px var(--neon-lime)` : "none",
        }} />
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
